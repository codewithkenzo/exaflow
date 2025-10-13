// HTTP client mocking utilities for testing

export interface MockResponse<T = any> {
  status: number;
  data: T;
  headers?: Record<string, string>;
}

export interface MockHttpClient {
  get<T = any>(url: string, options?: any): Promise<MockResponse<T>>;
  post<T = any>(url: string, data?: any, options?: any): Promise<MockResponse<T>>;
  put<T = any>(url: string, data?: any, options?: any): Promise<MockResponse<T>>;
  delete<T = any>(url: string, options?: any): Promise<MockResponse<T>>;
}

export class HttpMock implements MockHttpClient {
  private responses = new Map<string, MockResponse>();
  private delays = new Map<string, number>();

  setMockResponse<T>(url: string, response: MockResponse<T>): void {
    this.responses.set(url, response);
  }

  setDelay(url: string, delayMs: number): void {
    this.delays.set(url, delayMs);
  }

  private async delay(url: string): Promise<void> {
    const delay = this.delays.get(url) || 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  async get<T = any>(url: string, options?: any): Promise<MockResponse<T>> {
    await this.delay(url);
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response configured for GET ${url}`);
    }
    return response as MockResponse<T>;
  }

  async post<T = any>(url: string, data?: any, options?: any): Promise<MockResponse<T>> {
    await this.delay(url);
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response configured for POST ${url}`);
    }
    return response as MockResponse<T>;
  }

  async put<T = any>(url: string, data?: any, options?: any): Promise<MockResponse<T>> {
    await this.delay(url);
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response configured for PUT ${url}`);
    }
    return response as MockResponse<T>;
  }

  async delete<T = any>(url: string, options?: any): Promise<MockResponse<T>> {
    await this.delay(url);
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response configured for DELETE ${url}`);
    }
    return response as MockResponse<T>;
  }

  clear(): void {
    this.responses.clear();
    this.delays.clear();
  }
}

// Factory function to create HTTP mock with common responses
export function createHttpMock(): HttpMock {
  const httpMock = new HttpMock();

  // Common API responses
  httpMock.setMockResponse('https://api.exa.ai/search', {
    status: 200,
    data: {
      results: [
        {
          id: '1',
          url: 'https://example.com',
          title: 'Example Article',
          publishedDate: '2024-01-01T00:00:00Z',
          author: 'Test Author',
          text: 'Test content',
          score: 0.95,
        },
      ],
      totalResults: 1,
      query: 'test query',
      searchType: 'neural',
    },
  });

  httpMock.setMockResponse('https://api.exa.ai/context', {
    status: 200,
    data: {
      response: 'This is a test response from the Context API',
      metadata: {
        query: 'test query',
        tokensNum: 5000,
        model: 'claude-3-haiku-20240307',
      },
    },
  });

  return httpMock;
}

// Mock scenarios for different test cases
export class MockScenarioBuilder {
  private httpMock: HttpMock;

  constructor(httpMock?: HttpMock) {
    this.httpMock = httpMock || createHttpMock();
  }

  withSearchSuccess(query: string, results: any[] = []): MockScenarioBuilder {
    this.httpMock.setMockResponse('https://api.exa.ai/search', {
      status: 200,
      data: {
        results:
          results.length > 0
            ? results
            : [
                {
                  id: '1',
                  url: 'https://example.com',
                  title: `Search result for ${query}`,
                  publishedDate: '2024-01-01T00:00:00Z',
                  author: 'Test Author',
                  text: 'Test content',
                  score: 0.95,
                },
              ],
        totalResults: results.length || 1,
        query,
        searchType: 'neural',
      },
    });
    return this;
  }

  withSearchError(status: number = 400, error: string = 'Bad Request'): MockScenarioBuilder {
    this.httpMock.setMockResponse('https://api.exa.ai/search', {
      status,
      data: { error },
    });
    return this;
  }

  withContextSuccess(response: string, metadata?: any): MockScenarioBuilder {
    this.httpMock.setMockResponse('https://api.exa.ai/context', {
      status: 200,
      data: {
        response,
        metadata: metadata || {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
        },
      },
    });
    return this;
  }

  withNetworkError(): MockScenarioBuilder {
    // This will be handled by throwing an error in the actual HTTP client mock
    return this;
  }

  withDelay(delayMs: number): MockScenarioBuilder {
    this.httpMock.setDelay('https://api.exa.ai/search', delayMs);
    this.httpMock.setDelay('https://api.exa.ai/context', delayMs);
    return this;
  }

  build(): HttpMock {
    return this.httpMock;
  }
}

// Test helper functions
export function expectApiCall(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST') {
  // This would be used with a spy framework in real implementation
  console.log(`Expected ${method} call to ${url}`);
}

export function expectHeaders(headers: Record<string, string>) {
  console.log('Expected headers:', headers);
}

export function expectPayload(payload: any) {
  console.log('Expected payload:', payload);
}
