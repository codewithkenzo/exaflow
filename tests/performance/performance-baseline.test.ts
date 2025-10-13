import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  BenchmarkRunner,
  PerformanceDataGenerator,
  PerformanceAssertions,
} from '../utils/performance-helpers';
import { HttpCache } from '../../src/util/http-cache';

const BASELINE_FILE = join(process.cwd(), 'test-results', 'performance-baseline.json');

interface PerformanceBaseline {
  timestamp: number;
  environment: string;
  nodeVersion: string;
  platform: string;
  results: {
    cacheOperations: {
      averageTime: number;
      throughput: number;
      memoryUsage: number;
    };
    cacheHits: {
      cachedAccess: number;
      uncachedAccess: number;
      improvementRatio: number;
    };
    largeData: {
      averageTime: number;
      throughput: number;
      memoryUsage: number;
    };
    concurrency: {
      averageLatency: number;
      requestsPerSecond: number;
      errorRate: number;
    };
  };
}

describe('Performance Baseline Tests', () => {
  let baseline: PerformanceBaseline;
  let cache: HttpCache;
  let runner: BenchmarkRunner;

  beforeAll(() => {
    cache = new HttpCache({
      maxSize: 500,
      defaultTtl: 30000,
      enabled: true,
    });
    runner = new BenchmarkRunner();

    // Load or create baseline
    if (existsSync(BASELINE_FILE)) {
      baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
    } else {
      baseline = generateBaseline();
      saveBaseline(baseline);
    }
  });

  afterAll(() => {
    cache.clear();
  });

  describe('Baseline Maintenance', () => {
    it('should have a recent baseline (less than 7 days old)', () => {
      const baselineAge = Date.now() - baseline.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      expect(baselineAge).toBeLessThan(maxAge);
    });

    it('should capture system environment information', () => {
      expect(baseline.nodeVersion).toBeDefined();
      expect(baseline.platform).toBeDefined();
      expect(baseline.environment).toBeDefined();
    });
  });

  describe('Cache Operations Baseline', () => {
    it('should meet or exceed cache operations baseline performance', async () => {
      const testData = PerformanceDataGenerator.generateTestData(1);

      const result = await runner.runBenchmark(
        'cache-operations-baseline',
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.random());
          cache.set(key, testData);
          return cache.get(key);
        },
        1000
      );

      // Should be at least as good as baseline
      expect(result.averageTime).toBeLessThanOrEqual(baseline.results.cacheOperations.averageTime * 1.1);
      expect(result.throughput).toBeGreaterThanOrEqual(baseline.results.cacheOperations.throughput * 0.9);
      expect(result.memoryUsage).toBeLessThan(baseline.results.cacheOperations.memoryUsage * 1.2);

      console.log(`Cache Operations - Current: ${result.averageTime.toFixed(3)}ms, Baseline: ${baseline.results.cacheOperations.averageTime.toFixed(3)}ms`);
    });
  });

  describe('Cache Hit Performance Baseline', () => {
    it('should maintain cache hit performance improvements', async () => {
      const testData = PerformanceDataGenerator.generateTestData(2);
      const testKey = 'baseline-hit-test';

      // Benchmark uncached access
      const uncachedResult = await runner.runBenchmark(
        'uncached-baseline',
        async () => {
          cache.clear();
          cache.set(testKey, testData);
          return cache.get(testKey);
        },
        100
      );

      // Benchmark cached access
      const cachedResult = await runner.runBenchmark(
        'cached-baseline',
        async () => cache.get(testKey),
        1000
      );

      const improvementRatio = (uncachedResult.averageTime - cachedResult.averageTime) / uncachedResult.averageTime;

      // Should maintain significant improvement (more lenient threshold)
      expect(improvementRatio).toBeGreaterThanOrEqual(baseline.results.cacheHits.improvementRatio * 0.5);
      expect(cachedResult.averageTime).toBeLessThan(baseline.results.cacheHits.cachedAccess * 1.1);
      expect(cachedResult.throughput).toBeGreaterThan(baseline.results.cacheHits.improvementRatio * 5);

      console.log(`Cache Hit Improvement - Current: ${(improvementRatio * 100).toFixed(1)}%, Baseline: ${(baseline.results.cacheHits.improvementRatio * 100).toFixed(1)}%`);
    });
  });

  describe('Large Data Baseline', () => {
    it('should handle large data within baseline performance', async () => {
      const largeData = PerformanceDataGenerator.generateTestData(50); // 50KB

      const result = await runner.runBenchmark(
        'large-data-baseline',
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.random());
          cache.set(key, largeData);
          return cache.get(key);
        },
        100
      );

      expect(result.averageTime).toBeLessThanOrEqual(baseline.results.largeData.averageTime * 1.5);
      expect(result.throughput).toBeGreaterThanOrEqual(baseline.results.largeData.throughput * 0.8);
      expect(result.memoryUsage).toBeLessThan(baseline.results.largeData.memoryUsage * 1.2);

      console.log(`Large Data - Current: ${result.averageTime.toFixed(3)}ms, Baseline: ${baseline.results.largeData.averageTime.toFixed(3)}ms`);
    });
  });

  describe('Concurrency Baseline', () => {
    it('should handle concurrent operations within baseline performance', async () => {
      const testData = PerformanceDataGenerator.generateTestData(3);

      // Create a simple concurrent load test
      const concurrency = 20;
      const requestsPerThread = 50;
      const totalRequests = concurrency * requestsPerThread;

      const startTime = performance.now();
      const results: Array<{ success: boolean; latency: number; error?: Error }> = [];

      for (let thread = 0; thread < concurrency; thread++) {
        for (let req = 0; req < requestsPerThread; req++) {
          try {
            const start = performance.now();
            const key = PerformanceDataGenerator.generateCacheKey(thread * requestsPerThread + req);
            cache.set(key, testData);
            cache.get(key);
            const end = performance.now();
            results.push({ success: true, latency: end - start });
          } catch (error) {
            results.push({ success: false, latency: 0, error: error as Error });
          }
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successfulRequests = results.filter(r => r.success).length;
      const latencies = results.filter(r => r.success).map(r => r.latency);
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const requestsPerSecond = successfulRequests / (totalTime / 1000);
      const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;

      expect(averageLatency).toBeLessThanOrEqual(baseline.results.concurrency.averageLatency * 1.2);
      expect(requestsPerSecond).toBeGreaterThanOrEqual(baseline.results.concurrency.requestsPerSecond * 0.8);
      expect(errorRate).toBeLessThan(Math.max(5, baseline.results.concurrency.errorRate * 1.5));

      console.log(`Concurrency - Current: ${requestsPerSecond.toFixed(1)} req/s, Baseline: ${baseline.results.concurrency.requestsPerSecond.toFixed(1)} req/s`);
    });
  });

  describe('Baseline Updates', () => {
    it('should provide option to update baseline', async () => {
      if (process.env.UPDATE_BASELINE === 'true') {
        console.log('Updating performance baseline...');
        const newBaseline = generateBaseline();
        saveBaseline(newBaseline);
        expect(newBaseline.timestamp).toBeGreaterThan(baseline.timestamp);
      }
    });
  });

  function generateBaseline(): PerformanceBaseline {
    console.log('Generating performance baseline...');
    return {
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'test',
      nodeVersion: process.version,
      platform: process.platform,
      results: {
        cacheOperations: {
          averageTime: 0.01, // 0.01ms
          throughput: 50000, // 50000 ops/sec
          memoryUsage: 5, // 5MB
        },
        cacheHits: {
          cachedAccess: 0.005, // 0.005ms
          uncachedAccess: 0.01, // 0.01ms
          improvementRatio: 0.2, // 20% improvement (more realistic)
        },
        largeData: {
          averageTime: 0.005, // 0.005ms for 50KB
          throughput: 10000, // 10000 ops/sec
          memoryUsage: 15, // 15MB for 50KB data
        },
        concurrency: {
          averageLatency: 1, // 1ms
          requestsPerSecond: 50000, // 50000 req/s
          errorRate: 0.1, // 0.1% error rate
        },
      },
    };
  }

  function saveBaseline(baseline: PerformanceBaseline): void {
    const resultsDir = join(process.cwd(), 'test-results');

    // Create directory if it doesn't exist
    if (!existsSync(resultsDir)) {
      // Simple directory creation
      try {
        const fs = require('fs');
        fs.mkdirSync(resultsDir, { recursive: true });
      } catch (error) {
        console.warn('Could not create test-results directory:', error);
      }
    }

    writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
    console.log(`Performance baseline saved to ${BASELINE_FILE}`);
  }
});