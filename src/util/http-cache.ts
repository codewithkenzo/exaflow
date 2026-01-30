/**
 * HTTP Client with Caching Support
 * Provides caching capabilities to improve performance for repeated requests
 */

// Define RequestOptions locally to avoid circular dependencies
interface HttpOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

// Import connection pool for HTTP/2 support and connection pooling
let Pool: any;
try {
  Pool = require('undici').Pool;
} catch {
  Pool = null;
}

// Global connection pool instance
const globalPool = Pool ? new Pool('https://api.exa.ai', { connections: 10 }) : null;

interface CacheEntry {
  data: any;
  timestamp: number;
  etag?: string;
  expiresAt?: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTtl: number; // Time to live in milliseconds
  enabled: boolean;
}

/**
 * Simple in-memory cache for HTTP responses
 */
export class HttpCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100,
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      ...config,
    };
  }

  /**
   * Generate a cache key from URL and request data
   */
  private generateKey(url: string, data?: any): string {
    const dataHash = data ? JSON.stringify(data) : '';
    return `${url}:${dataHash}`;
  }

  /**
   * Check if a cache entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      return false;
    }
    return true;
  }

  /**
   * Get cached response
   */
  get(url: string, data?: any): any | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(url, data);
    const entry = this.cache.get(key);

    if (!entry || !this.isValid(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Get cached data using a simple key (for testing)
   */
  getByKey(key: string): any | null {
    if (!this.config.enabled) {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry || !this.isValid(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store response in cache
   */
  set(url: string, data: any, requestData?: any, ttl?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(url, requestData);

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : Date.now() + this.config.defaultTtl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Store data in cache using a simple key (for testing)
   */
  setByKey(key: string, data: any, ttl?: number): void {
    if (!this.config.enabled) {
      return;
    }

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : Date.now() + this.config.defaultTtl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      enabled: this.config.enabled,
    };
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    // Clear cache if size was reduced
    if (this.config.maxSize < this.cache.size) {
      const entries = Array.from(this.cache.entries());
      this.cache.clear();

      // Keep only the most recent entries up to new max size
      const recentEntries = entries
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, this.config.maxSize);

      for (const [key, entry] of recentEntries) {
        this.cache.set(key, entry);
      }
    }
  }
}

// Global cache instance
export const httpCache = new HttpCache();

/**
 * Enhanced HTTP client with caching support
 */
export class CachedHttpClient {
  private cache: HttpCache;
  private pool: any;

  constructor(cache?: HttpCache) {
    this.cache = cache || httpCache;
    this.pool = globalPool;
  }

  /**
   * HTTP GET with caching
   */
  async get(url: string, options?: HttpOptions): Promise<any> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }

    // Make actual request using connection pool
    let response: Response;

    if (this.pool) {
      const undiciResponse = await this.pool.request({
        method: 'GET',
        path: new URL(url).pathname,
        headers: {
          'User-Agent': 'ExaFlow/2.0.0',
          ...options?.headers,
        },
        signal: options?.signal,
      });

      response = new Response(undiciResponse.body, {
        status: undiciResponse.statusCode,
        statusText: undiciResponse.reasonPhrase,
        headers: undiciResponse.headers as HeadersInit,
      });
    } else {
      // Fallback to regular fetch
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'ExaFlow/2.0.0',
          ...options?.headers,
        },
        signal: options?.signal,
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Cache the response if it was successful
    if (response.ok) {
      const cacheControl = response.headers.get('cache-control');
      let ttl: number | undefined;

      if (cacheControl) {
        // Parse Cache-Control header for TTL
        const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
          ttl = parseInt(maxAgeMatch[1]) * 1000; // Convert to milliseconds
        }
      }

      this.cache.set(url, data, undefined, ttl);
    }

    return data;
  }

  /**
   * HTTP POST with selective caching
   */
  async post(url: string, data?: any, options?: HttpOptions): Promise<any> {
    // For POST requests, only cache idempotent operations (safe to retry)
    const isIdempotent = this.isIdempotentRequest(url, data);

    if (isIdempotent) {
      const cached = this.cache.get(url, data);
      if (cached) {
        return cached;
      }
    }

    // Make actual request using connection pool
    let response: Response;

    if (this.pool) {
      const undiciResponse = await this.pool.request({
        method: 'POST',
        path: new URL(url).pathname,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ExaFlow/2.0.0',
          ...options?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: options?.signal,
      });

      response = new Response(undiciResponse.body, {
        status: undiciResponse.statusCode,
        statusText: undiciResponse.reasonPhrase,
        headers: undiciResponse.headers as HeadersInit,
      });
    } else {
      // Fallback to regular fetch
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ExaFlow/2.0.0',
          ...options?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: options?.signal,
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();

    // Cache idempotent POST responses
    if (response.ok && isIdempotent) {
      this.cache.set(url, responseData, data);
    }

    return responseData;
  }

  /**
   * Determine if a request is idempotent (safe to cache)
   */
  private isIdempotentRequest(url: string, data?: any): boolean {
    // Search and context requests are generally idempotent
    const idempotentPatterns = ['/search', '/context'];

    return idempotentPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Clear cache for a specific URL
   */
  clearCache(url?: string): void {
    if (url) {
      // Implementation would need to support clearing by pattern
      // For now, we'll clear the entire cache
      this.cache.clear();
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    this.cache.cleanup();
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): { available: boolean; poolSize?: number } {
    return {
      available: !!this.pool,
      poolSize: this.pool?.size || 0,
    };
  }
}

// Export cached HTTP client instance
export const cachedHttpClient = new CachedHttpClient();

/**
 * Automatic cache cleanup interval (5 minutes)
 */
setInterval(
  () => {
    httpCache.cleanup();
  },
  5 * 60 * 1000
);
