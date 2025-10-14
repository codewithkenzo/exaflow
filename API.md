# 📚 ExaFlow API Documentation

This document provides comprehensive API documentation for ExaFlow, covering both programmatic usage and advanced features.

## 🚀 Quick Start

```typescript
import {
  runContextTask,
  runSearchTask,
  runContentsTask,
  runWebsetsTask,
  runResearchTask,
  runBatch
} from 'exaflow';
```

## 🧠 Context API

### `runContextTask`

Execute context queries with code-oriented responses.

```typescript
interface ContextOptions {
  tokens?: number;        // 100-50000, default: 5000
  timeout?: number;       // in ms, default: 30000
  taskId?: string;       // custom task ID
}

const result = await runContextTask("React hooks patterns", {
  tokens: 3000,
  timeout: 60000,
  taskId: "context-001"
});
```

**Parameters:**
- `query` (string): Search query for context
- `options` (ContextOptions): Configuration options

**Returns:** `Promise<ResultEnvelope<ContextResponse>>`

**Example Response:**
```json
{
  "status": "success",
  "taskId": "context-001",
  "timing": { "startedAt": "...", "completedAt": "...", "duration": 2766 },
  "citations": [
    {
      "url": "https://example.com/react-hooks",
      "title": "React Hooks Guide",
      "snippet": "Hooks let you use state...",
      "author": "React Team",
      "publishedDate": "2024-01-01T00:00:00Z"
    }
  ],
  "data": {
    "response": "React hooks are functions...",
    "metadata": {
      "model": "exa-context",
      "tokensUsed": 2987,
      "sourcesCount": 1
    }
  }
}
```

## 🔍 Search API

### `runSearchTask`

Perform semantic and keyword search operations.

```typescript
interface SearchOptions {
  type?: 'auto' | 'keyword' | 'neural' | 'fast';
  numResults?: number;    // 1-50, default: 10
  includeContents?: boolean;
  startDate?: string;    // ISO date format
  endDate?: string;      // ISO date format
  includeDomains?: string[];
  excludeDomains?: string[];
  timeout?: number;
  taskId?: string;
}

const result = await runSearchTask("machine learning trends", {
  type: 'neural',
  numResults: 20,
  includeContents: true,
  startDate: '2024-01-01T00:00:00Z'
});
```

**Parameters:**
- `query` (string): Search query
- `options` (SearchOptions): Search configuration

**Returns:** `Promise<ResultEnvelope<SearchResponse>>`

### Search Response Structure

```typescript
interface SearchResponse {
  results: SearchResult[];
  totalResults?: number;
  query?: string;
  searchType?: string;
}

interface SearchResult {
  id: string;
  url: string;
  title: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  score?: number;
  highlights?: string[];
}
```

## 📄 Contents API

### `runContentsTask`

Extract content from URLs with live crawling and subpage discovery.

```typescript
interface ContentsOptions {
  livecrawl?: 'always' | 'fallback' | 'never';
  subpages?: number;        // 0-20, default: 0
  subpageTarget?: string[];
  includeText?: boolean;  // default: true
  timeout?: number;
  taskId?: string;
}

const result = await runContentsTask([
  'https://example.com/article1',
  'https://example.com/article2'
], {
  livecrawl: 'always',
  subpages: 5,
  subpageTarget: ['about', 'news']
});
```

**Parameters:**
- `ids` (string[]): Array of URLs to extract content from
- `options` (ContentsOptions): Extraction configuration

**Returns:** `Promise<ResultEnvelope<ContentsResponse>>`

### Contents Response Structure

```typescript
interface ContentsResponse {
  results: ContentResult[];
  query?: string;
}

interface ContentResult {
  id: string;
  url: string;
  title: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  extractedAt?: string;
  crawlTime?: number;
  subpages?: SubPageResult[];
}

interface SubPageResult {
  url: string;
  title: string;
  text?: string;
  extractedAt?: string;
}
```

## 🌐 Websets API

### `runWebsetsTask`

Manage async search containers with enrichment and polling.

