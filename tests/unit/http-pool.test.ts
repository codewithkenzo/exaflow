import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import {
  ConnectionPool,
  PoolConfig,
  HttpClient,
  httpClient,
} from '../../src/util/http';

describe('ConnectionPool', () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxConnectionsPerOrigin: 5,
      connectionTimeout: 5000,
      keepAliveTimeout: 30000,
      maxIdleConnections: 2,
    });
  });

  afterEach(async () => {
    await pool.close();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultPool = new ConnectionPool();
      const config = defaultPool.getConfig();

      expect(config.maxConnectionsPerOrigin).toBe(10);
      expect(config.connectionTimeout).toBe(10000);
      expect(config.keepAliveTimeout).toBe(60000);
      expect(config.maxIdleConnections).toBe(5);

      defaultPool.close();
    });

    it('should accept custom configuration', () => {
      const config = pool.getConfig();

      expect(config.maxConnectionsPerOrigin).toBe(5);
      expect(config.connectionTimeout).toBe(5000);
      expect(config.keepAliveTimeout).toBe(30000);
      expect(config.maxIdleConnections).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return initial empty stats', () => {
      const stats = pool.getStats();

      expect(stats.poolCount).toBe(0);
      expect(stats.poolSizes).toEqual({});
    });
  });

  describe('close', () => {
    it('should close all pools', async () => {
      await pool.close();

      const stats = pool.getStats();
      expect(stats.poolCount).toBe(0);
    });

    it('should handle multiple close calls', async () => {
      await pool.close();
      await pool.close(); // Should not throw

      const stats = pool.getStats();
      expect(stats.poolCount).toBe(0);
    });
  });
});

describe('HttpClient with Connection Pooling', () => {
  describe('without pooling (usePooling=false)', () => {
    let client: HttpClient;

    beforeEach(() => {
      client = new HttpClient(undefined, { maxConnectionsPerOrigin: 5 }, false);
    });

    afterEach(async () => {
      await client.close();
    });

    it('should return pool statistics', () => {
      const stats = client.getPoolStats();

      expect(stats).toHaveProperty('poolCount');
      expect(stats).toHaveProperty('poolSizes');
    });

    it('should have circuit breaker stats available', () => {
      const stats = client.getCircuitBreakerStats();

      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
    });

    it('should handle successful fetch with mocked response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ success: true }),
      };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const response = await client.fetch('https://api.exa.ai/search', {
        method: 'GET',
      });

      expect(response).toBeDefined();
      expect(response.ok).toBe(true);

      fetchSpy.mockRestore();
    });

    it('should throw on HTTP error', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockErrorResponse as unknown as Response);

      await expect(
        client.fetch('https://api.exa.ai/search', { method: 'GET', retries: 0, timeout: 1000 })
      ).rejects.toThrow('HTTP 500: Internal Server Error');

      fetchSpy.mockRestore();
    });

    it('should make GET requests and parse JSON', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ results: ['test1', 'test2'] }),
      };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await client.get('https://api.exa.ai/search');

      expect(result).toEqual({ results: ['test1', 'test2'] });

      fetchSpy.mockRestore();
    });

    it('should make POST requests and parse JSON', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ id: '123' }),
      };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await client.post('https://api.exa.ai/search', { query: 'test' });

      expect(result).toEqual({ id: '123' });

      fetchSpy.mockRestore();
    });
  });

  describe('with pooling (usePooling=true)', () => {
    let client: HttpClient;

    beforeEach(() => {
      client = new HttpClient(undefined, { maxConnectionsPerOrigin: 5 }, true);
    });

    afterEach(async () => {
      await client.close();
    });

    it('should return pool statistics', () => {
      const stats = client.getPoolStats();

      expect(stats).toHaveProperty('poolCount');
      expect(stats).toHaveProperty('poolSizes');
    });
  });
});

describe('Global httpClient', () => {
  it('should have connection pooling enabled', () => {
    expect(httpClient).toBeInstanceOf(HttpClient);
  });

  it('should return pool stats', () => {
    const stats = httpClient.getPoolStats();
    expect(stats).toHaveProperty('poolCount');
  });

  it('should return circuit breaker stats', () => {
    const stats = httpClient.getCircuitBreakerStats();
    expect(stats).toHaveProperty('state');
  });
});
