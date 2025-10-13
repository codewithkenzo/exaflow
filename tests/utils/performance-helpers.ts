/**
 * Performance testing utilities and helpers
 */

export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryUsed?: number;
}

export interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  memoryUsage: number;
  throughput: number; // operations per second
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTime: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  errorRate: number;
  memoryUsage: number;
}

/**
 * Performance measurement class
 */
export class PerformanceMeasurer {
  private startTime: number = 0;
  private endTime: number = 0;
  private memoryBefore: number = 0;
  private memoryAfter: number = 0;

  /**
   * Start measuring performance
   */
  start(): void {
    this.startTime = performance.now();
    this.memoryBefore = this.getMemoryUsage();
  }

  /**
   * Stop measuring performance
   */
  stop(): PerformanceMetrics {
    this.endTime = performance.now();
    this.memoryAfter = this.getMemoryUsage();

    const metrics: PerformanceMetrics = {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
      memoryBefore: this.memoryBefore,
      memoryAfter: this.memoryAfter,
      memoryUsed: this.memoryAfter - this.memoryBefore,
    };

    return metrics;
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024; // Convert to MB
    }
    return 0;
  }

  /**
   * Execute function and measure performance
   */
  async measure<T>(fn: () => Promise<T>): Promise<{ result: T; metrics: PerformanceMetrics }> {
    this.start();
    const result = await fn();
    const metrics = this.stop();
    return { result, metrics };
  }

  /**
   * Execute synchronous function and measure performance
   */
  measureSync<T>(fn: () => T): { result: T; metrics: PerformanceMetrics } {
    this.start();
    const result = fn();
    const metrics = this.stop();
    return { result, metrics };
  }
}

/**
 * Benchmark runner for performance testing
 */
export class BenchmarkRunner {
  /**
   * Run multiple iterations of a function and return benchmark results
   */
  async runBenchmark<T>(
    operation: string,
    fn: () => Promise<T>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    const measurer = new PerformanceMeasurer();

    // Warm up
    for (let i = 0; i < Math.min(10, iterations / 10); i++) {
      await fn();
    }

    // Collect measurements
    for (let i = 0; i < iterations; i++) {
      const { metrics } = await measurer.measure(fn);
      times.push(metrics.duration);
    }

    // Calculate statistics
    times.sort((a, b) => a - b);
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = times[0];
    const maxTime = times[times.length - 1];

    const p95Index = Math.floor(times.length * 0.95);
    const p99Index = Math.floor(times.length * 0.99);
    const p95Time = times[p95Index];
    const p99Time = times[p99Index];

    // Get memory usage
    const memoryBefore = measurer['memoryBefore'];
    const memoryAfter = measurer['memoryAfter'];

    return {
      operation,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      p95Time,
      p99Time,
      memoryUsage: (memoryAfter - memoryBefore) || 0,
      throughput: 1000 / averageTime, // operations per second
    };
  }

  /**
   * Run synchronous benchmark
   */
  runBenchmarkSync<T>(
    operation: string,
    fn: () => T,
    iterations: number = 100
  ): BenchmarkResult {
    const times: number[] = [];
    const measurer = new PerformanceMeasurer();

    // Warm up
    for (let i = 0; i < Math.min(10, iterations / 10); i++) {
      fn();
    }

    // Collect measurements
    for (let i = 0; i < iterations; i++) {
      const { metrics } = measurer.measureSync(fn);
      times.push(metrics.duration);
    }

    // Calculate statistics
    times.sort((a, b) => a - b);
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = times[0];
    const maxTime = times[times.length - 1];

    const p95Index = Math.floor(times.length * 0.95);
    const p99Index = Math.floor(times.length * 0.99);
    const p95Time = times[p95Index];
    const p99Time = times[p99Index];

    // Get memory usage
    const memoryBefore = measurer['memoryBefore'];
    const memoryAfter = measurer['memoryAfter'];

    return {
      operation,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      p95Time,
      p99Time,
      memoryUsage: (memoryAfter - memoryBefore) || 0,
      throughput: 1000 / averageTime,
    };
  }
}

