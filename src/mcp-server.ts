#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { runTask, runContextTask, runSearchTask, runContentsTask } from './index.js';
import { loadEnv } from './env.js';

// Load environment
loadEnv();

// Create MCP server
const server = new Server(
  {
    name: 'exaflow',
    version: '2.1.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool schemas
const ExaSemanticSearchTool: Tool = {
  name: 'exa_semantic_search',
  description: 'Advanced semantic search with filtering options using Exa API',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      searchType: {
        type: 'string',
        enum: ['auto', 'keyword', 'neural', 'fast'],
        description: 'Search algorithm type',
        default: 'neural',
      },
      numResults: {
        type: 'number',
        description: 'Number of results to return (1-50)',
        minimum: 1,
        maximum: 50,
        default: 10,
      },
      includeContents: {
        type: 'boolean',
        description: 'Include full content in results',
        default: false,
      },
      contentType: {
        type: 'string',
        enum: ['all', 'papers', 'blogs', 'repos', 'profiles', 'news', 'knowledge'],
        description: 'Filter by content type',
        default: 'all',
      },
      startDate: {
        type: 'string',
        description: 'Start date filter (ISO 8601 format)',
      },
      endDate: {
        type: 'string',
        description: 'End date filter (ISO 8601 format)',
      },
      language: {
        type: 'string',
        description: 'Language code (e.g., en, es, fr)',
        default: 'en',
      },
    },
    required: ['query'],
  },
};

const ExaResearchDiscoveryTool: Tool = {
  name: 'exa_research_discovery',
  description: 'Academic paper and citation exploration using Exa Context API',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Research query or topic',
      },
      tokens: {
        type: 'number',
        description: 'Number of tokens for the response (100-50000)',
        minimum: 100,
        maximum: 50000,
        default: 5000,
      },
      focus: {
        type: 'string',
        enum: ['papers', 'citations', 'methods', 'results', 'discussion'],
        description: 'Research focus area',
        default: 'papers',
      },
    },
    required: ['query'],
  },
};

const ExaProfessionalFinderTool: Tool = {
  name: 'exa_professional_finder',
  description: 'LinkedIn profile and company intelligence search',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Professional search query (e.g., "software engineer at Google")',
      },
      includeProfiles: {
        type: 'boolean',
        description: 'Include LinkedIn profiles',
        default: true,
      },
      includeCompanies: {
        type: 'boolean',
        description: 'Include company information',
        default: true,
      },
      location: {
        type: 'string',
        description: 'Geographic location filter',
      },
    },
    required: ['query'],
  },
};

const ExaCodeDiscoveryTool: Tool = {
  name: 'exa_code_discovery',
  description: 'GitHub repository and technical content search',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Code or technical search query',
      },
      language: {
        type: 'string',
        description: 'Programming language filter',
      },
      repositories: {
        type: 'boolean',
        description: 'Include GitHub repositories',
        default: true,
      },
      documentation: {
        type: 'boolean',
        description: 'Include technical documentation',
        default: true,
      },
    },
    required: ['query'],
  },
};

const ExaKnowledgeGraphTool: Tool = {
  name: 'exa_knowledge_graph',
  description: 'Wikipedia and knowledge base exploration',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Knowledge search query',
      },
      sources: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['wikipedia', 'government', 'educational', 'news'],
        },
        description: 'Preferred knowledge sources',
        default: ['wikipedia'],
      },
      depth: {
        type: 'string',
        enum: ['overview', 'detailed', 'comprehensive'],
        description: 'Depth of knowledge exploration',
        default: 'detailed',
      },
    },
    required: ['query'],
  },
};

const ExaContentExtractTool: Tool = {
  name: 'exa_content_extract',
  description: 'Full content retrieval and summarization from URLs',
  inputSchema: {
    type: 'object',
    properties: {
      urls: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uri',
        },
        description: 'Array of URLs to extract content from',
      },
      livecrawl: {
        type: 'string',
        enum: ['always', 'fallback', 'never'],
        description: 'Live crawl behavior',
        default: 'fallback',
      },
      subpages: {
        type: 'number',
        description: 'Number of subpages to crawl (0-20)',
        minimum: 0,
        maximum: 20,
        default: 0,
      },
      summarize: {
        type: 'boolean',
        description: 'Generate summary of extracted content',
        default: false,
      },
    },
    required: ['urls'],
  },
};

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ExaSemanticSearchTool,
      ExaResearchDiscoveryTool,
      ExaProfessionalFinderTool,
      ExaCodeDiscoveryTool,
      ExaKnowledgeGraphTool,
      ExaContentExtractTool,
    ],
  };
});

