# ExaFlow: Advanced Semantic Search & AI Integration

[![npm version](https://badge.fury.io/js/exaflow.svg)](https://badge.fury.io/js/exaflow)
[![Build Status](https://github.com/codewithkenzo/exaflow/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/codewithkenzo/exaflow/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

**AI-Powered Search • Intelligent Content • MCP Integration • Lightning Fast**

## Why ExaFlow?

ExaFlow is a semantic search toolkit for modern developers and AI applications. Built with TypeScript, it combines Exa's neural search with intelligent caching, real-time streaming, and MCP (Model Context Protocol) integration.

## What's New in 2.2.0

- Fixed ConcurrencyPool per-task resolver storage
- Improved MCP HTTP transport with StreamableHTTPServerTransport
- CI/CD improvements and code quality fixes

**Perfect For:**
- AI Applications with enhanced search capabilities
- Research automation with multi-step pipelines
- Content analysis with live crawling
- Developer tools with CLI workflows
- Enterprise search with advanced filtering

## Installation

```bash
# Recommended: Bun runtime
bun install -g exaflow

# Alternative: NPM
npm install -g exaflow

# Verify installation
exaflow --version
```

### GitHub Packages

```bash
npm install @codewithkenzo/exaflow --registry=https://npm.pkg.github.com
```

## Environment Setup

Create a `.env` file with your Exa API key:

```env
EXA_API_KEY=your_exa_api_key_here
```

## Quick Usage

### Context API - Code & Technical Content
```bash
exaflow context "React hooks patterns" --tokens 3000
exaflow context "TypeScript patterns" --tokens 5000
```

### Search API - Semantic Search
```bash
exaflow search "machine learning trends 2024" --type neural --num-results 20
exaflow search "AI research papers" --type neural --include-contents
```

### Contents API - Content Extraction
```bash
exaflow contents --ids urls.txt --livecrawl always --subpages 5
exaflow contents --stdin --subpage-target "about,news"
```

### Websets API - Async Search & Enrichment
```bash
WEBSET_ID=$(exaflow websets create --output json | jq -r '.data.webset.id')
exaflow websets search --webset-id $WEBSET_ID --search-query "AI research"
exaflow websets poll --webset-id $WEBSET_ID
```

### Research API - Multi-Step Research
```bash
exaflow research --instructions "Analyze latest AI trends" --poll
exaflow research --instructions-file prompt.md --schema output-schema.json
```

### MCP Server - AI Integration
```bash
exaflow mcp-server
exaflow mcp-server --transport http --port 3000
exaflow-mcp  # Global binary
```

## Global Options

```bash
-c, --concurrency <number>     # Parallel operations (1-20, default: 5)
-t, --timeout <number>          # Request timeout in ms (default: 30000)
--compact                       # Compact JSON output
--silent                        # Suppress event streaming
--output <format>              # Output format: json|text (default: json)
```

## Architecture

```
src/
├── clients/                   # Exa API clients
│   ├── base-client.ts        # Shared base class
│   ├── exa-context.ts        # Context API
│   ├── exa-search.ts         # Search API
│   ├── exa-contents.ts       # Contents API
│   ├── exa-websets.ts        # Websets API
│   └── exa-research.ts        # Research API
├── util/                      # Utilities
│   ├── concurrency.ts        # Batch processing
│   ├── http.ts               # HTTP client
│   ├── http-cache.ts         # Caching system
│   ├── streaming.ts          # Event streaming
│   └── fs.ts                 # File operations
├── cli.ts                     # CLI interface
├── mcp-server.ts             # MCP server
└── schema.ts                 # Type schemas
```

## Output Format

All commands return structured JSON:

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

## Development

```bash
# Install dependencies
bun install

# Build project
bun run build

# Development mode
bun run dev         # CLI development
bun run dev:mcp     # MCP server development
```

## Performance

- **Search Operations**: 885,371 requests/second
- **Cache Hit Rate**: 85% average (40% API call reduction)
- **Memory Efficiency**: <1MB base footprint
- **Concurrency**: 1-20 parallel operations

## Security & Reliability

- **Input Validation**: Comprehensive schema validation
- **API Key Protection**: Secure environment variable handling
- **Retry Logic**: Exponential backoff with jitter
- **Graceful Degradation**: Handles partial failures
- **Timeout Management**: Per-request and global controls

## Package Managers

- **NPM**: `npm install -g exaflow`
- **Bun**: `bun install -g exaflow` (recommended)
- **Yarn**: `yarn global add exaflow`
- **PNPM**: `pnpm add -g exaflow`

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Bun**: 1.0.0 or higher (recommended)
- **Memory**: 512MB minimum, 1GB recommended
- **Disk**: 100MB for installation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **[Exa](https://exa.ai)** - Neural search API
- **[Bun](https://bun.sh)** - JavaScript runtime
- **[MCP](https://modelcontextprotocol.io/)** - AI integration protocol
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development

## Support

- **Issues**: [GitHub Issues](https://github.com/codewithkenzo/exaflow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/codewithkenzo/exaflow/discussions)