// Mock data and test fixtures for testing

export const mockSearchQueries = [
  'machine learning basics',
  'artificial intelligence trends',
  'deep learning applications',
  'neural networks',
  'data science fundamentals',
];

export const mockUrls = [
  'https://example.com/article1',
  'https://example.com/article2',
  'https://example.org/research',
  'https://example.edu/tutorial',
];

export const mockSearchResults = [
  {
    id: '1',
    url: 'https://example.com/article1',
    title: 'Understanding Machine Learning',
    publishedDate: '2024-01-15T00:00:00Z',
    author: 'Dr. Jane Smith',
    text: 'Machine learning is a subset of artificial intelligence...',
    score: 0.95,
    highlights: ['machine learning', 'artificial intelligence'],
  },
  {
    id: '2',
    url: 'https://example.org/research',
    title: 'Deep Learning Fundamentals',
    publishedDate: '2024-02-01T00:00:00Z',
    author: 'Prof. John Doe',
    text: 'Deep learning uses neural networks with multiple layers...',
    score: 0.92,
    highlights: ['deep learning', 'neural networks'],
  },
  {
    id: '3',
    url: 'https://example.edu/tutorial',
    title: 'Getting Started with AI',
    publishedDate: '2024-01-20T00:00:00Z',
    author: 'Tech Educator',
    text: 'Artificial intelligence encompasses various approaches...',
    score: 0.88,
    highlights: ['artificial intelligence', 'approaches'],
  },
];

export const mockContextResponse = {
  response:
    'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data. It includes various techniques such as supervised learning, unsupervised learning, and reinforcement learning. The field has seen significant advances in recent years due to the availability of large datasets and computational power.',
  metadata: {
    query: 'machine learning basics',
    tokensNum: 5000,
    model: 'claude-3-haiku-20240307',
    sources: [
      {
        url: 'https://example.com/ml-basics',
        title: 'Machine Learning Fundamentals',
        snippet: 'An introduction to core ML concepts',
      },
      {
        url: 'https://example.org/ai-overview',
        title: 'AI and ML Overview',
        snippet: 'Comprehensive guide to artificial intelligence',
      },
    ],
  },
};

export const mockApiError = {
  error: 'Invalid API key',
  message: 'The provided API key is invalid or has been revoked',
  code: 'INVALID_API_KEY',
};

export const mockNetworkError = {
  name: 'NetworkError',
  message: 'Network request failed',
  code: 'NETWORK_ERROR',
};

export const mockTask = {
  type: 'search',
  query: 'machine learning basics',
  searchType: 'neural',
  numResults: 10,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  includeContents: true,
  id: 'task-123',
};

export const mockBatchTasks = [
  {
    type: 'search',
    query: 'machine learning',
    searchType: 'neural',
    id: 'task-1',
  },
  {
    type: 'search',
    query: 'deep learning',
    searchType: 'keyword',
    id: 'task-2',
  },
  {
    type: 'search',
    query: 'neural networks',
    searchType: 'auto',
    id: 'task-3',
  },
];

// Test scenarios
export const testScenarios = {
  success: {
    name: 'Successful API Response',
    mockData: mockSearchResults,
    shouldSucceed: true,
  },

  error: {
    name: 'API Error Response',
    mockData: mockApiError,
    shouldSucceed: false,
  },

  networkError: {
    name: 'Network Error',
    mockData: mockNetworkError,
    shouldSucceed: false,
  },

  empty: {
    name: 'Empty Results',
    mockData: { results: [], totalResults: 0 },
    shouldSucceed: true,
  },

  single: {
    name: 'Single Result',
    mockData: { results: [mockSearchResults[0]], totalResults: 1 },
    shouldSucceed: true,
  },

  large: {
    name: 'Large Result Set',
    mockData: { results: mockSearchResults.concat(mockSearchResults), totalResults: 6 },
    shouldSucceed: true,
  },
};

// Environment configurations for testing
export const testEnvironments = {
  development: {
    EXA_API_KEY: 'dev-api-key',
    NODE_ENV: 'development',
  },

  production: {
    EXA_API_KEY: 'prod-api-key',
    NODE_ENV: 'production',
  },

  test: {
    EXA_API_KEY: 'test-api-key',
    NODE_ENV: 'test',
  },
};
