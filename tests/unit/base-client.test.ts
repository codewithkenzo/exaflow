import { describe, it, expect, beforeEach, vi, afterEach } from 'bun:test';

import { BaseExaClient } from '../../src/clients/base-client';
import { EventStreamer, createEventStreamer } from '../../src/util/streaming';

// Mock the environment
vi.mock('../../src/env', () => ({
  getEnv: vi.fn(() => ({
    EXA_API_KEY: 'test-api-key',
  })),
  loadEnv: vi.fn(() => ({
    EXA_API_KEY: 'test-api-key',
  })),
}));

// Mock the streaming utilities
vi.mock('../../src/util/streaming', () => ({
  createEventStreamer: vi.fn((taskId: string) => ({
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

describe('BaseExaClient', () => {
  let client: BaseExaClient;

  beforeEach(() => {
    client = new BaseExaClient('test-key');
  });

  describe('constructor', () => {
    it('should initialize with provided API key', () => {
      const key = (client as any).apiKey;
      expect(key).toBe('test-key');
    });

    it('should have default base URL', () => {
      const baseUrl = (client as any).baseUrl;
      expect(baseUrl).toBe('https://api.exa.ai');
    });
  });

  describe('getApiKey', () => {
    it('should return instance API key when provided', () => {
      const key = (client as any).getApiKey();
      expect(key).toBe('test-key');
    });

    it('should fall back to environment when no instance key', () => {
      const clientWithoutKey = new BaseExaClient();
      const key = (clientWithoutKey as any).getApiKey();
      expect(key).toBe('test-api-key');
    });
  });

  describe('hasApiKey', () => {
    it('should return true when API key is available', () => {
      expect((client as any).hasApiKey()).toBe(true);
    });

    it('should return false when API key is not available', () => {
      const clientWithoutKey = new BaseExaClient();
      (clientWithoutKey as any).apiKey = undefined;
      vi.spyOn(require('../../src/env'), 'getEnv').mockImplementation(() => {
        throw new Error('No API key');
      });
      expect((clientWithoutKey as any).hasApiKey()).toBe(false);
    });
  });

  describe('requireApiKey', () => {
    it('should return API key when available', () => {
      const key = (client as any).requireApiKey('Test API');
      expect(key).toBe('test-key');
    });

    it('should throw error when API key is not available', () => {
      const clientWithoutKey = new BaseExaClient();
      expect(() => (clientWithoutKey as any).requireApiKey('Test API')).toThrow(
        'EXA_API_KEY is required for Test API'
      );
    });
  });

  describe('createStreamer', () => {
    it('should create an event streamer', () => {
      const streamer = (client as any).createStreamer('task-123', 'search');
      expect(streamer).toBeDefined();
    });

    it('should generate task ID when not provided', () => {
      const streamer = (client as any).createStreamer(undefined, 'search');
      expect(streamer).toBeDefined();
    });
  });

  describe('createResultEnvelope', () => {
    it('should create a success result envelope', () => {
      const startTime = Date.now() - 100;
      const envelope = (client as any).createResultEnvelope(
        'success',
        'task-123',
        startTime,
        [],
        { data: 'test' }
      );

      expect(envelope.status).toBe('success');
      expect(envelope.taskId).toBe('task-123');
      expect(envelope.data).toEqual({ data: 'test' });
      expect(envelope.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include citations when provided', () => {
      const citations = [
        { url: 'https://example.com', title: 'Example' },
      ];
      const startTime = Date.now() - 100;
      const envelope = (client as any).createResultEnvelope(
        'success',
        'task-123',
        startTime,
        citations,
        { data: 'test' }
      );

      expect(envelope.citations).toHaveLength(1);
      expect(envelope.citations[0].url).toBe('https://example.com');
    });

    it('should include error when status is error', () => {
      const startTime = Date.now() - 100;
      const envelope = (client as any).createResultEnvelope(
        'error',
        'task-123',
        startTime,
        [],
        { fallback: true },
        { code: 'ERR_CODE', message: 'Error message' }
      );

      expect(envelope.status).toBe('error');
      expect(envelope.error.code).toBe('ERR_CODE');
      expect(envelope.error.message).toBe('Error message');
    });
  });

  describe('createErrorResult', () => {
    it('should create an error result envelope', () => {
      const startTime = Date.now() - 100;
      const envelope = (client as any).createErrorResult(
        'task-123',
        startTime,
        'SEARCH_FAILED',
        'Search operation failed',
        { fallback: 'data' }
      );

      expect(envelope.status).toBe('error');
      expect(envelope.error.code).toBe('SEARCH_FAILED');
      expect(envelope.error.message).toBe('Search operation failed');
      expect(envelope.data).toEqual({ fallback: 'data' });
    });

    it('should include error details when provided', () => {
      const startTime = Date.now() - 100;
      const envelope = (client as any).createErrorResult(
        'task-123',
        startTime,
        'API_ERROR',
        'API error occurred',
        { fallback: 'data' },
        { retryable: true }
      );

      expect(envelope.error.details.retryable).toBe(true);
    });
  });

  describe('validateTask', () => {
    it('should validate task against schema', () => {
      const schema = {
        parse: vi.fn((data) => data),
      };

      const task = { query: 'test' };
      const result = (client as any).validateTask(task, schema as any);

      expect(schema.parse).toHaveBeenCalledWith(task);
      expect(result).toEqual(task);
    });
  });

  describe('getTaskId', () => {
    it('should return provided task ID', () => {
      const taskId = (client as any).getTaskId('custom-id', 'prefix');
      expect(taskId).toBe('custom-id');
    });

    it('should generate task ID when not provided', () => {
      const taskId1 = (client as any).getTaskId(undefined, 'search');
      const taskId2 = (client as any).getTaskId(undefined, 'search');

      expect(taskId1).toMatch(/^search-\d+-\d+$/);
      expect(taskId2).toMatch(/^search-\d+-\d+$/);
      expect(taskId1).not.toBe(taskId2);
    });

    it('should use default prefix when not provided', () => {
      const taskId = (client as any).getTaskId(undefined);
      expect(taskId).toMatch(/^task-\d+-\d+$/);
    });
  });

  describe('executeRequest', () => {
    it('should execute GET request successfully', async () => {
      const mockResponse = { data: 'test' };
      const mockValidated = { result: 'validated' };

      vi.spyOn(require('../../src/util/http-cache'), 'cachedHttpClient').value({
        get: vi.fn().mockResolvedValue(mockResponse),
      });

      const schema = {
        parse: vi.fn().mockReturnValue(mockValidated),
      };

      const streamer = createEventStreamer('test-task');
      const startTime = Date.now();

      const result = await (client as any).executeRequest(
        'GET',
        '/test',
        null,
        schema as any,
        'task-123',
        streamer,
        startTime,
        {},
        {
          errorCode: 'TEST_ERROR',
          errorPrefix: 'Test',
          fallbackData: mockValidated,
        }
      );

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockValidated);
    });
  });

  describe('pollForCompletion', () => {
    it('should poll until completion', async () => {
      let pollCount = 0;
      const pollFunction = vi.fn().mockImplementation(() => {
        pollCount++;
        if (pollCount >= 2) {
          return { status: 'completed', data: { result: 'done' } };
        }
        return { status: 'processing' };
      });

      const isComplete = (status: string) => status === 'completed';
      const hasFailed = (status: string) => status === 'failed';

      const streamer = createEventStreamer('test-task');
      const startTime = Date.now();

      const result = await (client as any).pollForCompletion(
        pollFunction,
        isComplete,
        hasFailed,
        'task-123',
        streamer,
        startTime,
        10000,
        10,
        'test'
      );

      expect(result.status).toBe('success');
      expect(pollCount).toBe(2);
    });

    it('should handle poll failure', async () => {
      const pollFunction = vi.fn().mockReturnValue({ status: 'failed', error: 'Poll failed' });

      const isComplete = (status: string) => status === 'completed';
      const hasFailed = (status: string) => status === 'failed';

      const streamer = createEventStreamer('test-task');
      const startTime = Date.now();

      const result = await (client as any).pollForCompletion(
        pollFunction,
        isComplete,
        hasFailed,
        'task-123',
        streamer,
        startTime,
        10000,
        10,
        'test'
      );

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('TEST_FAILED');
    });

    it('should timeout after max wait time', async () => {
      const pollFunction = vi.fn().mockReturnValue({ status: 'processing' });

      const isComplete = (status: string) => status === 'completed';
      const hasFailed = (status: string) => status === 'failed';

      const streamer = createEventStreamer('test-task');
      const startTime = Date.now();

      const result = await (client as any).pollForCompletion(
        pollFunction,
        isComplete,
        hasFailed,
        'task-123',
        streamer,
        startTime,
        50, // Very short timeout
        10,
        'test'
      );

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('TEST_POLLING_TIMEOUT');
    });
  });

  describe('abstract executeTask', () => {
    it('should be defined as abstract method', () => {
      expect((BaseExaClient as any).prototype.executeTask).toBeDefined();
    });
  });
});
