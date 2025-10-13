/**
 * HTTP Client Mocking Utilities
 * Provides utilities for mocking HTTP requests in tests
 */

import { mock } from 'bun:test';

export interface MockHttpResponse {
  status?: number;
  data?: any;
  headers?: Record<string, string>;
  error?: Error;
}

export class HttpMock {
  private responses: Map<string, MockHttpResponse[]> = new Map();
  private defaultResponse: MockHttpResponse = {
    status: 200,
    data: {},
    headers: {},
  };

  /**
   * Set a mock response for a specific URL and method
   */
  setMockResponse(
    url: string,
    method: string = 'GET',
    response: MockHttpResponse
  ): void {
    const key = `${method}:${url}`;
    if (!this.responses.has(key)) {
      this.responses.set(key, []);
    }
    this.responses.get(key)!.push(response);
  }

  /**
   * Set multiple mock responses for a URL (useful for testing retries/pagination)
   */
  setMockResponses(
    url: string,
    method: string = 'GET',
    responses: MockHttpResponse[]
  ): void {
    const key = `${method}:${url}`;
    this.responses.set(key, responses);
  }

  /**
   * Set a default response for all unmatched requests
   */
  setDefaultResponse(response: MockHttpResponse): void {
    this.defaultResponse = response;
  }

  /**
   * Get the next mock response for a URL and method
   */
  getResponse(url: string, method: string = 'GET'): MockHttpResponse {
    const key = `${method}:${url}`;
    const responses = this.responses.get(key);

    if (responses && responses.length > 0) {
      const response = responses.shift();
      if (response) {
        return response;
      }
    }

    return this.defaultResponse;
  }

  /**
   * Check if there are remaining mock responses for a URL
   */
  hasResponses(url: string, method: string = 'GET'): boolean {
    const key = `${method}:${url}`;
    const responses = this.responses.get(key);
    return responses ? responses.length > 0 : false;
  }

  /**
   * Clear all mock responses
   */
  clear(): void {
    this.responses.clear();
  }

  /**
   * Clear mock responses for a specific URL
   */
  clearUrl(url: string, method: string = 'GET'): void {
    const key = `${method}:${url}`;
    this.responses.delete(key);
  }
}

// Global HTTP mock instance
export const httpMock = new HttpMock();

// Mock HTTP client implementations
export const mockHttpClient = {
  get: mock(async (url: string, options?: any) => {
    const response = httpMock.getResponse(url, 'GET');

    if (response.error) {
      throw response.error;
    }

    return response.data;
  }),

  post: mock(async (url: string, data?: any, options?: any) => {
    const response = httpMock.getResponse(url, 'POST');

    if (response.error) {
      throw response.error;
    }

    return response.data;
  }),

  put: mock(async (url: string, data?: any, options?: any) => {
    const response = httpMock.getResponse(url, 'PUT');

    if (response.error) {
      throw response.error;
    }

    return response.data;
  }),

  delete: mock(async (url: string, options?: any) => {
    const response = httpMock.getResponse(url, 'DELETE');

    if (response.error) {
      throw response.error;
    }

    return response.data;
  }),
};

/**
 * Helper function to set up common mock scenarios
 */
export class MockScenarioBuilder {
  private httpMock: HttpMock;

  constructor(httpMock: HttpMock = httpMock) {
    this.httpMock = httpMock;
  }

  /**
   * Set up successful Exa Search API response
   */
  successfulSearch(query: string, results: any[] = []): MockScenarioBuilder {
    this.httpMock.setMockResponse('https://api.exa.ai/search', 'POST', {
      status: 200,
      data: {
        results: results.length > 0 ? results : [
          {
            id: 'mock-result-1',
            url: 'https://example.com',
            title: 'Mock Search Result',
            publishedDate: '2024-01-01T00:00:00Z',
            author: 'Mock Author',
            score: 0.95,
            text: 'Mock search result content',
          }
        ],
        totalResults: results.length || 1,
        query,
        searchType: 'neural',
      },
    });

    return this;
  }

