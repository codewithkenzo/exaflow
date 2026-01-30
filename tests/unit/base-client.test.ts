import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { BaseExaClient } from '../../src/clients/base-client';

// Mock environment
const mockGetEnv = mock(() => ({ EXA_API_KEY: 'test-api-key' }));
const mockLoadEnv = mock(() => ({ EXA_API_KEY: 'test-api-key' }));

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
      const result = client.createResultEnvelope({ success: true, data: 'test' });
      expect(result.success).toBe(true);
      expect(result.data).toBe('test');
    });

    it('should create error envelope', () => {
      const client = new BaseExaClient('test-key');
      const result = client.createResultEnvelope({ 
        success: false, 
        error: 'test error' 
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('test error');
    });
  });

  describe('requireApiKey', () => {
    it('should not throw when API key is available', () => {
      const client = new BaseExaClient('test-key');
      expect(() => client.requireApiKey()).not.toThrow();
    });
  });
});
