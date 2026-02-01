import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { BaseExaClient } from '../../src/clients/base-client';

// Mock environment for tests - no real API keys needed
const mockGetEnv = mock(() => ({}));
const mockLoadEnv = mock(() => ({}));

// We can't easily mock ESM modules in bun, so we'll test what we can
describe('BaseExaClient', () => {
  describe('constructor', () => {
    it('should initialize with provided API key', () => {
      const client = new BaseExaClient('test-key');
      expect(client).toBeDefined();
    });

    it('should have default base URL', () => {
      const client = new BaseExaClient('test-key');
      expect((client as any).baseUrl).toBe('https://api.exa.ai');
    });
  });

  describe('createResultEnvelope', () => {
    it('should create success envelope', () => {
      const client = new BaseExaClient('test-key');
      const startTime = Date.now() - 1000;
      const result = client.createResultEnvelope<'test'>('success', 'task-123', startTime, [], 'test');
      expect(result.status).toBe('success');
      expect(result.data).toBe('test');
      expect(result.timing.duration).toBeDefined();
    });

    it('should create error envelope', () => {
      const client = new BaseExaClient('test-key');
      const startTime = Date.now() - 1000;
      const result = client.createResultEnvelope<'test'>(
        'error',
        'task-123',
        startTime,
        [],
        undefined,
        { code: 'TEST_ERROR', message: 'test error' }
      );
      expect(result.status).toBe('error');
      expect(result.error?.message).toBe('test error');
    });
  });

  describe('requireApiKey', () => {
    it('should not throw when API key is available', () => {
      const client = new BaseExaClient('test-key');
      expect(() => client.requireApiKey()).not.toThrow();
    });
  });
});
