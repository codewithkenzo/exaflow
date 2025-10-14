import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { PerformanceMeasurer, LoadTester } from '../utils/performance-helpers';
import { TestExaClient } from '../utils/test-client';
import { HttpCache } from '../../src/util/http-cache';
import { httpClient } from '../../src/util/http';
import { promises as fs } from 'fs';

describe('Memory Leak Detection Tests', () => {
  const measurer = new PerformanceMeasurer();
  let initialMemory: number;

  beforeEach(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    initialMemory = measurer.getMemoryUsage();
  });

  describe('HTTP Client Memory Management', () => {
    it('should not leak memory on repeated requests', async () => {
      const client = new TestExaClient('test-key');
      const memorySnapshots: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        // Perform operation that could potentially leak
        try {
          await client.executeTask({
            query: `test query ${i}`,
            type: 'search'
          });
        } catch (error) {
          // Expected to fail with test key
        }

        // Measure memory every 10 iterations
        if (i % 10 === 0) {
          if (global.gc) {
            global.gc();
          }
          const currentMemory = measurer.getMemoryUsage();
          memorySnapshots.push(currentMemory);
        }
      }

      // Final garbage collection
      if (global.gc) {
        global.gc();
      }
      const finalMemory = measurer.getMemoryUsage();

      // Memory should not grow significantly
      const memoryGrowth = finalMemory - initialMemory;
      const maxMemory = Math.max(...memorySnapshots);
      const memoryVariation = maxMemory - Math.min(...memorySnapshots);

      console.log(`Initial memory: ${initialMemory}MB`);
      console.log(`Final memory: ${finalMemory}MB`);
      console.log(`Memory growth: ${memoryGrowth}MB`);
      console.log(`Memory variation: ${memoryVariation}MB`);

      // Allow some memory growth but should be reasonable
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
      expect(memoryVariation).toBeLessThan(100); // Less than 100MB variation
    });

    it('should handle large response data without leaking', async () => {
      const cache = new HttpCache({
        enabled: true,
        maxSize: 1000,
        defaultTtl: 60000
      });

      const largeData = {
        content: 'x'.repeat(1024 * 1024), // 1MB string
        metadata: {
          id: Math.random(),
          timestamp: Date.now(),
          tags: Array.from({ length: 1000 }, (_, i) => `tag-${i}`)
        }
      };

      const memorySnapshots: number[] = [];

      for (let i = 0; i < 50; i++) {
        const key = `large-data-${i}`;

        // Cache large data
        cache.set(key, largeData, { method: 'GET' });

        // Retrieve data
        cache.get(key, { method: 'GET' });

        if (i % 5 === 0) {
          if (global.gc) {
            global.gc();
          }
          memorySnapshots.push(measurer.getMemoryUsage());
        }
      }

      // Clear cache
      cache.clear();

      if (global.gc) {
        global.gc();
      }
      const finalMemory = measurer.getMemoryUsage();

      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(100); // Allow more memory for large data operations
    });
  });

  describe('Event Streamer Memory Management', () => {
    it('should not accumulate event listeners', async () => {
      const client = new TestExaClient('test-key');
      const initialMemory = measurer.getMemoryUsage();

      // Create many streamers
      const streamers = [];
      for (let i = 0; i < 100; i++) {
        const streamer = client.createStreamer(`test-${i}`, 'test-client');
        streamers.push(streamer);

        // Add some events
        streamer.apiRequest('GET', '/test', { query: 'test' });
        streamer.apiResponse('GET', '/test', 200, 100);
      }

      if (global.gc) {
        global.gc();
      }
      const peakMemory = measurer.getMemoryUsage();

      // Clear streamers
      streamers.length = 0;

      if (global.gc) {
        global.gc();
      }
      const finalMemory = measurer.getMemoryUsage();

      console.log(`Event streamer - Initial: ${initialMemory}MB, Peak: ${peakMemory}MB, Final: ${finalMemory}MB`);

      // Memory should return close to initial after cleanup
      const memoryRecovery = peakMemory - finalMemory;
      expect(memoryRecovery).toBeGreaterThan(0);
      expect(finalMemory - initialMemory).toBeLessThan(20);
    });
  });

  describe('Rate Limiter Memory Management', () => {
    it('should not accumulate request timestamps indefinitely', async () => {
      const { RateLimiter } = await import('../../src/util/http');
      const rateLimiter = new RateLimiter(100, 1000); // 100 requests per second

      const initialMemory = measurer.getMemoryUsage();

      // Make many requests over time
      for (let i = 0; i < 1000; i++) {
        await rateLimiter.acquire();

        if (i % 100 === 0) {
          // Small delay to allow window to slide
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      if (global.gc) {
        global.gc();
      }
      const finalMemory = measurer.getMemoryUsage();

      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(10); // Rate limiter should clean up old timestamps
    });
  });

  describe('Circuit Breaker Memory Management', () => {
    it('should not leak memory during state transitions', async () => {
      const { CircuitBreaker } = await import('../../src/util/http');
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 100,
        monitoringPeriod: 1000
      });

      const initialMemory = measurer.getMemoryUsage();

      // Trigger many state transitions
      for (let i = 0; i < 100; i++) {
        try {
          await circuitBreaker.execute(async () => {
            if (Math.random() < 0.7) {
              throw new Error(`Simulated failure ${i}`);
            }
            return `success ${i}`;
          });
        } catch (error) {
          // Expected failures
        }

        // Small delay for state transitions
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      if (global.gc) {
        global.gc();
      }
      const finalMemory = measurer.getMemoryUsage();

      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(5); // Circuit breaker should maintain constant memory
    });
  });

  describe('Concurrent Operations Memory Safety', () => {
    it('should handle concurrent requests without memory explosion', async () => {
      const client = new TestExaClient('test-key');
      const concurrentRequests = 50;
      const requestsPerBatch = 10;
      const batches = 5;

      const initialMemory = measurer.getMemoryUsage();
      const memorySnapshots: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const promises = Array.from({ length: requestsPerBatch }, (_, i) =>
          client.executeTask({
            query: `concurrent test ${batch}-${i}`,
            type: 'search'
          }).catch(error => ({ error: error.message, batch, i }))
        );

        await Promise.allSettled(promises);

        if (global.gc) {
          global.gc();
        }
        memorySnapshots.push(measurer.getMemoryUsage());
      }

      const finalMemory = measurer.getMemoryUsage();
      const maxMemory = Math.max(...memorySnapshots);

      console.log(`Concurrent operations - Initial: ${initialMemory}MB, Max: ${maxMemory}MB, Final: ${finalMemory}MB`);

      const memoryGrowth = finalMemory - initialMemory;
      const memorySpike = maxMemory - initialMemory;

      expect(memoryGrowth).toBeLessThan(50);
      expect(memorySpike).toBeLessThan(200); // Allow temporary spikes during concurrency
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should handle file handle exhaustion gracefully', async () => {
      const tempDir = '/tmp/exa-test-' + Date.now();
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const initialMemory = measurer.getMemoryUsage();
        const openFiles: string[] = [];

        // Create many temporary files
        for (let i = 0; i < 100; i++) {
          const filePath = `${tempDir}/test-${i}.txt`;
          await fs.writeFile(filePath, `test content ${i}`.repeat(1000));
          openFiles.push(filePath);
        }

        // Read files concurrently
        const readPromises = openFiles.map(path => fs.readFile(path));
        await Promise.allSettled(readPromises);

        if (global.gc) {
          global.gc();
        }
        const peakMemory = measurer.getMemoryUsage();

        // Clean up files
        await Promise.allSettled(openFiles.map(path => fs.unlink(path).catch(() => {})));
        await fs.rm(tempDir, { recursive: true, force: true });

        if (global.gc) {
          global.gc();
        }
        const finalMemory = measurer.getMemoryUsage();

        const memoryGrowth = finalMemory - initialMemory;
        const memoryRecovery = peakMemory - finalMemory;

        expect(memoryGrowth).toBeLessThan(100);
        expect(memoryRecovery).toBeGreaterThan(0);

      } catch (error) {
        // Clean up on error
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {}
        throw error;
      }
    });

    it('should handle memory pressure scenarios', async () => {
      const cache = new HttpCache({
        enabled: true,
        maxSize: 100,
        defaultTtl: 1000
      });

      const initialMemory = measurer.getMemoryUsage();

      // Fill cache with large items
      const largeItems = Array.from({ length: 200 }, (_, i) => ({
        key: `pressure-test-${i}`,
        data: {
          content: 'x'.repeat(10000), // 10KB per item
          metadata: {
            id: i,
            timestamp: Date.now(),
            tags: Array.from({ length: 100 }, (_, j) => `tag-${i}-${j}`)
          }
        }
      }));

      // Add items to cache
      for (const item of largeItems) {
        cache.set(item.key, item.data, { method: 'GET' });
      }

      if (global.gc) {
        global.gc();
      }
      const peakMemory = measurer.getMemoryUsage();

      // Access cached items
      for (const item of largeItems) {
        cache.get(item.key, { method: 'GET' });
      }

      // Clear cache
      cache.clear();

      if (global.gc) {
        global.gc();
      }
      const finalMemory = measurer.getMemoryUsage();

      const memoryGrowth = finalMemory - initialMemory;
      const memorySpike = peakMemory - initialMemory;

      console.log(`Memory pressure - Initial: ${initialMemory}MB, Peak: ${peakMemory}MB, Final: ${finalMemory}MB`);
      console.log(`Memory growth: ${memoryGrowth}MB, Spike: ${memorySpike}MB`);

      // Cache should properly evict old items and clean up memory
      expect(memoryGrowth).toBeLessThan(50);
      expect(memorySpike).toBeLessThan(500); // Allow larger spike for memory pressure test
    });
  });

  describe('Long-Running Operations', () => {
    it('should maintain stable memory over extended operation', async () => {
      const client = new TestExaClient('test-key');
      const duration = 10000; // 10 seconds
      const interval = 100; // Operation every 100ms
      const iterations = duration / interval;

      const memorySnapshots: number[] = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        try {
          await client.executeTask({
            query: `long-running-test-${i}`,
            type: 'search'
          });
        } catch (error) {
          // Expected to fail
        }

        // Sample memory every second
        if (i % 10 === 0) {
          if (global.gc) {
            global.gc();
          }
          memorySnapshots.push({
            time: Date.now() - startTime,
            memory: measurer.getMemoryUsage()
          } as any);
        }

        // Wait for next iteration
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      const finalMemory = measurer.getMemoryUsage();
      const memoryGrowth = finalMemory - initialMemory;

      // Calculate memory trend
      if (memorySnapshots.length > 1) {
        const firstSnapshot = memorySnapshots[0] as any;
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1] as any;
        const memoryTrend = (lastSnapshot.memory - firstSnapshot.memory) / (lastSnapshot.time - firstSnapshot.time) * 1000;

        console.log(`Long-running test duration: ${duration}ms`);
        console.log(`Memory growth: ${memoryGrowth}MB`);
        console.log(`Memory trend: ${memoryTrend.toFixed(3)}MB/sec`);

        // Memory trend should be close to zero (stable)
        expect(Math.abs(memoryTrend)).toBeLessThan(1); // Less than 1MB/sec drift
      }

      expect(memoryGrowth).toBeLessThan(30);
    });
  });
});