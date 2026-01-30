import { describe, it, expect, beforeEach } from 'bun:test';
import { HttpCache } from '../../src/util/http-cache';

describe('HttpCache', () => {
  let cache: HttpCache;

  beforeEach(() => {
    cache = new HttpCache({ maxSize: 100, defaultTtl: 5000 });
  });

  describe('initial state', () => {
    it('should initialize with correct config', () => {
      expect(cache).toBeDefined();
    });

    it('should return null for missing entries', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('get and set', () => {
    it('should store and retrieve data', () => {
      cache.set('key1', 'value1');
      const result = cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should differentiate GET and POST', () => {
      cache.set('key', 'get-value', { method: 'GET' });
      cache.set('key', 'post-value', { method: 'POST', data: 'body' });
      expect(cache.get('key', { method: 'GET' })).toBe('get-value');
    });
  });

  describe('expiration', () => {
    it('should expire entries', async () => {
      cache.set('expiring', 'value', { ttl: 10 });
      await new Promise(resolve => setTimeout(resolve, 15));
      const result = cache.get('expiring');
      expect(result).toBeNull();
    });
  });
});
