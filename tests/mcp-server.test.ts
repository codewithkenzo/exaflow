#!/usr/bin/env bun

/**
 * MCP Server Tests
 * Tests for Model Context Protocol server functionality
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Mock the Exa functions
mock.module('../src/index', () => ({
  runSearchTask: mock(async (query, options) => ({
    status: 'success',
    taskId: options.taskId,
    timing: { startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:00:05Z', duration: 5000 },
    citations: [
      { url: 'https://example.com', title: 'Example Result', author: 'Test Author' }
    ],
    data: {
      results: [
        {
          id: '1',
          url: 'https://example.com',
          title: 'Example Result',
          publishedDate: '2024-01-01T00:00:00Z',
          author: 'Test Author',
          score: 0.95,
        }
      ],
      totalResults: 1,
      query: query,
      searchType: options.searchType,
    },
  })),
  runContextTask: mock(async (query, options) => ({
    status: 'success',
    taskId: options.taskId,
    timing: { startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:00:03Z', duration: 3000 },
    citations: [
      { url: 'https://research.com', title: 'Research Paper', snippet: 'Research summary' }
    ],
    data: {
      response: `Research results for: ${query}`,
      metadata: {
        query: query,
        tokensNum: options.tokens,
        model: 'claude-3-haiku-20240307',
        sources: [
          { url: 'https://research.com', title: 'Research Paper', snippet: 'Research summary' }
        ],
      },
    },
  })),
  runContentsTask: mock(async (urls, options) => ({
    status: 'success',
    taskId: options.taskId,
    timing: { startedAt: '2024-01-01T00:00:00Z', completedAt: '2024-01-01T00:01:00Z', duration: 60000 },
    citations: [],
    data: {
      results: urls.map(url => ({
        id: url,
        url: url,
        title: `Content from ${url}`,
        text: `Extracted content from ${url}`,
      })),
    },
  })),
}));

// Mock environment
mock.module('../src/env', () => ({
  loadEnv: () => {
    // Do nothing
  },
  getEnv: () => ({ EXA_API_KEY: 'test-api-key' }),
}));

describe('MCP Server', () => {
  let server: Server;

  beforeEach(() => {
    // Import and create server instance
    const { default: createServer } = require('../src/mcp-server');
    server = createServer();
  });

  describe('Tool Registration', () => {
    it('should register all expected tools', async () => {
      const request = {
        params: {},
      };

      const result = await server.request(
        { method: 'tools/list', ...request },
        ListToolsRequestSchema
      );

      expect(result.tools).toHaveLength(6);

      const toolNames = result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('exa_semantic_search');
      expect(toolNames).toContain('exa_research_discovery');
      expect(toolNames).toContain('exa_professional_finder');
      expect(toolNames).toContain('exa_code_discovery');
      expect(toolNames).toContain('exa_knowledge_graph');
      expect(toolNames).toContain('exa_content_extract');
    });

    it('should have proper tool schemas', async () => {
      const request = {
        params: {},
      };

      const result = await server.request(
        { method: 'tools/list', ...request },
        ListToolsRequestSchema
      );

      const searchTool = result.tools.find((tool: any) => tool.name === 'exa_semantic_search');
      expect(searchTool).toBeDefined();
      expect(searchTool.description).toContain('semantic search');
      expect(searchTool.inputSchema.properties.query).toBeDefined();
      expect(searchTool.inputSchema.properties.searchType).toBeDefined();
      expect(searchTool.inputSchema.required).toContain('query');
    });
  });

  describe('Tool Execution - exa_semantic_search', () => {
    it('should execute semantic search with valid arguments', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            query: 'machine learning trends',
            searchType: 'neural',
            numResults: 5,
            includeContents: true,
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');
      expect(responseData.data.results).toHaveLength(1);
      expect(responseData.data.results[0].title).toBe('Example Result');
      expect(responseData.citations).toHaveLength(1);
    });

    it('should validate required query parameter', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            searchType: 'neural',
            numResults: 5,
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('query parameter is required');
    });

    it('should sanitize dangerous input', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            query: '<script>alert("xss")</script>machine learning',
            searchType: 'neural',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('dangerous content');
    });

    it('should validate searchType enum values', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            query: 'test query',
            searchType: 'invalid-type',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      // Should default to 'neural' when invalid type is provided
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');
    });

    it('should validate date formats', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            query: 'test query',
            startDate: '2024-13-45', // Invalid date
            endDate: 'invalid-date',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('Invalid date format');
    });
  });

  describe('Tool Execution - exa_research_discovery', () => {
    it('should execute research discovery with valid arguments', async () => {
      const request = {
        params: {
          name: 'exa_research_discovery',
          arguments: {
            query: 'artificial intelligence research',
            tokens: 10000,
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');
      expect(responseData.data.response).toContain('artificial intelligence research');
      expect(responseData.data.metadata.tokensNum).toBe(10000);
    });

    it('should validate tokens parameter bounds', async () => {
      const request = {
        params: {
          name: 'exa_research_discovery',
          arguments: {
            query: 'test query',
            tokens: 50000, // Valid
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');
    });
  });

  describe('Tool Execution - exa_professional_finder', () => {
    it('should enhance query with professional search terms', async () => {
      const request = {
        params: {
          name: 'exa_professional_finder',
          arguments: {
            query: 'software engineer',
            includeProfiles: true,
            includeCompanies: true,
            location: 'San Francisco',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');

      // Verify the query was enhanced with professional search terms
      const { runSearchTask } = require('../src/index');
      expect(runSearchTask).toHaveBeenCalledWith(
        expect.stringContaining('software engineer'),
        expect.objectContaining({
          searchType: 'neural',
          numResults: 15,
        })
      );
    });
  });

  describe('Tool Execution - exa_code_discovery', () => {
    it('should enhance query with code discovery terms', async () => {
      const request = {
        params: {
          name: 'exa_code_discovery',
          arguments: {
            query: 'machine learning',
            repositories: true,
            documentation: true,
            language: 'Python',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');

      // Verify the query was enhanced with code discovery terms
      const { runSearchTask } = require('../src/index');
      expect(runSearchTask).toHaveBeenCalledWith(
        expect.stringContaining('Python programming'),
        expect.objectContaining({
          searchType: 'neural',
        })
      );
    });
  });

  describe('Tool Execution - exa_knowledge_graph', () => {
    it('should enhance query with knowledge sources', async () => {
      const request = {
        params: {
          name: 'exa_knowledge_graph',
          arguments: {
            query: 'climate change',
            sources: ['wikipedia', 'government', 'educational'],
            depth: 'comprehensive',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');

      // Verify the query was enhanced with knowledge source domains
      const { runSearchTask } = require('../src/index');
      expect(runSearchTask).toHaveBeenCalledWith(
        expect.stringContaining('site:wikipedia.org'),
        expect.objectContaining({
          includeContents: true, // Should be true for comprehensive depth
        })
      );
    });
  });

  describe('Tool Execution - exa_content_extract', () => {
    it('should extract content from valid URLs', async () => {
      const request = {
        params: {
          name: 'exa_content_extract',
          arguments: {
            urls: [
              'https://example.com/article1',
              'https://test.org/article2',
            ],
            livecrawl: 'always',
            subpages: 3,
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success');
      expect(responseData.data.results).toHaveLength(2);
      expect(responseData.data.results[0].url).toBe('https://example.com/article1');
    });

    it('should validate URLs format', async () => {
      const request = {
        params: {
          name: 'exa_content_extract',
          arguments: {
            urls: [
              'https://valid.com',
              'invalid-url',
              'ftp://invalid-protocol.com',
            ],
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('Invalid URL');
    });

    it('should validate URLs array length', async () => {
      const request = {
        params: {
          name: 'exa_content_extract',
          arguments: {
            urls: [], // Empty array
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('URLs array must contain between 1 and 20 URLs');
    });

    it('should validate livecrawl enum values', async () => {
      const request = {
        params: {
          name: 'exa_content_extract',
          arguments: {
            urls: ['https://example.com'],
            livecrawl: 'invalid-option',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('success'); // Should default to 'fallback'
    });
  });

  describe('Security and Input Validation', () => {
    it('should prevent prototype pollution', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            query: 'test query',
            __proto__: { isAdmin: true },
            constructor: { prototype: { dangerous: true } },
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('Invalid arguments object');
    });

    it('should handle missing arguments object', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: null,
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('Tool arguments are required');
    });

    it('should handle unknown tool names', async () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {
            query: 'test query',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('Unknown tool: unknown_tool');
    });

    it('should handle extremely long inputs', async () => {
      const longQuery = 'a'.repeat(10001); // Exceeds 5000 character limit
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            query: longQuery,
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.status).toBe('error');
      expect(responseData.error).toContain('maximum length');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      const request = {
        params: {
          name: 'exa_semantic_search',
          arguments: {
            query: 'test query',
            startDate: 'invalid-date',
          },
        },
      };

      const result = await server.request(
        { method: 'tools/call', ...request },
        CallToolRequestSchema
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toHaveProperty('status', 'error');
      expect(responseData).toHaveProperty('error');
      expect(responseData).toHaveProperty('tool', 'exa_semantic_search');
      expect(responseData).toHaveProperty('arguments');
    });
  });
});