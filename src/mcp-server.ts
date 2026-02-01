#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  isInitializeRequest,
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
    version: '2.2.0',
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

// Tool handler utilities

/**
 * Creates standardized success response
 */
function createSuccessResponse(result: unknown): {
  content: Array<{ type: string; text: string }>;
} {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Creates standardized error response
 */
function createErrorResponse(
  error: unknown,
  toolName: string,
  args: Record<string, any>
): { content: Array<{ type: string; text: string }> } {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            status: 'error',
            error: errorMessage,
            tool: toolName,
            arguments: args,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Extracts and validates search type from arguments
 */
function extractSearchType(args: Record<string, any>): 'auto' | 'keyword' | 'neural' | 'fast' {
  const validTypes = ['auto', 'keyword', 'neural', 'fast'];
  return args.searchType && validTypes.includes(args.searchType) ? args.searchType : 'neural';
}

/**
 * Extracts and validates number results from arguments
 */
function extractNumResults(args: Record<string, any>, defaultValue = 10): number {
  const num = args.numResults;
  return typeof num === 'number' && num >= 1 && num <= 50 ? num : defaultValue;
}

/**
 * Extracts and validates optional date from arguments
 */
function extractOptionalDate(args: Record<string, any>, key: string): string | undefined {
  if (!args[key]) return undefined;
  validateDate(args[key] as string);
  return args[key] as string;
}

/**
 * Validates required query parameter
 */
function validateQueryParam(args: Record<string, any>): void {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query parameter is required and must be a string');
  }
}

/**
 * Builds enhanced query for professional search
 */
function buildProfessionalQuery(args: Record<string, any>): string {
  let enhancedQuery = sanitizeString(args.query, 5000);

  if (args.includeProfiles) {
    enhancedQuery += ' site:linkedin.com';
  }

  if (args.includeCompanies) {
    enhancedQuery += ' company OR corporation OR startup';
  }

  if (args.location) {
    const sanitizedLocation = sanitizeString(args.location, 500);
    enhancedQuery += ` ${sanitizedLocation}`;
  }

  return enhancedQuery;
}

/**
 * Builds enhanced query for code discovery
 */
function buildCodeQuery(args: Record<string, any>): string {
  let enhancedQuery = sanitizeString(args.query, 5000);

  if (args.repositories) {
    enhancedQuery += ' site:github.com OR site:gitlab.com';
  }

  if (args.documentation) {
    enhancedQuery += ' documentation OR tutorial OR guide';
  }

  if (args.language) {
    const sanitizedLanguage = sanitizeString(args.language, 100);
    enhancedQuery += ` ${sanitizedLanguage} programming`;
  }

  return enhancedQuery;
}

/**
 * Builds enhanced query for knowledge graph search
 */
function buildKnowledgeQuery(args: Record<string, any>): string {
  let enhancedQuery = sanitizeString(args.query, 5000);

  const rawSources = Array.isArray(args.sources) ? args.sources : ['wikipedia'];
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

  return enhancedQuery;
}

/**
 * Validates and sanitizes URL list from arguments
 */
function validateAndSanitizeUrls(args: Record<string, any>): string[] {
  if (!args.urls || !Array.isArray(args.urls)) {
    throw new Error('urls parameter is required and must be an array');
  }

  if (args.urls.length === 0 || args.urls.length > 20) {
    throw new Error('URLs array must contain between 1 and 20 URLs');
  }

  const validUrls: string[] = [];
  for (const url of args.urls) {
    if (typeof url !== 'string') {
      throw new Error('All URLs must be strings');
    }

    const sanitizedUrl = sanitizeString(url, 2048);

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

  return validUrls;
}

/**
 * Extracts livecrawl mode from arguments
 */
function extractLivecrawlMode(args: Record<string, any>): 'always' | 'fallback' | 'never' {
  const validModes = ['always', 'fallback', 'never'];
  return args.livecrawl && validModes.includes(args.livecrawl) ? args.livecrawl : 'fallback';
}

/**
 * Extracts subpages count from arguments
 */
function extractSubpages(args: Record<string, any>): number {
  const num = args.subpages;
  return typeof num === 'number' && num >= 0 && num <= 20 ? num : 0;
}

// Individual tool handlers

/**
 * Handles exa_semantic_search tool
 */
async function handleSemanticSearch(args: Record<string, any>): Promise<any> {
  validateQueryParam(args);

  const sanitizedQuery = sanitizeString(args.query, 5000);
  const searchType = extractSearchType(args);
  const numResults = extractNumResults(args);
  const includeContents = Boolean(args.includeContents);
  const startDate = extractOptionalDate(args, 'startDate');
  const endDate = extractOptionalDate(args, 'endDate');

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

  return createSuccessResponse(result);
}

/**
 * Handles exa_research_discovery tool
 */
async function handleResearchDiscovery(args: Record<string, any>): Promise<any> {
  validateQueryParam(args);

  const sanitizedQuery = sanitizeString(args.query, 5000);
  const tokens =
    typeof args.tokens === 'number' && args.tokens >= 100 && args.tokens <= 50000
      ? args.tokens
      : 5000;

  const result = await runContextTask(sanitizedQuery, {
    tokens,
    timeout: 30000,
    retries: 3,
    taskId: `mcp-research-${Date.now()}`,
  });

  return createSuccessResponse(result);
}

/**
 * Handles exa_professional_finder tool
 */
async function handleProfessionalFinder(args: Record<string, any>): Promise<any> {
  validateQueryParam(args);

  const enhancedQuery = buildProfessionalQuery(args);

  const result = await runSearchTask(enhancedQuery, {
    searchType: 'neural',
    numResults: 15,
    includeContents: false,
    timeout: 30000,
    retries: 3,
    taskId: `mcp-professional-${Date.now()}`,
  });

  return createSuccessResponse(result);
}

/**
 * Handles exa_code_discovery tool
 */
async function handleCodeDiscovery(args: Record<string, any>): Promise<any> {
  validateQueryParam(args);

  const enhancedQuery = buildCodeQuery(args);

  const result = await runSearchTask(enhancedQuery, {
    searchType: 'neural',
    numResults: 15,
    includeContents: false,
    timeout: 30000,
    retries: 3,
    taskId: `mcp-code-${Date.now()}`,
  });

  return createSuccessResponse(result);
}

/**
 * Handles exa_knowledge_graph tool
 */
async function handleKnowledgeGraph(args: Record<string, any>): Promise<any> {
  validateQueryParam(args);

  const enhancedQuery = buildKnowledgeQuery(args);

  const result = await runSearchTask(enhancedQuery, {
    searchType: 'neural',
    numResults: 12,
    includeContents: args.depth === 'comprehensive',
    timeout: 30000,
    retries: 3,
    taskId: `mcp-knowledge-${Date.now()}`,
  });

  return createSuccessResponse(result);
}

/**
 * Handles exa_content_extract tool
 */
async function handleContentExtract(args: Record<string, any>): Promise<any> {
  const validUrls = validateAndSanitizeUrls(args);
  const livecrawl = extractLivecrawlMode(args);
  const subpages = extractSubpages(args);

  const result = await runContentsTask(validUrls, {
    livecrawl,
    subpages,
    timeout: 60000,
    retries: 3,
    taskId: `mcp-contents-${Date.now()}`,
  });

  return createSuccessResponse(result);
}

/**
 * Routes tool call to appropriate handler
 */
async function routeToolCall(name: string, args: Record<string, any>): Promise<any> {
  switch (name) {
    case 'exa_semantic_search':
      return handleSemanticSearch(args);
    case 'exa_research_discovery':
      return handleResearchDiscovery(args);
    case 'exa_professional_finder':
      return handleProfessionalFinder(args);
    case 'exa_code_discovery':
      return handleCodeDiscovery(args);
    case 'exa_knowledge_graph':
      return handleKnowledgeGraph(args);
    case 'exa_content_extract':
      return handleContentExtract(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Validates tool arguments for security
 */
function validateToolArgs(args: Record<string, any>): void {
  if (!args || typeof args !== 'object') {
    throw new Error('Tool arguments are required');
  }

  if (
    Object.prototype.hasOwnProperty.call(args, '__proto__') ||
    Object.prototype.hasOwnProperty.call(args, 'constructor') ||
    Object.prototype.hasOwnProperty.call(args, 'prototype')
  ) {
    throw new Error('Invalid arguments object');
  }
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;
  const typedArgs = args as Record<string, any>;

  try {
    validateToolArgs(typedArgs);
    return await routeToolCall(name, typedArgs);
  } catch (error) {
    return createErrorResponse(error, name, typedArgs);
  }
});

// HTTP Server implementation

/**
 * Sets up CORS headers for HTTP response
 */
function setupCorsHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Handles HTTP OPTIONS request (CORS preflight)
 */
function handleOptionsRequest(res: any): boolean {
  res.writeHead(200);
  res.end();
  return true;
}

/**
 * Validates HTTP request method
 */
function validateHttpMethod(req: any, res: any): boolean {
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(res);
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return false;
  }

  return true;
}

/**
 * Reads request body from HTTP request
 */
function readRequestBody(req: any): Promise<string> {
  return new Promise(resolve => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
  });
}

// HTTP transport instance (created per session)
let httpTransport: StreamableHTTPServerTransport | null = null;

/**
 * Sends successful HTTP response
 */
function sendSuccessResponse(res: any, data: any): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Sends error HTTP response
 */
function sendErrorResponse(res: any, error: unknown): void {
  console.error('HTTP MCP Error:', error);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : String(error),
      },
    })
  );
}

