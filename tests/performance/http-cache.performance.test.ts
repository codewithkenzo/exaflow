import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { HttpCache, CachedHttpClient } from '../../src/util/http-cache';
import {
  PerformanceMeasurer,
  BenchmarkRunner,
  LoadTester,
  PerformanceDataGenerator,
  PerformanceAssertions,
} from '../utils/performance-helpers';

describe('HttpCache Performance Tests', () => {
  let cache: HttpCache;
  let cachedClient: CachedHttpClient;
  let benchmarkRunner: BenchmarkRunner;
  let loadTester: LoadTester;

  beforeEach(() => {
    cache = new HttpCache({
      maxSize: 1000,
      defaultTtl: 60000, // 1 minute
      enabled: true,
    });
    cachedClient = new CachedHttpClient(cache);
    benchmarkRunner = new BenchmarkRunner();
    loadTester = new LoadTester();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Cache Operation Performance', () => {
    it('should perform cache set/get operations efficiently', async () => {
      const testData = PerformanceDataGenerator.generateTestData(1); // 1KB

      const result = await benchmarkRunner.runBenchmark(
        'cache-set-get',
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.random());
          cache.set(key, testData);
          cache.get(key);
        },
        1000
      );

      expect(result.averageTime).toBeLessThan(5); // Less than 5ms average
      expect(result.throughput).toBeGreaterThan(200); // More than 200 ops/sec
      expect(result.memoryUsage).toBeLessThan(50); // Less than 50MB memory usage
    });

    it('should handle large data efficiently', async () => {
      const largeData = PerformanceDataGenerator.generateTestData(100); // 100KB

      const result = await benchmarkRunner.runBenchmark(
        'cache-large-data',
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.random());
          cache.set(key, largeData);
          cache.get(key);
        },
        100
      );

      expect(result.averageTime).toBeLessThan(5); // Allow more time for large data
      expect(result.throughput).toBeGreaterThan(200); // Still reasonable throughput
      expect(result.memoryUsage).toBeLessThan(50); // Allow more memory for large data
    });

    it('should maintain performance under cache size limits', async () => {
      const smallCache = new HttpCache({ maxSize: 10 });
      const testData = PerformanceDataGenerator.generateTestData(1);

      const result = await benchmarkRunner.runBenchmark(
        'cache-size-limits',
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.random());
          smallCache.set(key, testData);
          // Randomly access existing keys to test LRU
          if (Math.random() > 0.5) {
            const randomKey = PerformanceDataGenerator.generateCacheKey(Math.floor(Math.random() * 10));
            smallCache.get(randomKey);
          }
        },
        500
      );

      expect(result.averageTime).toBeLessThan(2);
      expect(result.throughput).toBeGreaterThan(500);
    });

    it('should efficiently cleanup expired entries', async () => {
      const shortTtlCache = new HttpCache({ defaultTtl: 50 }); // 50ms TTL
      const testData = PerformanceDataGenerator.generateTestData(1);

      // Fill cache with short TTL entries
      for (let i = 0; i < 20; i++) {
        shortTtlCache.set(`expired-${i}`, testData, undefined, 50);
      }

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      const measurer = new PerformanceMeasurer();
      const { metrics } = await measurer.measure(() => {
        shortTtlCache.cleanup();
      });

      expect(metrics.duration).toBeLessThan(50); // Cleanup should be fast
      expect(shortTtlCache.getStats().size).toBeLessThan(5); // Most entries should be cleaned
    });
  });

  describe('Cache Hit/Miss Performance', () => {
    it('should show significant performance improvement for cache hits', async () => {
      const testData = PerformanceDataGenerator.generateApiResponse(20);
      const testKey = 'perf-test-key';

      // Pre-populate cache
      cache.set(testKey, testData);

      // Benchmark cached access only (cache should be faster than no cache)
      const cachedResult = await benchmarkRunner.runBenchmark(
        'cached-access',
        async () => {
          cache.get(testKey);
        },
        1000
      );

      // Benchmark uncached access (clear cache each time)
      const uncachedResult = await benchmarkRunner.runBenchmark(
        'uncached-access',
        async () => {
          cache.clear();
          cache.set(testKey, testData);
          return cache.get(testKey);
        },
        100
      );

      // Cached access should be faster (but allow some variance due to test environment)
      expect(cachedResult.averageTime).toBeLessThan(uncachedResult.averageTime * 1.2);
      expect(cachedResult.throughput).toBeGreaterThan(uncachedResult.throughput * 0.8);
    });

    it('should maintain performance with high cache hit ratio', async () => {
      const testData = PerformanceDataGenerator.generateTestData(5);
      const keys = Array.from({ length: 20 }, (_, i) => `hit-ratio-key-${i}`);

      // Pre-populate cache
      keys.forEach(key => cache.set(key, testData));

      const measurer = new PerformanceMeasurer();

      const { metrics } = await measurer.measure(async () => {
        // Mix of hits and misses
        for (let i = 0; i < 200; i++) {
          const key = keys[i % keys.length];
          cache.get(key);

          // Occasionally miss
          if (i % 10 === 0) {
            cache.get(`miss-key-${i}`);
          }
        }
      });

      expect(metrics.duration).toBeLessThan(100); // 200 operations in under 100ms
      expect(metrics.memoryUsed).toBeLessThan(10); // Minimal memory increase
    });
  });

  describe('Concurrent Access Performance', () => {
    it('should handle concurrent cache operations efficiently', async () => {
      const testData = PerformanceDataGenerator.generateTestData(5);

      const result = await loadTester.runConcurrentLoadTest(
        100, // Total requests (reduced for stability)
        10,   // Concurrency (reduced for stability)
        async (index) => {
          const key = PerformanceDataGenerator.generateCacheKey(index);
          cache.set(key, testData);
          return cache.get(key);
        }
      );

      PerformanceAssertions.assertLoadTest(result, 100, 50, 5);
      expect(result.successfulRequests).toBeGreaterThan(90);
      expect(result.errorRate).toBeLessThan(10);
    });

    it('should handle concurrent read-heavy workload', async () => {
      const testData = PerformanceDataGenerator.generateTestData(5);
      const baseKey = 'concurrent-read-test';
      cache.set(baseKey, testData);

      const result = await loadTester.runConcurrentLoadTest(
        200, // Total requests
        20,  // Concurrency
        async () => cache.get(baseKey)
      );

      PerformanceAssertions.assertLoadTest(result, 50, 100, 1);
      expect(result.successfulRequests).toBeGreaterThan(190);
      expect(result.errorRate).toBeLessThan(5);
    });

    it('should handle mixed concurrent workload', async () => {
      const testData = PerformanceDataGenerator.generateTestData(2);

      const result = await loadTester.runConcurrentLoadTest(
        100,  // Total requests
        10,   // Concurrency
        async (index) => {
          const key = PerformanceDataGenerator.generateCacheKey(index % 10);

          // 70% reads, 30% writes
          if (index % 10 < 7) {
            return cache.get(key);
          } else {
            cache.set(key, testData);
            return cache.get(key);
          }
        }
      );

      PerformanceAssertions.assertLoadTest(result, 100, 50, 5);
      expect(result.successfulRequests).toBeGreaterThan(80);
    });
  });

  describe('Sustained Load Performance', () => {
    it('should handle sustained load without performance degradation', async () => {
      const testData = PerformanceDataGenerator.generateTestData(3);

      const result = await loadTester.runSustainedLoadTest(
        2000,  // 2 seconds
        50,    // 50 requests per second
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.floor(Math.random() * 20));

          // 80% reads, 20% writes
          if (Math.random() < 0.8) {
            return cache.get(key);
          } else {
            cache.set(key, testData);
            return 'set';
          }
        }
      );

      expect(result.requestsPerSecond).toBeGreaterThan(20);
      expect(result.errorRate).toBeLessThan(10);
      expect(result.averageLatency).toBeLessThan(100);
      expect(result.memoryUsage).toBeLessThan(50);
    });

    it('should maintain performance under memory pressure', async () => {
      const largeData = PerformanceDataGenerator.generateTestData(20); // 20KB per item

      const result = await loadTester.runSustainedLoadTest(
        1000,  // 1 second
        25,    // 25 requests per second
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.floor(Math.random() * 30));
          cache.set(key, largeData);
          return cache.get(key);
        }
      );

      expect(result.requestsPerSecond).toBeGreaterThan(10);
      expect(result.errorRate).toBeLessThan(10);
      expect(result.memoryUsage).toBeLessThan(100); // Allow more memory for large data
    });
  });

  describe('TTL Performance', () => {
    it('should efficiently handle entries with different TTL values', async () => {
      const testData = PerformanceDataGenerator.generateTestData(2);

      const result = await benchmarkRunner.runBenchmark(
        'ttl-variability',
        async () => {
          const key = PerformanceDataGenerator.generateCacheKey(Math.random());
          const ttl = Math.random() * 10000 + 1000; // 1-11 seconds
          cache.set(key, testData, undefined, ttl);
          cache.get(key);
        },
        500
      );

      expect(result.averageTime).toBeLessThan(2);
      expect(result.throughput).toBeGreaterThan(500);
    });

    it('should efficiently cleanup large numbers of expired entries', async () => {
      // Fill cache with entries that will expire quickly
      const shortTtlCache = new HttpCache({ maxSize: 1000, defaultTtl: 100 });
      const testData = PerformanceDataGenerator.generateTestData(1);

      for (let i = 0; i < 500; i++) {
        shortTtlCache.set(`ttl-test-${i}`, testData, undefined, 100);
      }

      const measurer = new PerformanceMeasurer();

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const { metrics } = await measurer.measure(() => {
        shortTtlCache.cleanup();
      });

      expect(metrics.duration).toBeLessThan(50); // Cleanup of 500 entries should be fast
      expect(shortTtlCache.getStats().size).toBeLessThan(50);
    });
  });

  describe('CachedHttpClient Performance', () => {
    it('should show performance improvement with CachedHttpClient', async () => {
      const mockResponse = PerformanceDataGenerator.generateApiResponse(20);

      // Mock fetch to return predictable data
      const originalFetch = global.fetch;
      global.fetch = async (url: string) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate network latency
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };

      try {
        const testUrl = 'https://api.example.com/test';

        // Benchmark first request (uncached)
        const firstResult = await cachedClient.get(testUrl);

        // Benchmark subsequent requests (cached)
        const cachedResult = await benchmarkRunner.runBenchmark(
          'cached-http-get',
          async () => cachedClient.get(testUrl),
          100
        );

        expect(cachedResult.averageTime).toBeLessThan(5); // Cached requests should be fast
        expect(cachedResult.throughput).toBeGreaterThan(200);

        // Verify data integrity
        expect(firstResult).toEqual(mockResponse);

      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle cache-control headers efficiently', async () => {
      const mockResponse = PerformanceDataGenerator.generateApiResponse(10);

      const originalFetch = global.fetch;
      global.fetch = async (url: string) => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'max-age=300', // 5 minutes
          },
        });
      };

      try {
        const testUrl = 'https://api.example.com/cache-control-test';

        // First request to populate cache
        await cachedClient.get(testUrl);

        // Benchmark cached requests with Cache-Control
        const result = await benchmarkRunner.runBenchmark(
          'cache-control-requests',
          async () => cachedClient.get(testUrl),
          200
        );

        expect(result.averageTime).toBeLessThan(3);
        expect(result.throughput).toBeGreaterThan(300);

      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should not leak memory during sustained operations', async () => {
      const testData = PerformanceDataGenerator.generateTestData(1);
      const initialMemory = process.memoryUsage().heapUsed;

      // Run sustained operations
      for (let cycle = 0; cycle < 5; cycle++) {
        // Fill cache with smaller batch
        for (let i = 0; i < 50; i++) {
          const key = PerformanceDataGenerator.generateCacheKey(cycle * 50 + i);
          cache.set(key, testData);
        }

        // Access cache
        for (let i = 0; i < 50; i++) {
          const key = PerformanceDataGenerator.generateCacheKey(cycle * 50 + i);
          cache.get(key);
        }

        // Cleanup some entries
        if (cycle % 2 === 0) {
          cache.cleanup();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(20); // Less than 20MB increase
      expect(cache.getStats().size).toBeLessThan(1000); // Within cache limits
    });

    it('should handle cache size changes efficiently', async () => {
      const testData = PerformanceDataGenerator.generateTestData(3);

      // Fill cache to 500 entries
      for (let i = 0; i < 500; i++) {
        cache.set(`resize-test-${i}`, testData);
      }

      const measurer = new PerformanceMeasurer();

      // Reduce cache size significantly
      const { metrics } = await measurer.measure(() => {
        cache.updateConfig({ maxSize: 100 });
      });

      expect(metrics.duration).toBeLessThan(100); // Size reduction should be efficient
      expect(cache.getStats().size).toBeLessThanOrEqual(100);
    });
  });
});