```typescript
interface WebsetsOptions {
  taskId?: string;
  timeout?: number;
}

// Create webset
const createResult = await runWebsetsTask("create", {}, options);

// Search within webset
const searchResult = await runWebsetsTask("search", {
  websetId: "webset-123",
  searchQuery: "AI research papers"
}, options);

// Poll for completion
const pollResult = await runWebsetsTask("poll", {
  websetId: "webset-123",
  searchId: "search-456"
}, options);

// Enrich items
const enrichResult = await runWebsetsTask("enrich", {
  websetId: "webset-123",
  enrichmentType: "summary",
  itemIds: ["item-1", "item-2"]
}, options);
```

**Operations:**
- `"create"`: Create new webset
- `"search"`: Search within existing webset
- `"poll"`: Poll for search completion
- `"enrich"`: Enrich webset items

## 🔬 Research API

### `runResearchTask`

Execute multi-step research pipelines with structured output.

```typescript
interface ResearchOptions {
  instructions?: string;
  model?: 'exa-research' | 'exa-research-pro';
  outputSchema?: Record<string, any>;
  poll?: boolean;
  maxWaitTime?: number;  // in ms, default: 600000
  taskId?: string;
}

// Create research task
const result = await runResearchTask("create", {
  instructions: "Analyze AI research trends and summarize findings",
  model: 'exa-research-pro',
  outputSchema: {
    "trends": ["string"],
    "confidence": "number"
  },
  poll: true
});

// Get research task status
const getResult = await runResearchTask("get", {
  taskId: "research-123"
});

// List research tasks
const listResult = await runResearchTask("list", {});
```

**Operations:**
- `"create"`: Create new research task
- `"get"`: Get research task details
- `"list"`: List research tasks

### Research Response Structure

```typescript
interface ResearchResponse {
  id: string;
  instructions: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  error?: string;
  outputSchema?: Record<string, any>;
  metadata?: {
    model: string;
    tokensUsed?: number;
    processingTime?: number;
    sourcesCount?: number;
  };
}
```

## 🔄 Batch Processing

### `runBatch`

Process multiple tasks concurrently with bounded concurrency.

```typescript
interface BatchOptions {
  concurrency?: number;  // 1-20, default: 5
  preserveOrder?: boolean; // default: true
  timeout?: number;
}

const tasks: InputTask[] = [
  { type: "search", query: "React hooks", searchType: "neural" },
  { type: "context", query: "TypeScript patterns", tokensNum: 3000 },
  { type: "search", query: "Vue composition", searchType: "neural" }
];

const results = await runBatch(tasks, {
  concurrency: 10,
  preserveOrder: true
});
```

**Parameters:**
- `tasks` (InputTask[]): Array of tasks to process
- `options` (BatchOptions): Batch configuration

**Returns:** `Promise<ResultEnvelope<any>[]>`

## 📊 Result Envelope

All API responses use a consistent ResultEnvelope structure:

```typescript
interface ResultEnvelope<T = any> {
  status: 'success' | 'partial' | 'error';
  taskId: string;
  timing: {
    startedAt: string;      // ISO datetime
    completedAt: string;    // ISO datetime
    duration: number;        // in milliseconds
  };
  citations: Citation[];
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface Citation {
  url: string;
  title?: string;
  snippet?: string;
  author?: string;
  publishedDate?: string;
  verificationReasoning?: string;
}
```

## 🔧 Error Handling

### Error Types

```typescript
// API errors
interface ApiError {
  code: string;
  message: string;
  details?: {
    statusCode?: number;
    response?: any;
    request?: {
      url: string;
      method: string;
      headers?: Record<string, string>;
    };
  };
}

// Validation errors
interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  details: {
    field: string;
    value: any;
    constraint: string;
  }[];
}
```

### Error Handling Best Practices

```typescript
import { runContextTask } from 'exaflow';

try {
  const result = await runContextTask("React hooks", { tokens: 3000 });

  if (result.status === 'success') {
    console.log('Success:', result.data.response);
  } else if (result.status === 'partial') {
    console.log('Partial success:', result.data);
  } else {
    console.error('Error:', result.error?.message);
  }
} catch (error) {
  console.error('Unexpected error:', error);

  // Handle network errors, timeouts, etc.
  if (error.code === 'ENOTFOUND') {
    console.error('Network error - check connection');
  }
}
```

## 🌐 Advanced Configuration

### Custom HTTP Client

