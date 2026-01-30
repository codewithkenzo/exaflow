import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';

// Test imports directly from source files
import {
  CircuitBreaker,
  CircuitBreakerState,
  HttpClient,
  RateLimiter,
  httpClient,
} from '../../src/util/http';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringPeriod: 5000,
    });
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should have zero failure count', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('successful execution', () => {
    it('should execute successful function calls', async () => {
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should remain in CLOSED state after successes', async () => {
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reset failure count after success', async () => {
      // Fail once
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }
      expect(circuitBreaker.getStats().failureCount).toBe(1);

      // Succeed
      await circuitBreaker.execute(async () => 'success');
      expect(circuitBreaker.getStats().failureCount).toBe(0);
    });
  });

  describe('failed execution', () => {
    it('should execute failed function calls and throw', async () => {
      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('fail');
        })
      ).rejects.toThrow('fail');
    });

    it('should increment failure count on failure', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }
      expect(circuitBreaker.getStats().failureCount).toBe(1);
    });

    it('should increment failure count on multiple failures', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      expect(circuitBreaker.getStats().failureCount).toBe(3);
    });
  });

  describe('circuit opening', () => {
    it('should OPEN circuit after reaching failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should throw immediately when circuit is OPEN', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      // Now circuit should be open
      await expect(
        circuitBreaker.execute(async () => 'success')
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Try to execute - should transition to HALF_OPEN
      try {
        await circuitBreaker.execute(async () => 'success');
      } catch {
        // May fail if not enough successes
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });

  describe('stats tracking', () => {
    it('should return accurate stats', async () => {
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');

      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats.successCount).toBeGreaterThanOrEqual(0);
      expect(stats.failureCount).toBe(1);
    });
  });
});

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient();
  });

  describe('getCircuitBreakerStats', () => {
    it('should return circuit breaker stats', () => {
      const stats = client.getCircuitBreakerStats();
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
    });
  });

  describe('fetch', () => {
    it('should throw error for invalid URL', async () => {
      // This will fail due to invalid URL, circuit breaker will open
      try {
        await client.fetch('http://invalid.invalid.invalid/test', {
          timeout: 1000,
          retries: 1,
        });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('post', () => {
    it('should make POST requests', async () => {
      // Mock the fetch to avoid actual network calls
      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true }) };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await client.post('https://api.example.com/data', { key: 'value' });
      expect(result).toEqual({ success: true });

      fetchSpy.mockRestore();
    });
  });

  describe('get', () => {
    it('should make GET requests', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'test' }) };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await client.get('https://api.example.com/data');
      expect(result).toEqual({ data: 'test' });

      fetchSpy.mockRestore();
    });
  });
});

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
  });

  describe('initial state', () => {
    it('should have zero current requests', () => {
      const stats = rateLimiter.getStats();
      expect(stats.currentRequests).toBe(0);
      expect(stats.maxRequests).toBe(10);
      expect(stats.windowMs).toBe(60000);
    });
  });

  describe('acquire', () => {
    it('should allow requests under the limit', async () => {
      await rateLimiter.acquire();
      await rateLimiter.acquire();
      await rateLimiter.acquire();

      const stats = rateLimiter.getStats();
      expect(stats.currentRequests).toBe(3);
    });

    it('should track requests correctly', async () => {
      // Fill up the rate limiter
      for (let i = 0; i < 10; i++) {
        await rateLimiter.acquire();
      }

      const stats = rateLimiter.getStats();
      expect(stats.currentRequests).toBe(10);
    });
  });

  describe('stats tracking', () => {
    it('should track current requests accurately', async () => {
      await rateLimiter.acquire();
      await rateLimiter.acquire();

      const stats = rateLimiter.getStats();
      expect(stats.currentRequests).toBe(2);
      expect(stats.maxRequests).toBe(10);
    });
  });
});

describe('Global httpClient', () => {
  it('should be an instance of HttpClient', () => {
    expect(httpClient).toBeInstanceOf(HttpClient);
  });
});
