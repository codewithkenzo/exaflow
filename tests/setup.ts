// Global test setup file
// This runs before all test suites

// Load environment for testing
import { loadEnv } from '../src/env';

// Mock environment variables for consistent testing
process.env.EXA_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';

// Load the environment
loadEnv();

// Global test utilities
export const createMockResultEnvelope = <T>(
  data: T,
  status: 'success' | 'error' | 'partial' = 'success'
) => {
  const startTime = Date.now() - 100;
  return {
    status,
    taskId: 'test-task',
    timing: {
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    },
    citations: [],
    data,
  };
};

export const mockEventStreamer = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {},
  started: () => {},
  completed: () => {},
  failed: () => {},
  retry: () => {},
  apiRequest: () => {},
  apiResponse: () => {},
  asyncStarted: () => {},
  asyncPolling: () => {},
  asyncCompleted: () => {},
  webhookReceived: () => {},
  webhookProcessed: () => {},
  concurrencyUpdate: () => {},
  batchStarted: () => {},
  batchProgress: () => {},
  batchCompleted: () => {},
};

// Mock HTTP responses for consistent testing
export const mockSearchResponse = {
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

export const mockContextResponse = {
  response: 'This is a test response from the Context API',
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
