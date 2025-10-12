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
    version: '2.0.0',
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

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Validate args exists
    if (!args || typeof args !== 'object') {
      throw new Error('Tool arguments are required');
    }

    switch (name) {
      case 'exa_semantic_search': {
        if (!args.query || typeof args.query !== 'string') {
          throw new Error('query parameter is required and must be a string');
        }
        
        const result = await runSearchTask(args.query, {
          searchType: args.searchType || 'neural',
          numResults: args.numResults || 10,
          includeContents: args.includeContents || false,
          startDate: args.startDate,
          endDate: args.endDate,
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
        if (!args.query || typeof args.query !== 'string') {
          throw new Error('query parameter is required and must be a string');
        }
        
        const result = await runContextTask(args.query, {
          tokens: args.tokens || 5000,
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
        if (!args.query || typeof args.query !== 'string') {
          throw new Error('query parameter is required and must be a string');
        }
        
        let enhancedQuery = args.query;
        
        if (args.includeProfiles) {
          enhancedQuery += ' site:linkedin.com';
        }
        
        if (args.includeCompanies) {
          enhancedQuery += ' company OR corporation OR startup';
        }
        
        if (args.location) {
          enhancedQuery += ` ${args.location}`;
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
        let enhancedQuery = args.query;
        
        if (args.repositories) {
          enhancedQuery += ' site:github.com OR site:gitlab.com';
        }
        
        if (args.documentation) {
          enhancedQuery += ' documentation OR tutorial OR guide';
        }
        
        if (args.language) {
          enhancedQuery += ` ${args.language} programming`;
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
        let enhancedQuery = args.query;
        const sources = Array.isArray(args.sources) ? args.sources : ['wikipedia'];
        
        if (sources.includes('wikipedia')) {
          enhancedQuery += ' site:wikipedia.org';
        }
        
        if (sources.includes('government')) {
          enhancedQuery += ' site:.gov';
        }
        
        if (sources.includes('educational')) {
          enhancedQuery += ' site:.edu OR educational';
        }
        
        if (sources.includes('news')) {
          enhancedQuery += ' news OR encyclopedia';
        }

        const result = await runSearchTask(enhancedQuery, {
          searchType: 'neural',
          numResults: 12,
          includeContents: args.depth === 'comprehensive',
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
        if (!args.urls || !Array.isArray(args.urls)) {
          throw new Error('urls parameter is required and must be an array');
        }
        
        const result = await runContentsTask(args.urls, {
          livecrawl: args.livecrawl || 'fallback',
          subpages: args.subpages || 0,
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
          text: JSON.stringify({
            status: 'error',
            error: errorMessage,
            tool: name,
            arguments: args,
          }, null, 2),
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  if (process.env.NODE_ENV !== 'production') {
    console.error('ExaFlow MCP server running on stdio');
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