/**
 * Handles incoming HTTP request using StreamableHTTPServerTransport
 */
async function handleHttpRequest(req: any, res: any): Promise<void> {
  setupCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptionsRequest(res);
    return;
  }

  // Only accept POST for MCP requests
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  try {
    const body = await readRequestBody(req);
    const parsedBody = JSON.parse(body, (key, value) => {
      // Prototype pollution protection
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        throw new Error(`Dangerous key "${key}" blocked`);
      }
      return value;
    });

    // Create new transport for initialize requests or if none exists
    if (!httpTransport || isInitializeRequest(parsedBody)) {
      httpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true, // Return JSON directly instead of SSE
      });

      // Connect server to transport
      await server.connect(httpTransport);
    }

    // Handle the request through the transport
    await httpTransport.handleRequest(req, res, parsedBody);
  } catch (error) {
    sendErrorResponse(res, error);
  }
}

/**
 * Starts HTTP server for MCP transport
 */
async function startHttpServer(port: number): Promise<void> {
  const { createServer } = await import('http');

  const httpServer = createServer(async (req, res) => {
    await handleHttpRequest(req, res);
  });

  return new Promise<void>((resolve, reject) => {
    httpServer
      .listen(port, () => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`ExaFlow MCP server running on HTTP port ${port}`);
        }
        resolve();
      })
      .on('error', reject);
  });
}

// Server startup

/**
 * Parses command line arguments for HTTP mode
 */
function parseServerArgs(): { httpMode: boolean; port: number } {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const httpMode = portIndex !== -1;
  const port = httpMode ? parseInt(args[portIndex + 1]) || 3000 : 3000;

  return { httpMode, port };
}

/**
 * Starts stdio transport server
 */
async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Only log startup message in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.error('ExaFlow MCP server running on stdio');
  }
}

/**
 * Main server entry point
 */
async function main(): Promise<void> {
  const { httpMode, port } = parseServerArgs();

  if (httpMode) {
    await startHttpServer(port);
  } else {
    await startStdioServer();
  }
}

main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});
