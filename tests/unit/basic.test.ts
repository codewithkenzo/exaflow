import { describe, it, expect } from 'bun:test';

describe('Basic Test Setup', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should test environment variables', () => {
    // Check that environment variables are set (they might be set by Bun's test runner)
    expect(process.env.NODE_ENV).toBeDefined();
    expect(process.env.EXA_API_KEY).toBeDefined();
  });

  it('should import mock utilities', () => {
    const { createMockResultEnvelope } = require('../setup');
    const result = createMockResultEnvelope({ test: 'data' });

    expect(result.status).toBe('success');
    expect(result.taskId).toBe('test-task');
    expect(result.data).toEqual({ test: 'data' });
  });

  it('should test mock data fixtures', () => {
    const { mockSearchResults, mockContextResponse } = require('../fixtures/mock-data');

    expect(mockSearchResults).toHaveLength(3);
    expect(mockSearchResults[0]).toHaveProperty('id');
    expect(mockContextResponse).toHaveProperty('response');
    expect(mockContextResponse).toHaveProperty('metadata');
  });
});
