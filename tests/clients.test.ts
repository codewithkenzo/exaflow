#!/usr/bin/env bun

/**
 * Unit Tests for Exa Client Classes
 * Tests for ExaContextClient, ExaSearchClient, and BaseExaClient
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ExaContextClient } from '../src/clients/exa-context';
import { ExaSearchClient } from '../src/clients/exa-search';
import { BaseExaClient } from '../src/clients/base-client';
import { httpClient } from '../src/util/http';

// Mock HTTP client
mock.module('../src/util/http', () => ({
  httpClient: {
    post: mock(async () => ({})),
    get: mock(async () => ({})),
  },
}));

// Mock environment
mock.module('../src/env', () => ({
  getEnv: () => ({ EXA_API_KEY: 'test-api-key' }),
}));

// Mock streaming utilities
mock.module('../src/util/streaming', () => ({
  createEventStreamer: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    failed: mock(),
    started: mock(),
    completed: mock(),
    apiRequest: mock(),
    apiResponse: mock(),
    asyncStarted: mock(),
    asyncPolling: mock(),
    asyncCompleted: mock(),
    batchStarted: mock(),
    batchCompleted: mock(),
  }),
}));

// Create a concrete implementation of BaseExaClient for testing
class TestClient extends BaseExaClient {
  async executeTask(task: any) {
    return { status: 'success', taskId: 'test', data: null };
  }
}

describe('BaseExaClient', () => {
  let client: BaseExaClient;

  beforeEach(() => {
    client = new TestClient('test-api-key');
  });

  describe('API Key Management', () => {
    it('should use provided API key', () => {
      const client = new TestClient('provided-key');
      expect((client as any).apiKey).toBe('provided-key');
    });

    it('should get API key from environment when not provided', () => {
      const client = new TestClient();
      expect((client as any).getApiKey()).toBe('test-api-key');
    });

    it('should throw error when no API key is available for required operations', () => {
      // Mock environment to return undefined
      mock.module('../src/env', () => ({
        getEnv: () => ({ EXA_API_KEY: undefined }),
      }));

      const client = new TestClient();
      expect(() => (client as any).requireApiKey('Test API')).toThrow('EXA_API_KEY is required for Test API');
    });
  });

  describe('Result Envelope Creation', () => {
    it('should create a success result envelope', () => {
      const startTime = Date.now() - 100; // Set start time in the past to ensure positive duration
      const testData = { result: 'test' };
      const citations = [{ url: 'https://example.com', title: 'Example' }];

      const result = (client as any).createResultEnvelope(
        'success',
        'test-task',
        startTime,
        citations,
        testData
      );

      expect(result.status).toBe('success');
      expect(result.taskId).toBe('test-task');
      expect(result.citations).toEqual(citations);
      expect(result.data).toEqual(testData);
      expect(result.timing).toBeDefined();
      expect(result.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should create an error result envelope', () => {
      const startTime = Date.now();
      const fallbackData = { error: 'fallback' };

      const result = (client as any).createErrorResult(
        'test-task',
        startTime,
        'TEST_ERROR',
        'Test error message',
        fallbackData
      );

      expect(result.status).toBe('error');
      expect(result.taskId).toBe('test-task');
      expect(result.data).toEqual(fallbackData);
      expect(result.error).toEqual({
        code: 'TEST_ERROR',
        message: 'Test error message',
      });
    });
  });

  describe('Task Validation', () => {
    it('should validate task using schema', () => {
      const mockSchema = {
        parse: mock((data) => data),
      };

      const task = { type: 'test', query: 'test query' };
      const validated = (client as any).validateTask(task, mockSchema);

      expect(validated).toEqual(task);
      expect(mockSchema.parse).toHaveBeenCalledWith(task);
    });

    it('should get task ID with fallback', () => {
      const taskId1 = (client as any).getTaskId('custom-id', 'test');
      expect(taskId1).toBe('custom-id');

      const taskId2 = (client as any).getTaskId(undefined, 'test');
      expect(taskId2).toMatch(/^test-\d+$/);
    });
  });
});

describe('ExaContextClient', () => {
  let client: ExaContextClient;

  beforeEach(() => {
    client = new ExaContextClient('test-api-key');
  });

  describe('getContext', () => {
    it('should send context API request with correct parameters', async () => {
      const mockResponse = {
        response: 'Test response',
        metadata: {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
          sources: [
            {
              url: 'https://example.com',
              title: 'Example',
              snippet: 'Example snippet',
            },
          ],
        },
      };

      httpClient.post.mockResolvedValue(mockResponse);

      const result = await client.getContext('test query', 5000, 'test-task');

      expect(httpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/context',
        { query: 'test query', tokensNum: 5000 },
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
          },
        })
      );

      expect(result.status).toBe('success');
      expect(result.data.response).toBe('Test response');
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].url).toBe('https://example.com');
    });

    it('should handle API errors gracefully', async () => {
      httpClient.post.mockRejectedValue(new Error('Network error'));

      const result = await client.getContext('test query', 5000, 'test-task');

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('CONTEXT_API_ERROR');
      expect(result.error?.message).toBe('Network error');
      expect(result.data.response).toBe('');
    });

    it('should require API key', async () => {
      const client = new ExaContextClient();

      await expect(client.getContext('test query')).rejects.toThrow(
        'EXA_API_KEY is required for Context API'
      );
    });
  });

  describe('query utility method', () => {
    it('should use getContext with default options', async () => {
      const mockResult = {
        status: 'success',
        data: { response: 'test response' },
      };

      // Clear previous mock and set up new one
      httpClient.post.mockResolvedValue({
        response: 'test response',
        metadata: { query: 'test query', tokensNum: 5000, model: 'claude-3-haiku-20240307' }
      });

      const result = await client.query('test query');

      expect(result.status).toBe('success');
      expect(result.data.response).toBe('test response');
    });

    it('should pass options through correctly', async () => {
      const mockResult = {
        status: 'success',
        data: { response: 'test response' },
      };

      const getContextSpy = mock(async () => mockResult);
      client.getContext = getContextSpy;

      await client.query('test query', { tokens: 10000, taskId: 'custom-task' });

      expect(getContextSpy).toHaveBeenCalledWith('test query', 10000, 'custom-task');
    });
  });
});

describe('ExaSearchClient', () => {
  let client: ExaSearchClient;

  beforeEach(() => {
    client = new ExaSearchClient('test-api-key');
  });

  describe('search', () => {
    it('should send search API request with correct parameters', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Example',
            publishedDate: '2024-01-01T00:00:00Z',
            author: 'Test Author',
            score: 0.95,
          },
        ],
        totalResults: 1,
        query: 'test query',
        searchType: 'neural',
      };

      httpClient.post.mockResolvedValue(mockResponse);

      const result = await client.search('test query', {
        type: 'neural',
        numResults: 10,
        includeContents: true,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      }, 'test-task');

      expect(httpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        {
          query: 'test query',
          type: 'neural',
          numResults: 10,
          includeDomains: undefined,
          excludeDomains: undefined,
          startPublishedDate: '2024-01-01',
          endPublishedDate: '2024-12-31',
          text: true,
        },
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
          },
        })
      );

      expect(result.status).toBe('success');
      expect(result.data.results).toHaveLength(1);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].url).toBe('https://example.com');
      expect(result.citations[0].title).toBe('Example');
    });

    it('should handle API errors gracefully', async () => {
      httpClient.post.mockRejectedValue(new Error('API Error'));

      const result = await client.search('test query', {}, 'test-task');

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('SEARCH_API_ERROR');
      expect(result.error?.message).toBe('API Error');
      expect(result.data.results).toEqual([]);
    });

    it('should require API key', async () => {
      const client = new ExaSearchClient();

      await expect(client.search('test query')).rejects.toThrow(
        'EXA_API_KEY is required for Search API'
      );
    });
  });

  describe('Utility search methods', () => {
    it('should perform neural search', async () => {
      const searchSpy = mock(async () => ({ status: 'success', data: { results: [] } }));
      client.search = searchSpy;

      await client.neuralSearch('test query', { numResults: 5 }, 'test-task');

      expect(searchSpy).toHaveBeenCalledWith('test query', {
        type: 'neural',
        numResults: 5,
      }, 'test-task');
    });

    it('should perform keyword search', async () => {
      const searchSpy = mock(async () => ({ status: 'success', data: { results: [] } }));
      client.search = searchSpy;

      await client.keywordSearch('test query');

      expect(searchSpy).toHaveBeenCalledWith('test query', {
        type: 'keyword',
      }, undefined);
    });

    it('should perform fast search', async () => {
      const searchSpy = mock(async () => ({ status: 'success', data: { results: [] } }));
      client.search = searchSpy;

      await client.fastSearch('test query');

      expect(searchSpy).toHaveBeenCalledWith('test query', {
        type: 'fast',
      }, undefined);
    });

    it('should search with date range', async () => {
      const searchSpy = mock(async () => ({ status: 'success', data: { results: [] } }));
      client.search = searchSpy;

      await client.searchWithDateRange('test query', '2024-01-01', '2024-12-31', {
        numResults: 20,
      });

      expect(searchSpy).toHaveBeenCalledWith('test query', {
        numResults: 20,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      }, undefined);
    });

    it('should search with domain filtering', async () => {
      const searchSpy = mock(async () => ({ status: 'success', data: { results: [] } }));
      client.search = searchSpy;

      await client.searchDomains('test query', {
        include: ['example.com', 'test.org'],
        exclude: ['spam.com'],
      }, {
        numResults: 15,
      });

      expect(searchSpy).toHaveBeenCalledWith('test query', {
        numResults: 15,
        includeDomains: ['example.com', 'test.org'],
        excludeDomains: ['spam.com'],
      }, undefined);
    });
  });

  describe('executeTask', () => {
    it('should execute search task with validated parameters', async () => {
      const searchSpy = mock(async () => ({ status: 'success', data: { results: [] } }));
      client.search = searchSpy;

      const task = {
        type: 'search',
        query: 'test query',
        searchType: 'neural',
        numResults: 10,
        includeContents: false,
        id: 'test-task',
      };

      await client.executeTask(task);

      expect(searchSpy).toHaveBeenCalledWith('test query', {
        type: 'neural',
        numResults: 10,
        includeContents: false,
        startDate: undefined,
        endDate: undefined,
      }, 'test-task');
    });
  });
});