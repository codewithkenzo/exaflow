# ExaFlow: Advanced Semantic Search Tool with MCP Server Integration

ExaFlow is a powerful CLI tool and MCP server that provides comprehensive access to Exa's neural search capabilities. It combines semantic search, content extraction, async research pipelines, and AI-native MCP integration in a unified TypeScript package.

## ✨ Features

### 🔍 Complete Exa API Integration
- **Context API**: Code-oriented responses with configurable token limits
- **Search API**: Semantic and keyword search with advanced filtering
- **Contents API**: Content extraction with live crawl and subpage support
- **Websets API**: Async search and enrichment containers
- **Research API**: Multi-step async research pipelines

### ⚡ Advanced CLI Capabilities
- **Batch Processing**: Handle multiple queries with bounded concurrency
- **Real-time Progress**: JSONL event streaming for long-running operations
- **Flexible Input**: Support for inline, file, and stdin inputs
- **Rich Output**: Structured JSON with comprehensive metadata and citations
- **Error Resilience**: Circuit breakers, retries, and graceful degradation

### 🔌 MCP Server Integration
- **AI-Native Design**: Expose Exa capabilities as structured MCP tools
- **JSON Schema Contracts**: Type-safe tool definitions for AI clients
- **Multiple Transports**: Support for stdio and HTTP protocols
- **Conversation Context**: Maintain context across AI interactions
- **Metadata Optimization**: Responses optimized for LLM consumption

### 🛠️ Developer-Friendly
- **TypeScript First**: Full type safety with Zod schemas
- **Modular Architecture**: Clean separation of concerns
- **Streaming Support**: Real-time progress tracking
- **Global Installation**: Available as system-wide CLI commands
- **Droid Compatible**: Ready for agent-driven invocation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun 1.0+
- Exa API key

### Installation

```bash
# Clone and install locally
git clone https://github.com/codewithkenzo/exa-personal-tool.git
cd exa-personal-tool
bun install

# Install globally (recommended)
bun install -g .

# Verify installation
exaflow --version
```

### Environment Setup

Create a `.env` file with your Exa API key:

```env
EXA_API_KEY=your_exa_api_key_here
```

## CLI Usage

### Context API - Code-oriented Responses

```bash
# Basic context query
exaflow context "React hooks examples" --tokens 5000

# Type-safe development patterns
exaflow context "TypeScript circuit breaker pattern" --tokens 3000 --timeout 60000
```

### Search API - Semantic and Keyword Search

```bash
# Single semantic search
exaflow search "machine learning trends 2024" --type neural --num-results 20

# Batch processing from file
exaflow search --input queries.json --concurrency 10

# Pipeline with stdin
cat queries.txt | exaflow search --stdin --type keyword

# Advanced filtering
exaflow search "AI research" --type neural --include-contents --start-date 2024-01-01
```

### Contents API - Content Extraction

```bash
# Extract content from URLs
exaflow contents --ids urls.txt --livecrawl always --subpages 5

# stdin input with subpage targeting
echo 'https://example.com' | exaflow contents --stdin --subpage-target "about,news"

# Conservative crawling
exaflow contents --ids urls.txt --livecrawl fallback --subpages 3
```

### Websets API - Async Search and Enrichment

```bash
# Create new webset
exaflow websets create

# Search within webset
exaflow websets search --webset-id abc123 --search-query "AI research papers"

# Poll for completion
exaflow websets poll --webset-id abc123

# Enrichment
exaflow websets enrich --webset-id abc123 --enrichment-type "summary"

# Webhook mode
exaflow websets create --webhook
```

### Research API - Async Multi-step Research

```bash
# Create research task with polling
exaflow research --instructions "Research latest AI trends and summarize key findings" --poll

# Advanced research with structured output
exaflow research --instructions-file prompt.md --model exa-research-pro --schema output-schema.json

# Manage research tasks
exaflow research get --task-id abc123
exaflow research list
```

### MCP Server

```bash
# Start MCP server with stdio transport
exaflow mcp-server

# Start with HTTP transport
exaflow mcp-server --transport http --port 3000

# Use via global binary
exaflow-mcp
```

## Global Options

All commands support these global options:

```bash
-c, --concurrency <number>    Concurrency for batch operations (default: 5)
-t, --timeout <number>         Request timeout in milliseconds (default: 30000)
--compact                     Output compact JSON instead of formatted
--silent                      Suppress event streaming to stderr
```

## Programmatic Usage