/**
 * Load testing utilities
 */
export class LoadTester {
  /**
   * Run concurrent load test
   */
  async runConcurrentLoadTest<T>(
    requests: number,
    concurrency: number,
    fn: (index: number) => Promise<T>
  ): Promise<LoadTestResult> {
    const startTime = performance.now();
    const measurer = new PerformanceMeasurer();
    measurer.start();

    const results: Array<{ success: boolean; latency: number; error?: Error }> = [];
    const chunks = Math.ceil(requests / concurrency);

    // Process requests in chunks
    for (let chunk = 0; chunk < chunks; chunk++) {
      const chunkStart = chunk * concurrency;
      const chunkEnd = Math.min(chunkStart + concurrency, requests);
      const chunkPromises: Promise<void>[] = [];

      for (let i = chunkStart; i < chunkEnd; i++) {
        const promise = (async () => {
          try {
            const requestStart = performance.now();
            await fn(i);
            const requestEnd = performance.now();
            results.push({
              success: true,
              latency: requestEnd - requestStart,
            });
          } catch (error) {
            results.push({
              success: false,
              latency: 0,
              error: error as Error,
            });
          }
        })();
        chunkPromises.push(promise);
      }

      await Promise.all(chunkPromises);
    }

    const endTime = performance.now();
    const metrics = measurer.stop();

    // Calculate statistics
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.filter(r => !r.success).length;
    const latencies = results.filter(r => r.success).map(r => r.latency);

    if (latencies.length === 0) {
      return {
        totalRequests: requests,
        successfulRequests: 0,
        failedRequests,
        totalTime: endTime - startTime,
        averageLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        requestsPerSecond: 0,
        errorRate: (failedRequests / requests) * 100,
        memoryUsage: metrics.memoryUsed || 0,
      };
    }

    latencies.sort((a, b) => a - b);
    const totalTime = endTime - startTime;
    const averageLatency = latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];

    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    const p95Latency = latencies[p95Index];
    const p99Latency = latencies[p99Index];

    return {
      totalRequests: requests,
      successfulRequests,
      failedRequests,
      totalTime,
      averageLatency,
      minLatency,
      maxLatency,
      p95Latency,
      p99Latency,
      requestsPerSecond: successfulRequests / (totalTime / 1000),
      errorRate: (failedRequests / requests) * 100,
      memoryUsage: metrics.memoryUsed || 0,
    };
  }

  /**
   * Run sustained load test
   */
  async runSustainedLoadTest<T>(
    duration: number, // milliseconds
    requestRate: number, // requests per second
    fn: () => Promise<T>
  ): Promise<LoadTestResult> {
    const startTime = performance.now();
    const measurer = new PerformanceMeasurer();
    measurer.start();

    const results: Array<{ success: boolean; latency: number; error?: Error }> = [];
    const interval = 1000 / requestRate; // milliseconds between requests
    let requestCount = 0;
    let lastRequestTime = startTime;

    while (performance.now() - startTime < duration) {
      const currentTime = performance.now();

      if (currentTime - lastRequestTime >= interval) {
        requestCount++;
        lastRequestTime = currentTime;

        // Don't wait for the request to complete before next one
        (async () => {
          try {
            const requestStart = performance.now();
            await fn();
            const requestEnd = performance.now();
            results.push({
              success: true,
              latency: requestEnd - requestStart,
            });
          } catch (error) {
            results.push({
              success: false,
              latency: 0,
              error: error as Error,
            });
          }
        })();
      }

      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Wait for all pending requests to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const endTime = performance.now();
    const metrics = measurer.stop();

    // Calculate statistics (same as concurrent test)
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.filter(r => !r.success).length;
    const latencies = results.filter(r => r.success).map(r => r.latency);

    if (latencies.length === 0) {
      return {
        totalRequests: requestCount,
        successfulRequests: 0,
        failedRequests,
        totalTime: endTime - startTime,
        averageLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        requestsPerSecond: 0,
        errorRate: (failedRequests / requestCount) * 100,
        memoryUsage: metrics.memoryUsed || 0,
      };
    }

    latencies.sort((a, b) => a - b);
    const totalTime = endTime - startTime;
    const averageLatency = latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];

    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    const p95Latency = latencies[p95Index];
    const p99Latency = latencies[p99Index];

    return {
      totalRequests: requestCount,
      successfulRequests,
      failedRequests,
      totalTime,
      averageLatency,
      minLatency,
      maxLatency,
      p95Latency,
      p99Latency,
      requestsPerSecond: successfulRequests / (totalTime / 1000),
      errorRate: (failedRequests / requestCount) * 100,
      memoryUsage: metrics.memoryUsed || 0,
    };
  }
}

