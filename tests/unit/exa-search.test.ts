import { describe, it, expect, beforeEach, vi, afterEach } from 'bun:test';
import { z } from 'zod';

import { ExaSearchClient } from '../../src/clients/exa-search';
import { SearchTaskSchema } from '../../src/schema';

// Mock dependencies
vi.mock('../../src/env', () => ({
  getEnv: vi.fn(() => ({
    EXA_API_KEY: 'test-api-key',
  })),
  loadEnv: vi.fn(() => ({
    EXA_API_KEY: 'test-api-key',
  })),
}));

vi.mock('../../src/util/streaming', () => ({
  createEventStreamer: vi.fn((taskId: string, clientName?: string) => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    started: vi.fn(),
    completed: vi.fn(),
    failed: vi.fn(),
    progress: vi.fn(),
    apiRequest: vi.fn(),
    apiResponse: vi.fn(),
    asyncStarted: vi.fn(),
    asyncPolling: vi.fn(),
    asyncCompleted: vi.fn(),
  })),
}));

vi.mock('../../src/util/http-cache', () => ({
  cachedHttpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/util/http', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('ExaSearchClient', () => {
  let client: ExaSearchClient;
  let mockCachedHttpClient: any;

  beforeEach(() => {
    client = new ExaSearchClient('test-api-key');
    mockCachedHttpClient = require('../../src/util/http-cache').cachedHttpClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect((client as any).apiKey).toBe('test-api-key');
    });

    it('should have default base URL', () => {
      expect((client as any).baseUrl).toBe('https://api.exa.ai');
    });
  });

  describe('search', () => {
    it('should execute search with basic query', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Example',
            publishedDate: '2024-01-01T00:00:00Z',
            author: 'Author',
            text: 'Content',
            score: 0.9,
            highlights: ['highlight'],
          },
        ],
        totalResults: 1,
        query: 'test query',
      };

      mockCachedHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.search('test query');

      expect(result.status).toBe('success');
      expect(result.data.results).toHaveLength(1);
      expect(result.citations).toHaveLength(1);
      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({
          query: 'test query',
          type: 'auto',
          numResults: 10,
        }),
        expect.any(Object)
      );
    });

    it('should throw error when API key is missing', async () => {
      const clientWithoutKey = new ExaSearchClient();
      await expect(clientWithoutKey.search('test')).rejects.toThrow(
        'EXA_API_KEY is required for Search API'
      );
    });

    it('should include search options', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      await client.search('test query', {
        type: 'neural',
        numResults: 20,
        includeDomains: ['example.com'],
        excludeDomains: ['spam.com'],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        includeContents: true,
      });

      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({
          type: 'neural',
          numResults: 20,
          includeDomains: ['example.com'],
          excludeDomains: ['spam.com'],
          startPublishedDate: '2024-01-01',
          endPublishedDate: '2024-12-31',
          text: true,
        }),
        expect.any(Object)
      );
    });

    it('should use custom task ID when provided', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      const result = await client.search('test', {}, 'custom-task-id');

      expect(result.taskId).toBe('custom-task-id');
    });

    it('should generate task ID when not provided', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      const result = await client.search('test');

      expect(result.taskId).toMatch(/^search-\d+-\d+$/);
    });
  });

  describe('executeTask', () => {
    it('should execute search task', async () => {
      const mockResponse = { results: [], totalResults: 0 };
      mockCachedHttpClient.post.mockResolvedValue(mockResponse);

      const task = {
        type: 'search' as const,
        query: 'test query',
        searchType: 'neural' as const,
        numResults: 15,
        id: 'task-123',
      };

      const result = await client.executeTask(task);

      expect(result.taskId).toBe('task-123');
      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({
          query: 'test query',
          type: 'neural',
          numResults: 15,
        }),
        expect.any(Object)
      );
    });
  });

  describe('neuralSearch', () => {
    it('should perform neural search', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      await client.neuralSearch('test query', { numResults: 5 });

      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({ type: 'neural', numResults: 5 }),
        expect.any(Object)
      );
    });
  });

  describe('keywordSearch', () => {
    it('should perform keyword search', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      await client.keywordSearch('test query');

      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({ type: 'keyword' }),
        expect.any(Object)
      );
    });
  });

  describe('fastSearch', () => {
    it('should perform fast search', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      await client.fastSearch('test query');

      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({ type: 'fast' }),
        expect.any(Object)
      );
    });
  });

  describe('searchWithDateRange', () => {
    it('should search with date range', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      await client.searchWithDateRange('test', '2024-01-01', '2024-06-01', { numResults: 10 });

      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({
          startPublishedDate: '2024-01-01',
          endPublishedDate: '2024-06-01',
          numResults: 10,
        }),
        expect.any(Object)
      );
    });
  });

  describe('searchDomains', () => {
    it('should search with domain filtering', async () => {
      mockCachedHttpClient.post.mockResolvedValue({ results: [], totalResults: 0 });

      await client.searchDomains('test', {
        include: ['example.com', 'docs.example.com'],
        exclude: ['spam.example.com'],
      });

      expect(mockCachedHttpClient.post).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({
          includeDomains: ['example.com', 'docs.example.com'],
          excludeDomains: ['spam.example.com'],
        }),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should return error result when API call fails', async () => {
      mockCachedHttpClient.post.mockRejectedValue(new Error('API error'));

      const result = await client.search('test query');

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('SEARCH_API_ERROR');
    });
  });
});

describe('exaSearchClient singleton', () => {
  it('should be an instance of ExaSearchClient', () => {
    const { exaSearchClient } = require('../../src/clients/exa-search');
    expect(exaSearchClient).toBeInstanceOf(ExaSearchClient);
  });
});