```typescript
import { ExaContextClient } from 'exaflow';

const client = new ExaContextClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.exa.ai',
  timeout: 60000,
  retryAttempts: 5,
  retryDelay: 1000
});

const result = await client.getContext({
  query: "TypeScript patterns",
  tokensNum: 3000
});
```

### Event Streaming

```typescript
import { createEventStreamer } from 'exaflow';

const streamer = createEventStreamer('my-task-id');

// Listen to events
streamer.on('data', (event) => {
  console.log('Event:', event);
});

// Custom event handling
streamer.info('Task started', { query: 'test' });
streamer.completed('task-name', { results: 10 });
streamer.failed('Error occurred', { error: 'details' });
```

### Caching Configuration

```typescript
import { HttpCache } from 'exaflow';

const cache = new HttpCache({
  enabled: true,
  maxSize: 1000,        // max cache entries
  defaultTtl: 300000,    // 5 minutes in ms
  cleanupInterval: 60000  // cleanup every minute
});
```

## 🔍 TypeScript Types

### Input Task Types

```typescript
interface ContextTask {
  type: 'context';
  query: string;
  tokensNum?: number;
  id?: string;
}

interface SearchTask {
  type: 'search';
  query: string;
  searchType?: 'auto' | 'keyword' | 'neural' | 'fast';
  includeContents?: boolean;
  numResults?: number;
  startDate?: string;
  endDate?: string;
  id?: string;
}

interface ContentsTask {
  type: 'contents';
  ids: string[];
  livecrawl?: 'always' | 'fallback' | 'never';
  subpages?: number;
  subpageTarget?: string[];
  id?: string;
}

type InputTask = ContextTask | SearchTask | ContentsTask | WebsetsTask | ResearchTask;
```

### Response Types

```typescript
type ResultEnvelope<T> = {
  status: 'success' | 'partial' | 'error';
  taskId: string;
  timing: {
    startedAt: string;
    completedAt: string;
    duration: number;
  };
  citations: Citation[];
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

## 📚 Examples

### Basic Usage

```typescript
import { runContextTask, runSearchTask } from 'exaflow';

// Simple context query
const context = await runContextTask("React hooks", {
  tokens: 2000
});

// Simple search
const search = await runSearchTask("TypeScript patterns", {
  type: 'neural',
  numResults: 5
});
```

### Advanced Usage

```typescript
import { runBatch, runResearchTask } from 'exaflow';

// Batch processing
const batch = await runBatch([
  { type: "search", query: "React", searchType: "neural" },
  { type: "search", query: "Vue", searchType: "neural" },
  { type: "context", query: "Angular", tokensNum: 2000 }
], { concurrency: 5 });

// Research with custom schema
const research = await runResearchTask("create", {
  instructions: "Analyze web development trends",
  model: "exa-research-pro",
  outputSchema: {
    "frameworks": ["string"],
    "popularity": "number",
    "trends": ["string"]
  },
  poll: true
});
```

### Error Handling

```typescript
import { runSearchTask } from 'exaflow';

async function safeSearch(query: string) {
  try {
    const result = await runSearchTask(query, {
      type: 'neural',
      timeout: 30000
    });

    if (result.status === 'success') {
      return result.data.results;
    } else {
      throw new Error(result.error?.message || 'Search failed');
    }
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}
```

## 🔧 Best Practices

### Performance Optimization

1. **Use Bounded Concurrency**: Limit concurrent operations to avoid rate limiting
2. **Enable Caching**: Use intelligent caching for repeated queries
3. **Batch Operations**: Process multiple queries together when possible
4. **Set Appropriate Timeouts**: Balance between reliability and responsiveness

### Error Handling

1. **Always Check Status**: Verify `result.status` before using data
2. **Handle Citations**: Process citation data for attribution
3. **Validate Inputs**: Use proper input validation for user queries
4. **Implement Retry Logic**: Use exponential backoff for transient errors

### Security

1. **Protect API Keys**: Use environment variables for API keys
2. **Validate URLs**: Ensure URLs are properly formatted before use
3. **Sanitize Outputs**: Handle user-provided content safely
4. **Rate Limiting**: Respect API rate limits and implement throttling

---

## 📞 Support

For API support and questions:
- **Documentation**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/codewithkenzo/exa-personal-tool/issues)
- **Discussions**: [GitHub Discussions](https://github.com/codewithkenzo/exa-personal-tool/discussions)