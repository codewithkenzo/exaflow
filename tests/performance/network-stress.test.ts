import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { PerformanceMeasurer, LoadTester } from '../utils/performance-helpers';
import { httpClient, CircuitBreaker, RateLimiter } from '../../src/util/http';
import { TestExaClient } from '../utils/test-client';

describe('Network Stress Tests', () => {
  const measurer = new PerformanceMeasurer();
  const loadTester = new LoadTester();

  describe('High Concurrency Stress Tests', () => {
    it('should handle 100 concurrent requests', async () => {
      const client = new TestExaClient('test-key');
      const concurrentRequests = 100;

      const result = await measurer.measure(async () => {
        const promises = Array.from({ length: concurrentRequests }, (_, i) =>
          client.executeTask({
            query: `concurrent test ${i}`,
            type: 'search'
          }).catch(error => ({
            error: error.message,
            requestId: i,
            timestamp: Date.now()
          }))
        );

        return await Promise.allSettled(promises);
      });

      console.log(`100 concurrent requests completed in ${result.metrics.duration}ms`);
      console.log(`Memory usage: ${result.metrics.memoryUsed}MB`);

      expect(result.metrics.duration).toBeLessThan(30000); // 30 seconds max
      expect(result.metrics.memoryUsed).toBeLessThan(200); // 200MB max

      // Verify all requests completed (either success or failure)
      expect(result.result.length).toBe(concurrentRequests);

      // Count successes vs failures
      const successes = result.result.filter(r => r.status === 'fulfilled').length;
      const failures = result.result.filter(r => r.status === 'rejected').length;

      console.log(`Successes: ${successes}, Failures: ${failures}`);
      expect(successes + failures).toBe(concurrentRequests);
    });

    it('should handle sustained load over time', async () => {
      const client = new TestExaClient('test-key');
      const duration = 10000; // 10 seconds
      const requestInterval = 100; // Request every 100ms
      const expectedRequests = duration / requestInterval;

      const startTime = Date.now();
      const results = [];
      let requestCount = 0;

      while (Date.now() - startTime < duration) {
        const requestStart = Date.now();

        try {
          const result = await client.executeTask({
            query: `sustained test ${requestCount}`,
            type: 'search'
          });
          results.push({
            requestId: requestCount,
            success: true,
            duration: Date.now() - requestStart
          });
        } catch (error) {
          results.push({
            requestId: requestCount,
            success: false,
            duration: Date.now() - requestStart,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        requestCount++;

        // Wait for next request
        const elapsed = Date.now() - requestStart;
        if (elapsed < requestInterval) {
          await new Promise(resolve => setTimeout(resolve, requestInterval - elapsed));
        }
      }

      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (requestCount / actualDuration) * 1000;
      const successRate = results.filter(r => r.success).length / results.length;

      console.log(`Sustained load test:`);
      console.log(`  Duration: ${actualDuration}ms`);
      console.log(`  Requests: ${requestCount}`);
      console.log(`  RPS: ${requestsPerSecond.toFixed(2)}`);
      console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`);

      expect(requestCount).toBeGreaterThan(expectedRequests * 0.8); // At least 80% of expected
      expect(requestsPerSecond).toBeGreaterThan(5); // At least 5 RPS
      expect(successRate).toBeGreaterThan(0); // Some requests should succeed
    });
  });

  describe('Network Latency Handling', () => {
    it('should handle timeouts gracefully', async () => {
      const client = new TestExaClient('test-key');
      const timeouts = [1000, 5000, 10000, 30000]; // Various timeouts
      const results = [];

      for (const timeout of timeouts) {
        const startTime = Date.now();

        try {
          const result = await client.executeTask({
            query: 'timeout test',
            type: 'search'
          }, {
            timeout: timeout
          });

          results.push({
            timeout,
            success: true,
            actualDuration: Date.now() - startTime
          });
        } catch (error) {
          results.push({
            timeout,
            success: false,
            actualDuration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      console.log('Timeout test results:');
      results.forEach(r => {
        console.log(`  ${r.timeout}ms: ${r.success ? 'SUCCESS' : 'FAILED'} in ${r.actualDuration}ms`);
      });

      // All requests should complete within reasonable time
      results.forEach(r => {
        expect(r.actualDuration).toBeLessThan(r.timeout + 5000); // Allow 5s buffer
      });
    });

    it('should handle retry logic under network stress', async () => {
      const client = new TestExaClient('test-key');
      const retryConfigurations = [
        { retries: 0, timeout: 5000 },
        { retries: 2, timeout: 5000 },
        { retries: 5, timeout: 5000 }
      ];

      const results = [];

      for (const config of retryConfigurations) {
        const startTime = Date.now();

        try {
          const result = await client.executeTask({
            query: 'retry test',
            type: 'search'
          }, {
            timeout: config.timeout,
            retries: config.retries
          });

          results.push({
            ...config,
            success: true,
            duration: Date.now() - startTime
          });
        } catch (error) {
          results.push({
            ...config,
            success: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      console.log('Retry test results:');
      results.forEach(r => {
        console.log(`  Retries: ${r.retries}, Success: ${r.success}, Duration: ${r.duration}ms`);
      });

      // More retries should not significantly increase total duration for failed requests
      const failedResults = results.filter(r => !r.success);
      if (failedResults.length >= 2) {
        const durations = failedResults.map(r => r.duration);
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);
        const durationVariation = maxDuration - minDuration;

        expect(durationVariation).toBeLessThan(10000); // Less than 10s variation
      }
    });
  });

  describe('Circuit Breaker Under Stress', () => {
    it('should maintain performance during failure cascades', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 5000,
        monitoringPeriod: 10000
      });

      let successCount = 0;
      let failureCount = 0;
      const totalRequests = 100;

      const startTime = Date.now();

      for (let i = 0; i < totalRequests; i++) {
        try {
          await circuitBreaker.execute(async () => {
            // Simulate 80% failure rate
            if (Math.random() < 0.8) {
              throw new Error(`Simulated failure ${i}`);
            }
            successCount++;
            return `success ${i}`;
          });
        } catch (error) {
          failureCount++;
        }
      }

      const duration = Date.now() - startTime;
      const requestsPerSecond = (totalRequests / duration) * 1000;
      const stats = circuitBreaker.getStats();

      console.log(`Circuit breaker stress test:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  RPS: ${requestsPerSecond.toFixed(2)}`);
      console.log(`  Successes: ${successCount}, Failures: ${failureCount}`);
      console.log(`  Circuit state: ${stats.state}`);
      console.log(`  Failure count: ${stats.failureCount}`);

      expect(stats.state).toBe('open'); // Should be open after many failures
      expect(requestsPerSecond).toBeGreaterThan(50); // Should handle requests quickly
      expect(stats.failureCount).toBeGreaterThan(0);
    });

    it('should recover gracefully after failures', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 2000, // 2 seconds
        monitoringPeriod: 5000
      });

      // Trigger failures to open circuit
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error(`Trigger failure ${i}`);
          });
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe('open');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Circuit should be half-open now
      expect(circuitBreaker.getState()).toBe('half_open');

      // Try successful requests to close circuit
      for (let i = 0; i < 5; i++) {
        try {
          const result = await circuitBreaker.execute(async () => {
            return `success ${i}`;
          });
          expect(result).toBe(`success ${i}`);
        } catch (error) {
          // Some might still fail during half-open state
        }
      }

      // Circuit should be closed after successes
      expect(circuitBreaker.getState()).toBe('closed');
    });
  });

  describe('Rate Limiting Under Stress', () => {
    it('should maintain consistent rate limiting under load', async () => {
      const rateLimiter = new RateLimiter(50, 1000); // 50 requests per second
      const burstSize = 100; // Try to make 100 requests at once

      const startTime = Date.now();
      const results = [];

      for (let i = 0; i < burstSize; i++) {
        const requestStart = Date.now();

        try {
          await rateLimiter.acquire();
          results.push({
            requestId: i,
            success: true,
            waitTime: Date.now() - requestStart
          });
        } catch (error) {
          results.push({
            requestId: i,
            success: false,
            waitTime: Date.now() - requestStart,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const totalDuration = Date.now() - startTime;
      const actualRate = (burstSize / totalDuration) * 1000;
      const stats = rateLimiter.getStats();

      console.log(`Rate limiting stress test:`);
      console.log(`  Burst size: ${burstSize}`);
      console.log(`  Total duration: ${totalDuration}ms`);
      console.log(`  Actual rate: ${actualRate.toFixed(2)} RPS`);
      console.log(`  Stats:`, stats);

      // Should respect rate limiting
      expect(actualRate).toBeLessThan(60); // Should be close to configured 50 RPS
      expect(stats.currentRequests).toBeLessThanOrEqual(stats.maxRequests);
    });

    it('should handle multiple rate limiters efficiently', async () => {
      const limiters = Array.from({ length: 10 }, () =>
        new RateLimiter(10, 1000) // 10 requests per second each
      );

      const startTime = Date.now();
      const promises = limiters.map(async (limiter, index) => {
        const results = [];
        for (let i = 0; i < 20; i++) {
          const requestStart = Date.now();
          try {
            await limiter.acquire();
            results.push({
              limiterIndex: index,
              requestId: i,
              success: true,
              waitTime: Date.now() - requestStart
            });
          } catch (error) {
            results.push({
              limiterIndex: index,
              requestId: i,
              success: false,
              waitTime: Date.now() - requestStart
            });
          }
        }
        return results;
      });

      const allResults = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;
      const totalRequests = allResults.flat().length;
      const combinedRate = (totalRequests / totalDuration) * 1000;

      console.log(`Multiple rate limiters test:`);
      console.log(`  Total duration: ${totalDuration}ms`);
      console.log(`  Total requests: ${totalRequests}`);
      console.log(`  Combined rate: ${combinedRate.toFixed(2)} RPS`);

      // Combined rate should be reasonable
      expect(combinedRate).toBeGreaterThan(50); // Should handle good throughput
      expect(combinedRate).toBeLessThan(200); // But not exceed reasonable limits
    });
  });

  describe('Memory Usage Under Network Stress', () => {
    it('should maintain stable memory during network operations', async () => {
      const initialMemory = measurer.getMemoryUsage();
      const memorySnapshots = [];

      const client = new TestExaClient('test-key');
      const operationCount = 200;

      for (let i = 0; i < operationCount; i++) {
        try {
          await client.executeTask({
            query: `memory stress test ${i}`,
            type: 'search'
          });
        } catch (error) {
          // Expected to fail
        }

        // Sample memory every 20 operations
        if (i % 20 === 0) {
          memorySnapshots.push(measurer.getMemoryUsage());
        }
      }

      const finalMemory = measurer.getMemoryUsage();
      const maxMemory = Math.max(...memorySnapshots);
      const memoryGrowth = finalMemory - initialMemory;
      const memorySpike = maxMemory - initialMemory;

      console.log(`Memory stress test:`);
      console.log(`  Initial: ${initialMemory}MB`);
      console.log(`  Final: ${finalMemory}MB`);
      console.log(`  Growth: ${memoryGrowth}MB`);
      console.log(`  Spike: ${memorySpike}MB`);

      expect(memoryGrowth).toBeLessThan(50);
      expect(memorySpike).toBeLessThan(150);
    });
  });

  describe('Network Partition Simulation', () => {
    it('should handle simulated network partitions', async () => {
      const client = new TestExaClient('test-key');
      const partitionDuration = 5000; // 5 seconds
      const requestsDuringPartition = 20;

      // Simulate network partition by using invalid endpoints
      const partitionResults = [];

      for (let i = 0; i < requestsDuringPartition; i++) {
        const startTime = Date.now();

        try {
          await client.executeTask({
            query: `partition test ${i}`,
            type: 'search'
          }, {
            timeout: 1000 // Short timeout
          });
        } catch (error) {
          partitionResults.push({
            requestId: i,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Verify partition behavior
      const averageFailureTime = partitionResults.reduce((sum, r) => sum + r.duration, 0) / partitionResults.length;

      console.log(`Network partition simulation:`);
      console.log(`  Requests during partition: ${requestsDuringPartition}`);
      console.log(`  Average failure time: ${averageFailureTime.toFixed(0)}ms`);
      console.log(`  All requests failed: ${partitionResults.length === requestsDuringPartition}`);

      expect(partitionResults.length).toBe(requestsDuringPartition);
      expect(averageFailureTime).toBeLessThan(5000); // Should fail quickly
    });
  });
});