// Sanitization utilities
function sanitizeString(input: any, maxLength = 10000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove potentially dangerous characters
  const sanitized = input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[\uFFFE\uFFFF]/g, '') // Remove non-characters
    .trim();

  // Check length
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /__proto__/i,
    /constructor/i,
    /prototype/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      throw new Error('Input contains potentially dangerous content');
    }
  }

  return sanitized;
}

function validateDate(dateString: string): void {
  // Validate ISO 8601 date format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!iso8601Regex.test(dateString)) {
    throw new Error(
      'Invalid date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)'
    );
  }
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  // Type assertion for arguments object (moved outside try block)
  const typedArgs = args as Record<string, any>;

  try {
    // Validate args exists and add proper type annotation
    if (!args || typeof args !== 'object') {
      throw new Error('Tool arguments are required');
    }

    // Prevent prototype pollution (check for dangerous property access)
    if (
      typedArgs.hasOwnProperty('__proto__') ||
      typedArgs.hasOwnProperty('constructor') ||
      typedArgs.hasOwnProperty('prototype')
    ) {
      throw new Error('Invalid arguments object');
    }

    switch (name) {
      case 'exa_semantic_search': {
        if (!typedArgs.query || typeof typedArgs.query !== 'string') {
          throw new Error('query parameter is required and must be a string');
        }

        // Sanitize and validate inputs
        const sanitizedQuery = sanitizeString(typedArgs.query, 5000);
        const searchType =
          typedArgs.searchType &&
          ['auto', 'keyword', 'neural', 'fast'].includes(typedArgs.searchType)
            ? (typedArgs.searchType as 'auto' | 'keyword' | 'neural' | 'fast')
            : 'neural';
        const numResults =
          typeof typedArgs.numResults === 'number' &&
          typedArgs.numResults >= 1 &&
          typedArgs.numResults <= 50
            ? typedArgs.numResults
            : 10;
        const includeContents = Boolean(typedArgs.includeContents);
        const startDate = typedArgs.startDate
          ? (() => {
              validateDate(typedArgs.startDate as string);
              return typedArgs.startDate as string;
            })()
          : undefined;
        const endDate = typedArgs.endDate
          ? (() => {
              validateDate(typedArgs.endDate as string);
              return typedArgs.endDate as string;
            })()
          : undefined;

        const result = await runSearchTask(sanitizedQuery, {
          searchType,
          numResults,
          includeContents,
          startDate,
          endDate,
          timeout: 30000,
          retries: 3,
          taskId: `mcp-search-${Date.now()}`,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'exa_research_discovery': {
        if (!typedArgs.query || typeof typedArgs.query !== 'string') {
          throw new Error('query parameter is required and must be a string');
        }

        // Sanitize and validate inputs
        const sanitizedQuery = sanitizeString(typedArgs.query, 5000);
        const tokens =
          typeof typedArgs.tokens === 'number' &&
          typedArgs.tokens >= 100 &&
          typedArgs.tokens <= 50000
            ? typedArgs.tokens
            : 5000;

        const result = await runContextTask(sanitizedQuery, {
          tokens,
          timeout: 30000,
          retries: 3,
          taskId: `mcp-research-${Date.now()}`,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'exa_professional_finder': {
        if (!typedArgs.query || typeof typedArgs.query !== 'string') {
          throw new Error('query parameter is required and must be a string');
        }

        // Sanitize query first
        let enhancedQuery = sanitizeString(typedArgs.query, 5000);

        if (typedArgs.includeProfiles) {
          enhancedQuery += ' site:linkedin.com';
        }

        if (typedArgs.includeCompanies) {
          enhancedQuery += ' company OR corporation OR startup';
        }

        // Sanitize location before concatenation to prevent injection
        if (typedArgs.location) {
          const sanitizedLocation = sanitizeString(typedArgs.location, 500);
          enhancedQuery += ` ${sanitizedLocation}`;
        }

        const result = await runSearchTask(enhancedQuery, {
          searchType: 'neural',
          numResults: 15,
          includeContents: false,
          timeout: 30000,
          retries: 3,
          taskId: `mcp-professional-${Date.now()}`,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'exa_code_discovery': {
        // Sanitize query first
        let enhancedQuery = sanitizeString(typedArgs.query, 5000);

        if (typedArgs.repositories) {
          enhancedQuery += ' site:github.com OR site:gitlab.com';
        }

        if (typedArgs.documentation) {
          enhancedQuery += ' documentation OR tutorial OR guide';
        }

        // Sanitize language before concatenation to prevent injection
        if (typedArgs.language) {
          const sanitizedLanguage = sanitizeString(typedArgs.language, 100);
          enhancedQuery += ` ${sanitizedLanguage} programming`;
        }

        const result = await runSearchTask(enhancedQuery, {
          searchType: 'neural',
          numResults: 15,
          includeContents: false,
          timeout: 30000,
          retries: 3,
          taskId: `mcp-code-${Date.now()}`,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'exa_knowledge_graph': {
        // Sanitize query first
        let enhancedQuery = sanitizeString(typedArgs.query, 5000);

        // Sanitize and validate sources array
        const rawSources = Array.isArray(typedArgs.sources) ? typedArgs.sources : ['wikipedia'];
        const allowedSources = ['wikipedia', 'government', 'educational', 'news'];
        const sanitizedSources = rawSources
          .filter(source => typeof source === 'string' && allowedSources.includes(source))
          .map(source => sanitizeString(source, 100));

        if (sanitizedSources.includes('wikipedia')) {
          enhancedQuery += ' site:wikipedia.org';
        }

        if (sanitizedSources.includes('government')) {
          enhancedQuery += ' site:.gov';
        }

        if (sanitizedSources.includes('educational')) {
          enhancedQuery += ' site:.edu OR educational';
        }

        if (sanitizedSources.includes('news')) {
          enhancedQuery += ' news OR encyclopedia';
        }

        const result = await runSearchTask(enhancedQuery, {
          searchType: 'neural',
          numResults: 12,
          includeContents: typedArgs.depth === 'comprehensive',
          timeout: 30000,
          retries: 3,
          taskId: `mcp-knowledge-${Date.now()}`,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'exa_content_extract': {
        if (!typedArgs.urls || !Array.isArray(typedArgs.urls)) {
          throw new Error('urls parameter is required and must be an array');
        }

        if (typedArgs.urls.length === 0 || typedArgs.urls.length > 20) {
          throw new Error('URLs array must contain between 1 and 20 URLs');
        }

        // Validate and sanitize URLs
        const validUrls: string[] = [];
        for (const url of typedArgs.urls) {
          if (typeof url !== 'string') {
            throw new Error('All URLs must be strings');
          }

          const sanitizedUrl = sanitizeString(url, 2048);

          // Basic URL validation
          try {
            const urlObj = new URL(sanitizedUrl);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
              throw new Error('Only HTTP and HTTPS URLs are allowed');
            }
            validUrls.push(sanitizedUrl);
          } catch {
            throw new Error(`Invalid URL: ${sanitizedUrl}`);
          }
        }

        const livecrawl =
          typedArgs.livecrawl && ['always', 'fallback', 'never'].includes(typedArgs.livecrawl)
            ? (typedArgs.livecrawl as 'always' | 'fallback' | 'never')
            : 'fallback';
        const subpages =
          typeof typedArgs.subpages === 'number' &&
          typedArgs.subpages >= 0 &&
          typedArgs.subpages <= 20
            ? typedArgs.subpages
            : 0;

        const result = await runContentsTask(validUrls, {
          livecrawl,
          subpages,
          timeout: 60000,
          retries: 3,
          taskId: `mcp-contents-${Date.now()}`,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'error',
              error: errorMessage,
              tool: name,
              arguments: typedArgs,
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

// HTTP Server implementation for testing
async function startHttpServer(port: number) {
  const { createServer } = await import('http');

  const httpServer = createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const response = await server.request(request, {
          signal: AbortSignal.timeout(30000),
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('HTTP MCP Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error)
          }
        }));
      }
    });
  });

  return new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => {
      console.error(`ExaFlow MCP server running on HTTP port ${port}`);
      resolve();
    }).on('error', reject);
  });
}

// Start the server
async function main() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const httpMode = portIndex !== -1;

  if (httpMode) {
    const port = parseInt(args[portIndex + 1]) || 3000;
    await startHttpServer(port);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    if (process.env.NODE_ENV !== 'production') {
      console.error('ExaFlow MCP server running on stdio');
    }
  }
}

main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});
