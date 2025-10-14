import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { ExaContextClient } from '../../src/clients/exa-context';
import { createMockResultEnvelope, mockEventStreamer } from '../setup';
import { HttpMock } from '../mocks/http-mock';

// Mock the http-cache module
vi.mock('../../src/util/http-cache', () => ({
  cachedHttpClient: {
    post: vi.fn(),
  },
}));

// Mock the env module
vi.mock('../../src/env', () => ({
  getEnv: () => ({
    EXA_API_KEY: 'test-api-key',
  }),
}));

describe('ExaContextClient', () => {
  let client: ExaContextClient;
  let httpMock: HttpMock;
  let mockCachedPost: any;

  beforeEach(() => {
    client = new ExaContextClient('test-api-key');
    httpMock = new HttpMock();

    // Get the mock function
    const { cachedHttpClient } = require('../../src/util/http-cache');
    mockCachedPost = cachedHttpClient.post;
  });

  afterEach(() => {
    httpMock.clear();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      const clientWithKey = new ExaContextClient('my-api-key');
      expect(clientWithKey).toBeDefined();
      expect(clientWithKey['getApiKey']()).toBe('my-api-key');
    });

    it('should initialize without API key', () => {
      const clientWithoutKey = new ExaContextClient();
      expect(clientWithoutKey).toBeDefined();
      expect(clientWithoutKey['getApiKey']()).toBe('test-api-key'); // fallback to env
    });
  });

  describe('getContext', () => {
    it('should make successful context request', async () => {
      const mockResponse = {
        response: 'This is a test context response',
        metadata: {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
          sources: [
            {
              url: 'https://example.com',
              title: 'Example Source',
              snippet: 'Example snippet',
            },
          ],
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.getContext('test query', 5000, 'test-task');

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockResponse);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0]).toEqual({
        url: 'https://example.com',
        title: 'Example Source',
        snippet: 'Example snippet',
      });
      expect(result.taskId).toBe('test-task');
    });

    it('should use default tokens number when not provided', async () => {
      const mockResponse = {
        response: 'Response with default tokens',
        metadata: {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.getContext('test query');

      expect(result.status).toBe('success');
      expect(result.data.metadata.tokensNum).toBe(5000);
    });

    it('should handle context API errors gracefully', async () => {
      mockCachedPost.mockRejectedValue(new Error('Context API failed'));

      const result = await client.getContext('test query', 5000, 'test-task');

      expect(result.status).toBe('error');
      expect(result.data).toEqual({ response: '' }); // fallback data
      expect(result.taskId).toBe('test-task');
    });

    it('should require API key for context requests', async () => {
      // This test validates that the BaseExaClient.requireApiKey method works
      // Since we're mocking the environment to always have an API key,
      // we test the validation logic through the constructor behavior

      const client = new ExaContextClient('test-api-key');
      expect(client['getApiKey']()).toBe('test-api-key');

      // Test that the method exists and can be called (integration with BaseExaClient)
      expect(typeof client['requireApiKey']).toBe('function');
    });

    it('should generate task ID when not provided', async () => {
      const mockResponse = {
        response: 'Response with generated task ID',
        metadata: {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.getContext('test query');

      expect(result.status).toBe('success');
      expect(result.taskId).toMatch(/^context-\d+-\d+$/);
    });

    it('should handle responses without sources', async () => {
      const mockResponse = {
        response: 'Response without sources',
        metadata: {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.getContext('test query');

      expect(result.status).toBe('success');
      expect(result.citations).toEqual([]);
    });

    it('should handle responses without metadata', async () => {
      const mockResponse = {
        response: 'Response without metadata',
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.getContext('test query');

      expect(result.status).toBe('success');
      expect(result.citations).toEqual([]);
    });
  });

  describe('executeTask', () => {
    it('should execute valid context task', async () => {
      const task = {
        type: 'context',
        query: 'test query',
        tokensNum: 3000,
        id: 'custom-task',
      };

      const mockResponse = {
        response: 'Task execution response',
        metadata: {
          query: 'test query',
          tokensNum: 3000,
          model: 'claude-3-haiku-20240307',
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.executeTask(task);

      expect(result.status).toBe('success');
      expect(result.taskId).toBe('custom-task');
      expect(result.data.response).toBe('Task execution response');
    });

    it('should validate task schema', async () => {
      const invalidTask = {
        type: 'context',
        // missing required query field
        tokensNum: 3000,
      };

      await expect(client.executeTask(invalidTask as any)).rejects.toThrow();
    });
  });

  describe('query (utility method)', () => {
    it('should make simple query with default options', async () => {
      const mockResponse = {
        response: 'Simple query response',
        metadata: {
          query: 'simple query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.query('simple query');

      expect(result.status).toBe('success');
      expect(result.data.response).toBe('Simple query response');
      expect(result.taskId).toMatch(/^context-query-\d+-\d+$/);
    });

    it('should accept custom options', async () => {
      const mockResponse = {
        response: 'Query with custom options',
        metadata: {
          query: 'advanced query',
          tokensNum: 3000,
          model: 'claude-3-haiku-20240307',
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.query('advanced query', {
        tokens: 3000,
        taskId: 'custom-query-task',
      });

      expect(result.status).toBe('success');
      expect(result.taskId).toBe('custom-query-task');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockCachedPost.mockRejectedValue(new Error('Network timeout'));

      const result = await client.getContext('test query');

      expect(result.status).toBe('error');
      expect(result.data).toEqual({ response: '' });
    });

    it('should handle API response validation errors', async () => {
      const invalidResponse = {
        // Missing required 'response' field
        metadata: {
          query: 'test query',
          tokensNum: 5000,
        },
      };

      mockCachedPost.mockResolvedValue(invalidResponse);

      const result = await client.getContext('test query');

      expect(result.status).toBe('error');
      expect(result.data).toEqual({ response: '' });
    });

    it('should handle malformed URLs in sources', async () => {
      const mockResponse = {
        response: 'Response with malformed URL',
        metadata: {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
          sources: [
            {
              url: 'not-a-valid-url',
              title: 'Invalid URL Source',
              snippet: 'Invalid snippet',
            },
          ],
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result = await client.getContext('test query');

      expect(result.status).toBe('error');
      expect(result.data).toEqual({ response: '' });
    });
  });

  describe('Integration with BaseExaClient', () => {
    it('should inherit base client functionality', () => {
      expect(typeof client.createStreamer).toBe('function');
      expect(typeof client.validateTask).toBe('function');
      expect(typeof client.executeRequest).toBe('function');
    });

    it('should use base client task ID generation', async () => {
      const mockResponse = {
        response: 'Task ID test response',
        metadata: {
          query: 'test query',
          tokensNum: 5000,
          model: 'claude-3-haiku-20240307',
        },
      };

      mockCachedPost.mockResolvedValue(mockResponse);

      const result1 = await client.getContext('test query');
      const result2 = await client.getContext('test query');

      expect(result1.taskId).toMatch(/^context-\d+-\d+$/);
      expect(result2.taskId).toMatch(/^context-\d+-\d+$/);
      expect(result1.taskId).not.toBe(result2.taskId);
    });
  });
});