/**
 * Data generators for performance testing
 */
export class PerformanceDataGenerator {
  /**
   * Generate cache key
   */
  static generateCacheKey(index: number): string {
    return `test-key-${index}`;
  }

  /**
   * Generate test data of specified size
   */
  static generateTestData(sizeKB: number = 1): any {
    const targetSize = sizeKB * 1024; // Convert to bytes
    const baseData = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      data: '',
    };

    // Calculate approximate JSON string size and pad
    const baseJson = JSON.stringify(baseData);
    const remainingSize = targetSize - baseJson.length;

    if (remainingSize > 0) {
      baseData.data = 'x'.repeat(Math.max(0, remainingSize - 20)); // Adjust for JSON overhead
    }

    return baseData;
  }

  /**
   * Generate array of test data
   */
  static generateTestDataArray(count: number, sizeKB: number = 1): any[] {
    return Array.from({ length: count }, (_, index) =>
      this.generateTestData(sizeKB)
    );
  }

  /**
   * Generate realistic API response data
   */
  static generateApiResponse(resultCount: number = 10): any {
    return {
      results: Array.from({ length: resultCount }, (_, index) => ({
        id: `result-${index}`,
        title: `Test Result ${index}`,
        url: `https://example.com/${index}`,
        publishedDate: new Date().toISOString(),
        author: `Author ${index}`,
        text: `This is test content for result ${index}. `.repeat(10),
        score: Math.random(),
        highlights: [`Highlight ${index}`],
      })),
      totalResults: resultCount,
      query: 'test query',
      searchType: 'neural',
    };
  }
}

/**
 * Performance assertion helpers
 */
export class PerformanceAssertions {
  /**
   * Assert that performance meets minimum requirements
   */
  static assertPerformance(
    result: BenchmarkResult,
    maxAverageTime: number,
    minThroughput: number,
    maxMemoryUsage: number
  ): void {
    expect(result.averageTime).toBeLessThan(maxAverageTime);
    expect(result.throughput).toBeGreaterThan(minThroughput);
    expect(result.memoryUsage).toBeLessThan(maxMemoryUsage);
  }

  /**
   * Assert load test results meet requirements
   */
  static assertLoadTest(
    result: LoadTestResult,
    maxLatency: number,
    minRequestsPerSecond: number,
    maxErrorRate: number
  ): void {
    expect(result.averageLatency).toBeLessThan(maxLatency);
    expect(result.p95Latency).toBeLessThan(maxLatency * 2);
    expect(result.requestsPerSecond).toBeGreaterThan(minRequestsPerSecond);
    expect(result.errorRate).toBeLessThan(maxErrorRate);
    expect(result.errorRate).toBeLessThan(5); // Maximum 5% error rate
  }

  /**
   * Assert cache provides performance improvement
   */
  static assertCacheImprovement(
    cachedResult: BenchmarkResult,
    uncachedResult: BenchmarkResult,
    minImprovementRatio: number = 0.5 // 50% improvement minimum
  ): void {
    const improvementRatio = (uncachedResult.averageTime - cachedResult.averageTime) / uncachedResult.averageTime;
    expect(improvementRatio).toBeGreaterThan(minImprovementRatio);
    expect(cachedResult.throughput).toBeGreaterThan(uncachedResult.throughput);
  }
}