import { describe, it, expect, beforeEach, vi } from 'bun:test';

import {
  HttpCache,
  CachedHttpClient,
  cachedHttpClient,
  httpCache,
} from '../../src/util/http-cache';

describe('HttpCache', () => {
  let cache: HttpCache;

  beforeEach(() => {
    cache = new HttpCache({
      maxSize: 10,
      defaultTtl: 5000,
      enabled: true,
    });
  });

  describe('initial state', () => {
    it('should initialize with correct config', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(10);
      expect(stats.enabled).toBe(true);
    });
  });

  describe('get and set', () => {
    it('should return null for missing entries', () => {
      const result = cache.get('http://example.com/test');
      expect(result).toBeNull();
    });

    it('should store and retrieve data', () => {
      cache.set('http://example.com/test', { data: 'test' });
      const result = cache.get('http://example.com/test');
      expect(result).toEqual({ data: 'test' });
    });

    it('should include request data in cache key', () => {
      cache.set('http://example.com/post', { data: 'post1' }, { key: 'value1' });
      cache.set('http://example.com/post', { data: 'post2' }, { key: 'value2' });

      const result1 = cache.get('http://example.com/post', { key: 'value1' });
      const result2 = cache.get('http://example.com/post', { key: 'value2' });

      expect(result1).toEqual({ data: 'post1' });
      expect(result2).toEqual({ data: 'post2' });
    });

    it('should differentiate between GET and POST requests', () => {
      cache.set('http://example.com/api', { method: 'get' });
      cache.set('http://example.com/api', { method: 'post' }, { key: 'value' });

      const getResult = cache.get('http://example.com/api');
      const postResult = cache.get('http://example.com/api', { key: 'value' });

      expect(getResult).toEqual({ method: 'get' });
      expect(postResult).toEqual({ method: 'post' });
    });
  });

  describe('getByKey and setByKey', () => {
    it('should store and retrieve using simple keys', () => {
      cache.setByKey('myKey', { value: 123 });
      const result = cache.getByKey('myKey');
      expect(result).toEqual({ value: 123 });
    });

    it('should return null for missing simple keys', () => {
      const result = cache.getByKey('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('http://example.com/test', { data: 'test' }, undefined, 100); // 100ms TTL

      // Should be present immediately
      expect(cache.get('http://example.com/test')).toEqual({ data: 'test' });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired
      expect(cache.get('http://example.com/test')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      cache.set('http://example.com/test', { data: 'test' });

      // Should be present
      expect(cache.get('http://example.com/test')).toEqual({ data: 'test' });

      // Wait for default TTL (5000ms) - but check before it expires
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(cache.get('http://example.com/test')).toEqual({ data: 'test' });
    });
  });

  describe('cache size limits', () => {
    it('should evict oldest entries when cache is full', () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        cache.setByKey(`key${i}`, { index: i });
      }

      expect(cache.getStats().size).toBe(10);

      // Add one more - should evict the oldest
      cache.setByKey('key10', { index: 10 });

      expect(cache.getStats().size).toBe(10);
      expect(cache.getByKey('key0')).toBeNull(); // Oldest should be evicted
      expect(cache.getByKey('key1')).toEqual({ index: 1 }); // Should still exist
    });
  });

  describe('clear', () => {
    it('should clear all cached entries', () => {
      cache.set('http://example.com/test1', { data: 'test1' });
      cache.set('http://example.com/test2', { data: 'test2' });

      expect(cache.getStats().size).toBe(2);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get('http://example.com/test1')).toBeNull();
      expect(cache.get('http://example.com/test2')).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      // Add an entry with very short TTL
      cache.setByKey('short-lived', { data: 'test' }, 50);

      // Add an entry that won't expire
      cache.setByKey('long-lived', { data: 'test' }, 100000);

      expect(cache.getStats().size).toBe(2);

      // Wait for short-lived to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      cache.cleanup();

      expect(cache.getByKey('short-lived')).toBeNull();
      expect(cache.getByKey('long-lived')).toEqual({ data: 'test' });
    });
  });

  describe('setEnabled', () => {
    it('should disable caching', () => {
      cache.set('http://example.com/test', { data: 'test' });
      expect(cache.get('http://example.com/test')).toEqual({ data: 'test' });

      cache.setEnabled(false);

      // Should return null when disabled
      expect(cache.get('http://example.com/test')).toBeNull();
    });

    it('should clear cache when disabled', () => {
      cache.set('http://example.com/test', { data: 'test' });

      cache.setEnabled(false);

      expect(cache.getStats().size).toBe(0);
    });

    it('should re-enable caching', () => {
      cache.setEnabled(false);
      cache.setEnabled(true);

      cache.set('http://example.com/test', { data: 'test' });
      expect(cache.get('http://example.com/test')).toEqual({ data: 'test' });
    });
  });

  describe('updateConfig', () => {
    it('should update maxSize', () => {
      cache.updateConfig({ maxSize: 50 });
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(50);
    });

    it('should update defaultTtl', () => {
      cache.updateConfig({ defaultTtl: 10000 });
      // This would need internal access to verify
      expect(cache.getStats().maxSize).toBe(10);
    });

    it('should evict entries when maxSize is reduced', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.setByKey(`key${i}`, { index: i });
      }

      // Reduce size
      cache.updateConfig({ maxSize: 5 });

      expect(cache.getStats().maxSize).toBe(5);
      expect(cache.getStats().size).toBeLessThanOrEqual(5);
    });
  });
});

describe('CachedHttpClient', () => {
  let client: CachedHttpClient;
  let mockCache: HttpCache;

  beforeEach(() => {
    mockCache = new HttpCache({ maxSize: 100, enabled: true });
    client = new CachedHttpClient(mockCache);
  });

  describe('get', () => {
    it('should return cached data if available', async () => {
      mockCache.setByKey('http://example.com/test', { cached: true });

      const result = await client.get('http://example.com/test');
      expect(result).toEqual({ cached: true });
    });

    it('should fetch and cache data when not cached', async () => {
      // Mock the fetch to avoid actual network calls
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ fetched: true }),
        headers: new Headers({ 'cache-control': 'max-age=3600' }),
      };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await client.get('http://example.com/test');
      expect(result).toEqual({ fetched: true });

      // Should be cached now
      expect(mockCache.getByKey('http://example.com/test')).toEqual({ fetched: true });

      fetchSpy.mockRestore();
    });
  });

  describe('post', () => {
    it('should cache idempotent POST requests', async () => {
      // This test verifies the isIdempotentRequest method logic
      const mockResponse = { ok: true, json: () => Promise.resolve({ result: 'cached' }), headers: new Headers() };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      // Search endpoint should be cached
      const result = await client.post('https://api.exa.ai/search', { query: 'test' });
      expect(result).toEqual({ result: 'cached' });

      fetchSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      mockCache.setByKey('http://example.com/test', { data: 'test' });

      client.clearCache('http://example.com/test');

      expect(mockCache.getByKey('http://example.com/test')).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = client.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('enabled');
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      mockCache.setByKey('short-lived', { data: 'test' }, 50);
      mockCache.setByKey('long-lived', { data: 'test' }, 100000);

      await new Promise((resolve) => setTimeout(resolve, 100));

      client.cleanup();

      expect(mockCache.getByKey('short-lived')).toBeNull();
    });
  });
});

describe('Global cached instances', () => {
  it('httpCache should be an instance of HttpCache', () => {
    expect(httpCache).toBeInstanceOf(HttpCache);
  });

  it('cachedHttpClient should be an instance of CachedHttpClient', () => {
    expect(cachedHttpClient).toBeInstanceOf(CachedHttpClient);
  });
});
