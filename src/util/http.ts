export interface HttpOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Type for HTTP response data
 */
export type HttpResponseData = unknown;

// Connection pool configuration
export interface PoolConfig {
  /** Maximum number of connections per origin */
  maxConnectionsPerOrigin?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Keep alive timeout in milliseconds */
  keepAliveTimeout?: number;
  /** Maximum idle connections per origin */
  maxIdleConnections?: number;
}

// Default pool configuration
const DEFAULT_POOL_CONFIG: PoolConfig = {
  maxConnectionsPerOrigin: 10,
  connectionTimeout: 10000,
  keepAliveTimeout: 60000,
  maxIdleConnections: 5,
};

/**
 * Connection Pool Manager using undici for efficient HTTP connection pooling
 */
export class ConnectionPool {
  private pool: Map<string, unknown> = new Map(); // Using unknown for undici Pool type
  private config: PoolConfig;

  constructor(config: PoolConfig = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /**
   * Get or create a connection pool for a specific origin
   */
  private getPool(origin: string): unknown {
    if (!this.pool.has(origin)) {
      // Dynamic import to avoid issues in environments without undici
      let Pool: unknown;
      try {
        const undici = require('undici');
        Pool = new undici.Pool(origin, {
          connections: this.config.maxConnectionsPerOrigin,
          timeout: this.config.connectionTimeout,
          keepAlive: true,
        });
      } catch {
        // Fallback if undici is not available
        return null;
      }

      this.pool.set(origin, Pool);
    }

    return this.pool.get(origin);
  }

  /**
   * Execute a request using connection pooling
   */
  async request(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
    } = {}
  ): Promise<any> {
    const pool = this.getPool(new URL(url).origin);

    if (!pool) {
      // Fallback to regular fetch if pool is not available
      return fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        signal: options.signal,
      });
    }

    return pool.request({
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    });
  }

  /**
   * Close all pools and clear the pool map
   */
  async close(): Promise<void> {
    for (const pool of this.pool.values()) {
      if (pool && typeof pool.close === 'function') {
        await pool.close();
      }
    }
    this.pool.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): { poolCount: number; poolSizes: Record<string, number> } {
    const sizes: Record<string, number> = {};

    for (const [origin, pool] of this.pool.entries()) {
      // Try to get pool size if available
      sizes[origin] = pool?.size || 0;
    }

    return {
      poolCount: this.pool.size,
      poolSizes: sizes,
    };
  }

  /**
   * Get the current configuration
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }
}

// Global connection pool instance
export const connectionPool = new ConnectionPool();

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.options.resetTimeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = CircuitBreakerState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        // Need 3 successes to close
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): { state: CircuitBreakerState; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

export class HttpClient {
  private circuitBreaker: CircuitBreaker;
  private pool: ConnectionPool;
  private usePooling: boolean;

  constructor(
    circuitBreakerOptions?: Partial<CircuitBreakerOptions>,
    poolConfig?: PoolConfig,
    usePooling: boolean = true
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      ...circuitBreakerOptions,
    });
    this.pool = new ConnectionPool(poolConfig);
    this.usePooling = usePooling;
  }

  async fetch(
    url: string,
    options: HttpOptions & { body?: string; method?: string } = {}
  ): Promise<Response> {
    const { timeout = 30000, retries = 3, headers = {}, body, method = 'GET', signal } = options;

    return this.circuitBreaker.execute(async () => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();

        // Set up timeout
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        // Chain external signal if provided
        if (signal) {
          signal.addEventListener('abort', () => {
            controller.abort();
          });
        }

        try {
          let response: Response;

          if (this.usePooling) {
            // Use connection pooling
            const requestHeaders = {
              'Content-Type': 'application/json',
              'User-Agent': 'exa-personal-tool/1.0.0',
              ...headers,
            };

            const undiciResponse = await this.pool.request(url, {
              method,
              headers: requestHeaders,
              body,
              signal: controller.signal,
            });

            // Convert undici response to fetch Response
            // Handle undici response which might have different structure
            const body = undiciResponse.body || null;
            response = new Response(body, {
              status: undiciResponse.statusCode || 200,
              statusText: undiciResponse.reasonPhrase || 'OK',
              headers: (undiciResponse.headers as HeadersInit) || {},
            });
          } else {
            // Fallback to regular fetch
            response = await fetch(url, {
              method,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'exa-personal-tool/1.0.0',
                ...headers,
              },
              body,
              signal: controller.signal,
            });
          }

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < retries) {
            // Exponential backoff with jitter
            const baseDelay = Math.pow(2, attempt) * 1000;
            const jitter = Math.random() * 1000;
            const delay = baseDelay + jitter;

            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error('Unknown error occurred');
    });
  }

  async post<T>(url: string, data: unknown, options: HttpOptions = {}): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });

    return response.json() as Promise<T>;
  }

  async get<T>(url: string, options: HttpOptions = {}): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      method: 'GET',
    });

    return response.json() as Promise<T>;
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  getPoolStats() {
    return this.pool.getStats();
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.close();
  }
}

// Rate limiter implementation
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requests.push(now);
  }

  getStats(): { currentRequests: number; maxRequests: number; windowMs: number } {
    const now = Date.now();
    const currentRequests = this.requests.filter(time => now - time < this.windowMs).length;

    return {
      currentRequests,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
    };
  }
}

// Global HTTP client instance
export const httpClient = new HttpClient();
