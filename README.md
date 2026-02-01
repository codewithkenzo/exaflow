<p align="center"><img src="assets/logo.png" width="120" alt="exaflow logo"></p>

# ExaFlow: Advanced Semantic Search & AI Integration

<div align="center">

[![npm version](https://img.shields.io/npm/v/exaflow)](https://www.npmjs.com/package/exaflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0+-f9f1e1.svg)](https://bun.sh)

**AI-Powered Search • Intelligent Content • MCP Integration • Lightning Fast**

</div>

## What is ExaFlow?

**Semantic search toolkit for AI applications.** Built with TypeScript, ExaFlow combines Exa's neural search with intelligent caching, real-time streaming, and MCP integration.

Perfect for:
- 🤖 AI applications with enhanced search
- 🔬 Research automation & multi-step pipelines
- 📰 Content analysis with live crawling
- 🛠️ Developer tools & CLI workflows
- 🏢 Enterprise search with advanced filtering

## Installation

### Using Bun (Recommended)
```bash
bun install -g exaflow
```

### Using npm
```bash
npm install -g exaflow
```

### Verify
```bash
exaflow --version
```

## Setup

Create a `.env` file with your Exa API key:
```env
EXA_API_KEY=your_exa_api_key_here
```

## Usage

### 📚 Context API
Get code & technical content with token limits.
```bash
exaflow context "React hooks patterns" --tokens 3000
exaflow context "TypeScript patterns" --tokens 5000
```

### 🔍 Search API
Semantic search with neural ranking.
```bash
exaflow search "machine learning trends 2024" --type neural --num-results 20
exaflow search "AI research papers" --type neural --include-contents
```

### 📄 Contents API
Extract content from URLs with live crawling.
```bash
exaflow contents --ids urls.txt --livecrawl always --subpages 5
exaflow contents --stdin --subpage-target "about,news"
```

### 🌐 Websets API
Async search with enrichment & polling.
```bash
WEBSET_ID=$(exaflow websets create --output json | jq -r '.data.webset.id')
exaflow websets search --webset-id $WEBSET_ID --search-query "AI research"
exaflow websets poll --webset-id $WEBSET_ID
```

### 🔬 Research API
Multi-step research with structured output.
```bash
exaflow research --instructions "Analyze latest AI trends" --poll
exaflow research --instructions-file prompt.md --schema output-schema.json
```

### 🤖 MCP Server
Integrate with AI applications.
```bash
exaflow mcp-server
exaflow mcp-server --transport http --port 3000
exaflow-mcp  # Global binary
```

## Options

```bash
-c, --concurrency <number>    # Parallel operations (1-20, default: 5)
-t, --timeout <number>        # Request timeout in ms (default: 30000)
--compact                     # Compact JSON output
--silent                      # Suppress event streaming
--output <format>             # Output format: json|text (default: json)
```

## Architecture

```
src/
├── clients/           # Exa API clients
│   ├── base-client.ts
│   ├── exa-context.ts
│   ├── exa-search.ts
│   ├── exa-contents.ts
│   ├── exa-websets.ts
│   └── exa-research.ts
├── util/              # Utilities
│   ├── concurrency.ts
│   ├── http.ts
│   ├── http-cache.ts
│   ├── streaming.ts
│   └── fs.ts
├── cli.ts
├── mcp-server.ts
└── schema.ts
```

## Response Format

All commands return structured JSON with status, timing, citations, and data:

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
  "data": {}
}
```

## Development

```bash
bun install           # Install dependencies
bun run build         # Build project
bun run dev           # CLI development
bun run dev:mcp       # MCP server development
```

## Performance

- ⚡ **885,371 requests/second** - Search throughput
- 💾 **85% cache hit rate** - 40% API call reduction
- 🪶 **<1MB footprint** - Minimal memory overhead
- 🔄 **1-20 parallel ops** - Configurable concurrency

## Security

- ✅ Comprehensive input validation
- 🔐 Secure API key handling
- 🔁 Exponential backoff with jitter
- 🛡️ Graceful degradation on failures
- ⏱️ Per-request timeout controls

---

## License

MIT © 2026 - See [LICENSE](LICENSE) for details.

## Links

- 🐛 [Issues](https://github.com/codewithkenzo/exaflow/issues)
- 💬 [Discussions](https://github.com/codewithkenzo/exaflow/discussions)
- 📦 [npm](https://www.npmjs.com/package/exaflow)

## Built With

- [Exa](https://exa.ai) - Neural search API
- [Bun](https://bun.sh) - JavaScript runtime
- [MCP](https://modelcontextprotocol.io/) - AI integration
- [TypeScript](https://www.typescriptlang.org/) - Type safety

---

<div align="center">

[![semantic-search](https://img.shields.io/badge/semantic-search-blue)](https://github.com/codewithkenzo/exaflow)
[![exa-api](https://img.shields.io/badge/exa-api-blue)](https://exa.ai)
[![ai-integration](https://img.shields.io/badge/ai-integration-blue)](https://github.com/codewithkenzo/exaflow)
[![mcp-protocol](https://img.shields.io/badge/mcp-protocol-blue)](https://modelcontextprotocol.io/)
[![typescript](https://img.shields.io/badge/typescript-toolkit-blue)](https://www.typescriptlang.org/)
[![cli-tool](https://img.shields.io/badge/cli-tool-blue)](https://github.com/codewithkenzo/exaflow)

</div>