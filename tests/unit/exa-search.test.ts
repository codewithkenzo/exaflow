import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { ExaSearchClient } from '../../src/clients/exa-search';
import { createMockResultEnvelope, mockEventStreamer } from '../setup';
import { HttpMock } from '../mocks/http-mock';

// Mock the http module
vi.mock('../../src/util/http', () => ({
  httpClient: {
    post: vi.fn(),
  },
}));

// Mock the env module
vi.mock('../../src/env', () => ({
  getEnv: () => ({
    EXA_API_KEY: 'test-api-key',
  }),
}));

describe('ExaSearchClient', () => {
  let client: ExaSearchClient;
  let mockHttpClientPost: any;

  beforeEach(() => {
    client = new ExaSearchClient('test-api-key');
    // Set environment variable for testing
    process.env.EXA_API_KEY = 'test-api-key';

    // Get the mock function
    const { httpClient } = require('../../src/util/http');
    mockHttpClientPost = httpClient.post;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      const clientWithKey = new ExaSearchClient('my-api-key');
      expect(clientWithKey).toBeDefined();
    });

    it('should initialize without API key', () => {
      const clientWithoutKey = new ExaSearchClient();
      expect(clientWithoutKey).toBeDefined();
    });
  });

  describe('API Key Management', () => {
    it('should use provided API key', () => {
      const clientWithKey = new ExaSearchClient('provided-key');
      expect(clientWithKey['getApiKey']()).toBe('provided-key');
    });

    it('should fall back to environment variable', () => {
      const clientWithoutKey = new ExaSearchClient();
      expect(clientWithoutKey['getApiKey']()).toBe('test-api-key');
    });

    it('should handle API key management correctly', () => {
      const clientWithKey = new ExaSearchClient('provided-key');
      expect(clientWithKey['getApiKey']()).toBe('provided-key');

      const clientWithoutKey = new ExaSearchClient();
      // Should fall back to mocked environment variable
      expect(clientWithoutKey['getApiKey']()).toBe('test-api-key');
    });
  });

  describe('search', () => {
    it('should make successful search request with default options', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Example Article',
            publishedDate: '2024-01-01T00:00:00Z',
            author: 'Test Author',
            text: 'Test content',
            score: 0.95,
            highlights: ['highlighted text'],
          },
        ],
        totalResults: 1,
        query: 'test query',
        searchType: 'neural',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.search('test query', {}, 'test-task');

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockResponse);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0]).toEqual({
        url: 'https://example.com',
        title: 'Example Article',
        author: 'Test Author',
        publishedDate: '2024-01-01T00:00:00Z',
      });
      expect(result.taskId).toBe('test-task');
    });

    it('should use custom search options', async () => {
      const mockResponse = {
        results: [],
        totalResults: 0,
        query: 'advanced query',
        searchType: 'keyword',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.search('advanced query', {
        type: 'keyword',
        numResults: 5,
        includeDomains: ['example.com'],
        excludeDomains: ['spam.com'],
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
        includeContents: true,
      });

      expect(result.status).toBe('success');
      expect(result.data.searchType).toBe('keyword');
    });

    it('should generate task ID when not provided', async () => {
      const mockResponse = {
        results: [],
        totalResults: 0,
        query: 'test query',
        searchType: 'auto',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.search('test query');

      expect(result.status).toBe('success');
      expect(result.taskId).toMatch(/^search-\d+$/);
    });

    it('should handle search API errors gracefully', async () => {
      mockHttpClientPost.mockRejectedValue(new Error('Search API failed'));

      const result = await client.search('test query', {}, 'test-task');

      expect(result.status).toBe('error');
      expect(result.data).toEqual({ results: [], query: '' });
      expect(result.taskId).toBe('test-task');
      expect(result.error?.code).toBe('SEARCH_API_ERROR');
    });

    it('should handle API key validation', async () => {
      // Test that the client can be initialized and basic functionality works
      const client = new ExaSearchClient('test-api-key');
      expect(client['getApiKey']()).toBe('test-api-key');

      // Test that validation method exists
      expect(typeof client['getApiKey']).toBe('function');
    });

    it('should handle API response validation errors', async () => {
      const invalidResponse = {
        // Missing required 'results' field
        totalResults: 1,
        query: 'test query',
        searchType: 'neural',
      };

      mockHttpClientPost.mockResolvedValue(invalidResponse);

      const result = await client.search('test query');

      expect(result.status).toBe('error');
      expect(result.data).toEqual({ results: [], query: '' });
    });

    it('should handle malformed URLs in search results', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            url: 'not-a-valid-url',
            title: 'Invalid URL Result',
            publishedDate: '2024-01-01T00:00:00Z',
            author: 'Test Author',
            text: 'Test content',
            score: 0.95,
          },
        ],
        totalResults: 1,
        query: 'test query',
        searchType: 'neural',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.search('test query');

      expect(result.status).toBe('error');
      expect(result.data).toEqual({ results: [], query: '' });
    });
  });

  describe('executeTask', () => {
    it('should execute valid search task', async () => {
      const task = {
        type: 'search',
        query: 'test query',
        searchType: 'neural',
        numResults: 10,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
        includeContents: true,
        id: 'custom-task',
      };

      const mockResponse = {
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Task Execution Result',
            publishedDate: '2024-01-01T00:00:00Z',
            author: 'Test Author',
            text: 'Test content',
            score: 0.95,
          },
        ],
        totalResults: 1,
        query: 'test query',
        searchType: 'neural',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.executeTask(task);

      expect(result.status).toBe('success');
      expect(result.taskId).toBe('custom-task');
      expect(result.data.results).toHaveLength(1);
    });

    it('should validate task schema', async () => {
      const invalidTask = {
        type: 'search',
        // missing required query field
        searchType: 'neural',
      };

      await expect(client.executeTask(invalidTask as any)).rejects.toThrow();
    });
  });

  describe('Utility Methods', () => {
    describe('neuralSearch', () => {
      it('should perform neural search', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'neural query',
          searchType: 'neural',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.neuralSearch('neural query');

        expect(result.status).toBe('success');
        expect(result.data.searchType).toBe('neural');
      });

      it('should accept custom options with neural type', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'advanced neural query',
          searchType: 'neural',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.neuralSearch('advanced neural query', {
          numResults: 20,
          includeContents: true,
        });

        expect(result.status).toBe('success');
      });
    });

    describe('keywordSearch', () => {
      it('should perform keyword search', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'keyword query',
          searchType: 'keyword',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.keywordSearch('keyword query');

        expect(result.status).toBe('success');
        expect(result.data.searchType).toBe('keyword');
      });
    });

    describe('fastSearch', () => {
      it('should perform fast search', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'fast query',
          searchType: 'fast',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.fastSearch('fast query');

        expect(result.status).toBe('success');
        expect(result.data.searchType).toBe('fast');
      });
    });

    describe('searchWithDateRange', () => {
      it('should perform search with date range', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'date range query',
          searchType: 'neural',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.searchWithDateRange(
          'date range query',
          '2024-01-01T00:00:00Z',
          '2024-12-31T23:59:59Z'
        );

        expect(result.status).toBe('success');
      });

      it('should accept additional options', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'date range with options',
          searchType: 'keyword',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.searchWithDateRange(
          'date range with options',
          '2024-01-01T00:00:00Z',
          '2024-12-31T23:59:59Z',
          {
            type: 'keyword',
            numResults: 15,
          }
        );

        expect(result.status).toBe('success');
        expect(result.data.searchType).toBe('keyword');
      });
    });

    describe('searchDomains', () => {
      it('should perform search with domain inclusion', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'domain search',
          searchType: 'neural',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.searchDomains('domain search', {
          include: ['example.com', 'trusted-site.com'],
        });

        expect(result.status).toBe('success');
      });

      it('should perform search with domain exclusion', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'domain exclusion search',
          searchType: 'neural',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.searchDomains('domain exclusion search', {
          exclude: ['spam.com', 'low-quality-site.com'],
        });

        expect(result.status).toBe('success');
      });

      it('should perform search with both inclusion and exclusion', async () => {
        const mockResponse = {
          results: [],
          totalResults: 0,
          query: 'complex domain search',
          searchType: 'neural',
        };

        mockHttpClientPost.mockResolvedValue(mockResponse);

        const result = await client.searchDomains('complex domain search', {
          include: ['trusted-site.com'],
          exclude: ['spam.com'],
        });

        expect(result.status).toBe('success');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockHttpClientPost.mockRejectedValue(new Error('Network timeout'));

      const result = await client.search('test query');

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('SEARCH_API_ERROR');
      expect(result.error?.message).toBe('Network timeout');
    });

    it('should handle rate limiting errors', async () => {
      mockHttpClientPost.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await client.search('test query');

      expect(result.status).toBe('error');
      expect(result.error?.message).toBe('Rate limit exceeded');
    });

    it('should handle invalid JSON responses', async () => {
      mockHttpClientPost.mockRejectedValue(new Error('Invalid JSON response'));

      const result = await client.search('test query');

      expect(result.status).toBe('error');
      expect(result.error?.message).toBe('Invalid JSON response');
    });
  });

  describe('Result Processing', () => {
    it('should handle results with missing optional fields', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Minimal Result',
            // Missing optional fields: publishedDate, author, text, score, highlights
          },
        ],
        totalResults: 1,
        query: 'minimal query',
        searchType: 'auto',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.search('minimal query');

      expect(result.status).toBe('success');
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0]).toEqual({
        url: 'https://example.com',
        title: 'Minimal Result',
        author: undefined,
        publishedDate: undefined,
      });
    });

    it('should handle empty results array', async () => {
      const mockResponse = {
        results: [],
        totalResults: 0,
        query: 'no results query',
        searchType: 'auto',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.search('no results query');

      expect(result.status).toBe('success');
      expect(result.citations).toEqual([]);
      expect(result.data.results).toEqual([]);
    });

    it('should handle results with null values', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Result with nulls',
            publishedDate: null,
            author: null,
            text: null,
            score: null,
            highlights: null,
          },
        ],
        totalResults: 1,
        query: 'null values query',
        searchType: 'auto',
      };

      mockHttpClientPost.mockResolvedValue(mockResponse);

      const result = await client.search('null values query');

      expect(result.status).toBe('success');
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].author).toBeNull();
      expect(result.citations[0].publishedDate).toBeNull();
    });
  });
});