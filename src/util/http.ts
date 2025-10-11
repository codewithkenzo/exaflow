export interface HttpOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
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
        throw new Error("Circuit breaker is OPEN");
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
      if (this.successCount >= 3) { // Need 3 successes to close
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

  constructor(circuitBreakerOptions?: Partial<CircuitBreakerOptions>) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      ...circuitBreakerOptions,
    });
  }

  async fetch(
    url: string,
    options: HttpOptions & { body?: string; method?: string } = {}
  ): Promise<Response> {
    const {
      timeout = 30000,
      retries = 3,
      headers = {},
      body,
      method = "GET",
      signal,
    } = options;

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
          signal.addEventListener("abort", () => {
            controller.abort();
          });
        }

        try {
          const response = await fetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "exa-personal-tool/1.0.0",
              ...headers,
            },
            body,
            signal: controller.signal,
          });

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

      throw lastError || new Error("Unknown error occurred");
    });
  }

  async post<T = any>(
    url: string,
    data: any,
    options: HttpOptions = {}
  ): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    });

    return response.json() as Promise<T>;
  }

  async get<T = any>(url: string, options: HttpOptions = {}): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      method: "GET",
    });

    return response.json() as Promise<T>;
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
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