```typescript
import { runContextTask, runSearchTask, runBatch } from 'exaflow';

// Single context query
const result = await runContextTask("TypeScript patterns", {
  tokens: 3000,
  timeout: 30000,
  taskId: "context-001"
});

// Batch search
const tasks = [
  { type: "search", query: "React hooks", searchType: "neural" },
  { type: "search", query: "Vue composition", searchType: "neural" }
];
const results = await runBatch(tasks, 5);

// Research task
const research = await runResearchTask("create", {
  instructions: "Research AI trends",
  model: "exa-research-pro",
  poll: true,
  timeout: 300000
});
```

## Architecture

```
src/
├── index.ts              # Main entry points and exports
├── cli.ts                # CLI interface and command routing
├── mcp-server.ts         # MCP server implementation
├── schema.ts             # Zod schemas for type safety
├── env.ts                # Environment configuration
├── clients/              # Exa API clients
│   ├── exa-context.ts
│   ├── exa-search.ts
│   ├── exa-contents.ts
│   ├── exa-websets.ts
│   └── exa-research.ts
├── util/                 # Utility functions
│   ├── concurrency.ts    # Batch processing control
│   ├── http.ts           # HTTP client with retry logic
│   ├── streaming.ts      # Event streaming utilities
│   └── fs.ts             # File system operations
└── tests/                # Test suite
    └── schema.test.ts    # Schema validation tests
```

## Output Format

All commands return structured JSON with consistent format:

```json
{
  "status": "success|partial|error",
  "taskId": "unique-task-id",
  "timing": {
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T00:01:00Z",
    "duration": 60000
  },
  "citations": [
    {
      "url": "https://example.com",
      "title": "Article Title",
      "snippet": "Relevant excerpt...",
      "author": "Author Name",
      "publishedDate": "2024-01-01T00:00:00Z"
    }
  ],
  "data": { /* Command-specific results */ }
}
```

## Event Streaming

Progress events are streamed to stderr in JSONL format:

```json
{"level":"info","type":"task.started","message":"Task started: search","ts":"2024-01-01T00:00:00Z","taskId":"task-123"}
{"level":"info","type":"api.request","message":"API request: POST /search","ts":"2024-01-01T00:00:01Z","taskId":"task-123"}
{"level":"info","type":"task.completed","message":"Task completed: search","ts":"2024-01-01T00:01:00Z","taskId":"task-123"}
```

## Error Handling & Resilience

- **Retry Logic**: Automatic retries with exponential backoff
- **Circuit Breaker**: Prevents cascade failures
- **Rate Limiting**: Respects API limits
- **Graceful Degradation**: Handles partial failures
- **Structured Errors**: Detailed error reporting

## MCP Integration

The MCP server exposes these tools to AI clients:

- `exaflow_context`: Context API queries
- `exaflow_search`: Semantic and keyword search
- `exaflow_contents`: Content extraction
- `exaflow_websets`: Async search operations
- `exaflow_research`: Multi-step research

Each tool includes comprehensive JSON Schema contracts for type-safe AI interactions.

## Development

```bash
# Install dependencies
bun install

# Build project
bun run build

# Run tests
bun test

# Development mode
bun run dev

# MCP server development
bun run dev:mcp

# Type checking
bun run typecheck

# Linting
bun run lint
```

## API Endpoints Supported

1. **Context** (`/context`) - Code-oriented responses with configurable tokens
2. **Search** (`/search`) - Semantic and keyword search with advanced filtering
3. **Contents** (`/contents`) - Content extraction with livecrawl and subpages
4. **Websets** (`/websets/*`) - Async search and enrichment containers
5. **Research** (`/research`) - Multi-step async research pipelines

## Agent Integration

Includes `.tool-contract.json` for agent-driven invocation with:
- Schema validation for inputs/outputs
- Streaming semantics support
- Batch processing capabilities
- Async operation support
- Error handling and retries

## Performance & Scalability

- **Bounded Concurrency**: Configurable parallelism (1-20 concurrent operations)
- **Memory Efficient**: Streaming responses for large datasets
- **Timeout Management**: Per-request and global timeout controls
- **Progress Tracking**: Real-time progress monitoring
- **Resource Cleanup**: Automatic cleanup of temporary resources

## Security

- **Input Validation**: Comprehensive validation using Zod schemas
- **Path Sandboxing**: Safe file system access
- **API Key Protection**: Secure environment variable handling
- **Output Sanitization**: Safe data serialization

## Global Installation Issues (Resolved)

Previously, `bun install -g .` encountered duplicate dependency issues. This has been resolved through:
- Proper lockfile generation and cleanup
- Correct global package structure
- Fixed dependency resolution
- Verified global command functionality

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/codewithkenzo/exa-personal-tool/issues)
- Exa API Documentation: [docs.exa.ai](https://docs.exa.ai)
- MCP Specification: [Model Context Protocol](https://modelcontextprotocol.io/)