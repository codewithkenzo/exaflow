import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { HttpCache } from '../../src/util/http-cache';

describe('HttpCache', () => {
  let cache: HttpCache;

  beforeEach(() => {
    cache = new HttpCache();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(cache).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxSize: 50,
        defaultTtl: 60000,
        enabled: false,
      };
      const customCache = new HttpCache(customConfig);
      expect(customCache).toBeDefined();
    });
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cached data', () => {
      const key = 'test-key';
      const data = { result: 'test data' };

      cache.setByKey(key, data, 300000); // 5 minutes
      const retrieved = cache.getByKey(key);

      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent key', () => {
      const result = cache.getByKey('non-existent-key');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      const key = 'test-key';
      const data = { result: 'test data' };

      cache.setByKey(key, data, 100); // 100ms TTL

      // Should be available immediately
      expect(cache.getByKey(key)).toEqual(data);

      // Should be null after TTL expires
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.getByKey(key)).toBeNull();
    });

    it('should delete entry when TTL expires', async () => {
      const key = 'test-key';
      const data = { result: 'test data' };

      cache.setByKey(key, data, 50); // 50ms TTL
      expect(cache.getByKey(key)).toEqual(data);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.getByKey(key)).toBeNull();
    });
  });

  describe('Size Management', () => {
    it('should respect max size limit', () => {
      const smallCache = new HttpCache({ maxSize: 2 });

      // Fill cache to capacity
      smallCache.setByKey('key1', 'data1');
      smallCache.setByKey('key2', 'data2');
      smallCache.setByKey('key3', 'data3'); // Should evict oldest

      expect(smallCache.getByKey('key1')).toBeNull();
      expect(smallCache.getByKey('key2')).toBe('data2');
      expect(smallCache.getByKey('key3')).toBe('data3');
    });

    it('should use simple eviction policy (oldest first)', () => {
      const smallCache = new HttpCache({ maxSize: 2 });

      smallCache.setByKey('key1', 'data1');
      smallCache.setByKey('key2', 'data2');

      // Access key1 to make it recently used
      smallCache.getByKey('key1');

      // Add key3, should evict key1 (oldest inserted)
      smallCache.setByKey('key3', 'data3');

      expect(smallCache.getByKey('key1')).toBeNull();
      expect(smallCache.getByKey('key2')).toBe('data2');
      expect(smallCache.getByKey('key3')).toBe('data3');
    });
  });

  describe('Key Generation', () => {
    it('should handle URL-based operations', () => {
      // Test that URL-based operations work
      const url = 'https://api.exa.ai/search';
      const data = { query: 'test' };

      cache.set(url, data, data, 300000);
      const retrieved = cache.get(url, data);
      expect(retrieved).toEqual(data);
    });
  });

  describe('Cache Statistics', () => {
    it('should report initial statistics', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBeGreaterThan(0);
      expect(stats.enabled).toBe(true);
    });

    it('should update size on cache operations', () => {
      const key = 'test-key';
      const data = { result: 'test data' };

      cache.setByKey(key, data);
      const stats = cache.getStats();
      expect(stats.size).toBe(1);

      cache.clear();
      const clearedStats = cache.getStats();
      expect(clearedStats.size).toBe(0);
    });
  });

  describe('Cache Validation', () => {
    it('should validate entries through normal operations', () => {
      const key = 'test-key';
      const data = { result: 'test data' };

      cache.setByKey(key, data, 300000);
      const retrieved = cache.getByKey(key);
      expect(retrieved).toEqual(data); // Valid entry should be returned
    });

    it('should invalidate expired entries', async () => {
      const key = 'test-key';
      const data = { result: 'test data' };

      cache.setByKey(key, data, 50);
      await new Promise(resolve => setTimeout(resolve, 100));

      const retrieved = cache.getByKey(key);
      expect(retrieved).toBeNull(); // Expired entry should return null
    });
  });

  describe('Cache Cleanup', () => {
    it('should clear all entries', () => {
      cache.setByKey('key1', 'data1');
      cache.setByKey('key2', 'data2');
      cache.setByKey('key3', 'data3');

      expect(cache.getByKey('key1')).toBe('data1');
      expect(cache.getByKey('key2')).toBe('data2');
      expect(cache.getByKey('key3')).toBe('data3');

      cache.clear();

      expect(cache.getByKey('key1')).toBeNull();
      expect(cache.getByKey('key2')).toBeNull();
      expect(cache.getByKey('key3')).toBeNull();
    });

    it('should clean up expired entries', async () => {
      cache.setByKey('key1', 'data1', 50); // 50ms TTL
      cache.setByKey('key2', 'data2', 300000); // 5 minutes TTL

      await new Promise(resolve => setTimeout(resolve, 100));

      cache.cleanup();

      expect(cache.getByKey('key1')).toBeNull();
      expect(cache.getByKey('key2')).toBe('data2');
    });
  });

  describe('Enable/Disable', () => {
    it('should respect enabled flag', () => {
      const enabledCache = new HttpCache({ enabled: true });
      const disabledCache = new HttpCache({ enabled: false });

      enabledCache.setByKey('key', 'data');
      disabledCache.setByKey('key', 'data');

      expect(enabledCache.getByKey('key')).toBe('data');
      expect(disabledCache.getByKey('key')).toBeNull();
    });

    it('should allow dynamic enable/disable', () => {
      const cache = new HttpCache({ enabled: true });

      cache.setByKey('key', 'data');
      expect(cache.getByKey('key')).toBe('data');

      cache.setEnabled(false);
      expect(cache.getByKey('key')).toBeNull();

      cache.setEnabled(true);
      expect(cache.getByKey('key')).toBeNull(); // Entry was cleared when disabled
    });
  });
});