  /**
   * Set up successful Exa Context API response
   */
  successfulContext(query: string, response: string): MockScenarioBuilder {
    this.httpMock.setMockResponse('https://api.exa.ai/context', 'POST', {
      status: 200,
      data: {
        response,
        metadata: {
          query,
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
          sources: [
            {
              url: 'https://example.com',
              title: 'Mock Source',
              snippet: 'Mock source snippet',
            }
          ],
        },
      },
    });

    return this;
  }

  /**
   * Set up successful Exa Contents API response
   */
  successfulContents(urls: string[]): MockScenarioBuilder {
    this.httpMock.setMockResponse('https://api.exa.ai/contents', 'POST', {
      status: 200,
      data: {
        results: urls.map((url, index) => ({
          id: `content-${index + 1}`,
          url,
          title: `Content from ${url}`,
          text: `Extracted content from ${url}`,
        })),
      },
    });

    return this;
  }

  /**
   * Set up API rate limit error
   */
  rateLimitError(url: string = 'https://api.exa.ai/search'): MockScenarioBuilder {
    this.httpMock.setMockResponse(url, 'POST', {
      status: 429,
      error: new Error('Rate limit exceeded'),
    });

    return this;
  }

  /**
   * Set up API authentication error
   */
  authError(url: string = 'https://api.exa.ai/search'): MockScenarioBuilder {
    this.httpMock.setMockResponse(url, 'POST', {
      status: 401,
      error: new Error('Invalid API key'),
    });

    return this;
  }

  /**
   * Set up network error
   */
  networkError(url: string = 'https://api.exa.ai/search'): MockScenarioBuilder {
    this.httpMock.setMockResponse(url, 'POST', {
      status: 0,
      error: new Error('Network error'),
    });

    return this;
  }

  /**
   * Set up retry scenario (first error, then success)
   */
  retryScenario(url: string = 'https://api.exa.ai/search'): MockScenarioBuilder {
    this.httpMock.setMockResponses(url, 'POST', [
      {
        status: 0,
        error: new Error('Temporary failure'),
      },
      {
        status: 200,
        data: {
          results: [
            {
              id: 'retry-result',
              url: 'https://example.com',
              title: 'Retry Success',
            }
          ],
          totalResults: 1,
        },
      },
    ]);

    return this;
  }
}

/**
 * Pre-configured mock scenarios
 */
export const mockScenarios = {
  searchSuccess: () => new MockScenarioBuilder()
    .successfulSearch('test query', [
      {
        id: '1',
        url: 'https://example.com',
        title: 'Test Result',
        publishedDate: '2024-01-01T00:00:00Z',
        author: 'Test Author',
        score: 0.95,
      }
    ]),

  contextSuccess: () => new MockScenarioBuilder()
    .successfulContext('test query', 'Test context response'),

  contentsSuccess: () => new MockScenarioBuilder()
    .successfulContents(['https://example.com', 'https://test.org']),

  rateLimit: () => new MockScenarioBuilder()
    .rateLimitError(),

  authError: () => new MockScenarioBuilder()
    .authError(),

  networkError: () => new MockScenarioBuilder()
    .networkError(),

  retrySuccess: () => new MockScenarioBuilder()
    .retryScenario(),
};

/**
 * Test helper to set up mocks before each test
 */
export function setupHttpMocks(scenario: () => MockScenarioBuilder): void {
  // Clear existing mocks
  httpMock.clear();

  // Set up the scenario
  scenario();

  // Mock the HTTP client module
  mock.module('../src/util/http', () => ({
    httpClient: mockHttpClient,
  }));
}

/**
 * Test helper to verify mock usage
 */
export function verifyMocks() {
  expect(mockHttpClient.get).toHaveBeenCalled();
  expect(mockHttpClient.post).toHaveBeenCalled();
}

/**
 * Test helper to reset all mocks
 */
export function resetMocks(): void {
  httpMock.clear();
  mock.httpClient.get.mockClear();
  mock.httpClient.post.mockClear();
  mock.httpClient.put.mockClear();
  mock.httpClient.delete.mockClear();
}