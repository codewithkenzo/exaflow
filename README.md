# ExaFlow: Interactive Semantic Search Tool

ExaFlow is a powerful, feature-rich semantic search tool that combines Exa's neural search capabilities with an interactive terminal interface and MCP server integration for AI workflows.

## ✨ Features

### 🖥️ Interactive Terminal User Interface (TUI)
- **Multi-panel layout**: Search input, results preview, configuration panel, and workflow automation
- **Real-time configuration**: Toggle all Exa API parameters on the fly
- **Smooth scrolling navigation**: Browse through search results seamlessly
- **Keyboard shortcuts**: Power-user friendly with comprehensive hotkey support
- **Enhanced search modes**: Specialized search for different content types

### 🔍 Specialized Search Modes

#### 📚 Research Mode (Very High coverage)
- Academic paper discovery with sophisticated filtering
- Citation network exploration
- Research trend analysis
- Export to reference managers

#### 💼 Professional Mode (Very High coverage)
- LinkedIn profile and company research
- Industry expert identification
- Professional network mapping
- Contact information extraction

#### 💻 Development Mode (High coverage)
- GitHub repository semantic search
- Code pattern discovery
- Open source project exploration
- Technical blog aggregation

#### 🧠 Knowledge Mode (Very High coverage)
- Wikipedia semantic navigation
- Government and policy source research
- Legal case discovery
- Financial report analysis

#### 📰 News Mode (High coverage)
- Current events and news articles
- Real-time news search
- Media source analysis
- Trend tracking

#### 📝 Blogs Mode (High coverage)
- Blog posts and technical articles
- Tutorial discovery
- Medium and Substack integration
- Content creator research

### ⚡ Workflow Automation
- **Pre-built workflows**: Academic research, market analysis, technical investigation
- **Multi-step pipelines**: Search → Filter → Export → Session management
- **Progress tracking**: Real-time workflow execution monitoring
- **Custom workflows**: Create your own automation pipelines
- **Session persistence**: Save and restore search sessions

### 🔌 MCP Server Integration
- **AI-native design**: Expose Exa search capabilities as structured tools
- **JSON Schema contracts**: Type-safe tool definitions for AI clients
- **Multiple transport protocols**: Support for stdio and HTTP
- **Conversation-aware context**: Maintain context across AI interactions
- **Metadata-rich responses**: Optimized for LLM consumption

### 📊 Advanced Features
- **Session management**: Save, restore, and analyze search sessions
- **Export capabilities**: JSON, CSV, BibTeX, Markdown formats
- **Search analytics**: Result distribution, source analysis, quality metrics
- **Batch processing**: Handle multiple queries efficiently
- **Real-time filtering**: Dynamic result refinement

## 🚀 Quick Start

- **Unified Interface**: Single CLI and module API for all Exa endpoints
- **Type Safety**: Full TypeScript support with Zod schemas
- **Async Support**: Polling and webhook support for Websets and Research
- **Resiliency**: Circuit breakers, retries, rate limiting
- **Streaming**: JSONL event streaming for progress tracking
- **Batch Processing**: Bounded concurrency with order preservation
- **Droid Compatible**: Ready for agent-driven invocation

## Installation

```bash
bun install
```

## Environment Setup

Create a `.env` file with your Exa API key:

```env
EXA_API_KEY=your_exa_api_key_here
```

## CLI Usage

### Context API - Code-oriented responses
```bash
exaflow context "React hooks examples" --tokens 5000
```

### Search API - Semantic and keyword search
```bash
exaflow search "machine learning trends 2024" --type neural --num-results 20
exaflow search --input queries.json --concurrency 10
```

### Contents API - Extract content with subpages
```bash
exaflow contents --ids urls.txt --livecrawl always --subpages 5
exaflow contents --stdin --subpage-target "about,news"
```

### Websets API - Async search and enrichment
```bash
exaflow websets create
exaflow websets search --webset-id abc123 --search-query "AI research papers"
exaflow websets poll --webset-id abc123
```

### Research API - Async multi-step research
```bash
exaflow research --instructions "Research latest AI trends" --poll
exaflow research --instructions-file prompt.md --model exa-research-pro
```

## Programmatic Usage

```typescript
import { runContextTask, runSearchTask, runBatch } from './src/index';

// Single context query
const result = await runContextTask("TypeScript patterns", { tokens: 3000 });

// Batch search
const tasks = [
  { type: "search", query: "React hooks", searchType: "neural" },
  { type: "search", query: "Vue composition", searchType: "neural" }
];
const results = await runBatch(tasks, 5);
```

## Architecture

```
src/
├── index.ts          # Main entry points
├── cli.ts            # CLI interface
├── schema.ts         # Zod schemas
├── env.ts            # Environment loading
├── clients/          # API clients
│   ├── exa-context.ts
│   ├── exa-search.ts
│   ├── exa-contents.ts
│   ├── exa-websets.ts
│   └── exa-research.ts
├── util/             # Utilities
│   ├── concurrency.ts
│   ├── http.ts
│   ├── streaming.ts
│   └── fs.ts
└── webhook/          # Webhook server
```

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
```

## CLI Options

Global options:
- `-c, --concurrency <number>`: Concurrency for batch operations (default: 5)
- `-t, --timeout <number>`: Request timeout in milliseconds (default: 30000)
- `--compact`: Output compact JSON
- `--silent`: Suppress event streaming

## API Endpoints Supported

1. **Context** (`/context`) - Code-oriented responses
2. **Search** (`/search`) - Semantic and keyword search
3. **Contents** (`/contents`) - Content extraction with livecrawl and subpages
4. **Websets** (`/websets/*`) - Async search and enrichment containers
5. **Research** (`/research`) - Async multi-step research pipelines

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
  "citations": [...],
  "data": { ... }
}
```

## Event Streaming

Events are streamed to stderr in JSONL format for progress tracking:

```json
{"level":"info","type":"task.started","message":"Task started: context","ts":"2024-01-01T00:00:00Z","taskId":"task-123","meta":{}}
{"level":"info","type":"api.request","message":"API request: POST /context","ts":"2024-01-01T00:00:01Z","taskId":"task-123","meta":{}}
{"level":"info","type":"task.completed","message":"Task completed: context","ts":"2024-01-01T00:01:00Z","taskId":"task-123","meta":{}}
```

## Error Handling

The tool implements comprehensive error handling:
- Retries with exponential backoff
- Circuit breaker for upstream failures
- Graceful degradation for cached data
- Structured error responses

## Droid Integration

The tool includes `.tool-contract.json` for agent-driven invocation, supporting:
- Schema validation for inputs/outputs
- Streaming semantics
- Batch processing capabilities
- Async operation support

## License

MIT
