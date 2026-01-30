#!/usr/bin/env node

import { Command } from 'commander';

import { loadEnv } from './env';
import {
  runBatch,
  runContextTask,
  runSearchTask,
  runContentsTask,
  runWebsetTask,
  runResearchTask,
} from './index';
import { EnhancedTaskSchema, type EnhancedTask } from './schema';
import { readInputFile, readStdin, fs } from './util/fs';
import { streamResult, streamResultCompact, createEventStreamer } from './util/streaming';

// Type definitions for better type safety
interface GlobalOptions {
  concurrency: string;
  timeout: string;
  compact: boolean;
  silent: boolean;
}

interface CommandContext {
  globalOptions: GlobalOptions;
  streamer: ReturnType<typeof createEventStreamer> | null;
  concurrency: number;
  timeout: number;
}

interface SearchResultOptions {
  type: 'auto' | 'keyword' | 'neural' | 'fast';
  numResults: string;
  includeContents: boolean;
  startDate?: string;
  endDate?: string;
}

interface ContentsOptions {
  livecrawl: string;
  subpages: string;
  subpageTarget?: string;
}

interface WebsetOptions {
  websetId?: string;
  searchQuery?: string;
  enrichmentType?: string;
  webhook: boolean;
  poll: boolean;
}

interface ResearchOptions {
  instructions?: string;
  instructionsFile?: string;
  model: string;
  schema?: string;
  taskId?: string;
  poll: boolean;
}

// Interface for commander command options
interface CommandOptions {
  tokens?: string;
  timeout?: string;
  type?: string;
  numResults?: string;
  includeContents?: boolean;
  startDate?: string;
  endDate?: string;
  stdin?: boolean;
  input?: string;
  ids?: string;
  livecrawl?: string;
  subpages?: string;
  subpageTarget?: string;
  websetId?: string;
  searchQuery?: string;
  enrichmentType?: string;
  webhook?: boolean;
  poll?: boolean;
  instructions?: string;
  instructionsFile?: string;
  schema?: string;
  model?: string;
  taskId?: string;
}

// Utility Functions

/**
 * Extracts global options and sets up streaming context
 */
function createCommandContext(command: any): CommandContext {
  const globalOptions = (command.parent?.opts() as GlobalOptions) || {
    concurrency: '5',
    timeout: '30000',
    compact: false,
    silent: false,
  };

  const streamOutput = !globalOptions.silent;
  const streamer = streamOutput ? createEventStreamer(`cli-${Date.now()}`) : null;

  return {
    globalOptions,
    streamer,
    concurrency: parseInt(globalOptions.concurrency),
    timeout: parseInt(globalOptions.timeout),
  };
}

/**
 * Handles CLI errors with proper streamer notification and exit codes
 */
function handleCliError(
  error: unknown,
  streamer: ReturnType<typeof createEventStreamer> | null
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  streamer?.failed(`CLI error: ${errorMessage}`);
  console.error('Error:', errorMessage);
  process.exit(1);
}

/**
 * Processes and outputs a single result
 */
function processResult(result: unknown, globalOptions: GlobalOptions): number {
  if (globalOptions.compact) {
    streamResultCompact(result);
  } else {
    streamResult(result);
  }
  return result && typeof result === 'object' && 'status' in result && result.status === 'error' ? 1 : 0;
}

/**
 * Processes and outputs multiple results from batch operations
 */
function processBatchResults(results: unknown[], globalOptions: GlobalOptions): number {
  const typedResults = results as Array<{ status: string }>;
  typedResults.forEach(result => {
    if (globalOptions.compact) {
      streamResultCompact(result);
    } else {
      streamResult(result);
    }
  });

  const errorCount = typedResults.filter(r => r.status === 'error').length;
  return errorCount > 0 ? 1 : 0;
}

/**
 * Creates a search task from query and options
 */
function createSearchTask(
  query: string,
  options: SearchResultOptions,
  timeout: number,
  taskId: string
): EnhancedTask {
  return EnhancedTaskSchema.parse({
    type: 'search',
    query,
    searchType: options.type,
    numResults: parseInt(options.numResults),
    includeContents: options.includeContents,
    startDate: options.startDate,
    endDate: options.endDate,
    timeout,
    retries: 3,
    id: taskId,
  }) as EnhancedTask;
}

/**
 * Processes queries from stdin for batch operations
 */
async function processStdinQueries(
  options: SearchResultOptions,
  timeout: number,
  baseTaskId: string
): Promise<EnhancedTask[]> {
  const stdinData = await readStdin();
  const queries = stdinData
    .trim()
    .split('\n')
    .filter(line => line.trim());

  return queries.map((q, index) => createSearchTask(q, options, timeout, `${baseTaskId}-${index}`));
}

/**
 * Processes queries from input file for batch operations
 */
async function processInputFileQueries(
  inputFile: string,
  options: SearchResultOptions,
  timeout: number,
  baseTaskId: string
): Promise<EnhancedTask[]> {
  const inputData = await readInputFile(inputFile);

  if (Array.isArray(inputData)) {
    return inputData.length > 0 && typeof inputData[0] === 'string'
      ? // Array of query strings
        inputData.map((q, index) => createSearchTask(q, options, timeout, `${baseTaskId}-${index}`))
      : // Array of task objects
        inputData.map((task, index) =>
          EnhancedTaskSchema.parse({
            ...task,
            type: 'search',
            timeout: task.timeout || timeout,
            retries: task.retries || 3,
            id: task.id || `${baseTaskId}-${index}`,
          }) as EnhancedTask
        );
  } else if (
    inputData &&
    typeof inputData === 'object' &&
    'tasks' in inputData &&
    Array.isArray((inputData as { tasks: unknown }).tasks)
  ) {
    // Object with tasks array
    const dataWithTasks = inputData as { tasks: Array<{ timeout?: number; retries?: number; id?: string } & Record<string, unknown>> };
    return dataWithTasks.tasks.map((task, index) =>
      EnhancedTaskSchema.parse({
        ...task,
        type: 'search',
        timeout: task.timeout || timeout,
        retries: task.retries || 3,
        id: task.id || `${baseTaskId}-${index}`,
      }) as EnhancedTask
    );
  } else {
    throw new Error('Invalid input file format');
  }
}

/**
 * Safely parses JSON schema file with security validation
 */
async function parseSchemaFile(schemaFile: string): Promise<Record<string, unknown>> {
  const schemaContent = await fs.readFile(schemaFile);

  // Validate JSON format before parsing
  if (typeof schemaContent !== 'string' || schemaContent.trim().startsWith('__proto__')) {
    throw new Error('Invalid schema file format');
  }

  try {
    // Use reviver function to block prototype pollution at parse time
    const parsed = JSON.parse(schemaContent, (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        throw new Error(`Dangerous key "${key}" blocked by JSON.parse reviver`);
      }
      return value;
    });

    // Validate it's a valid JSON schema object
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Schema must be a valid JSON object');
    }

    return parsed;
  } catch (parseError) {
    throw new Error(
      `Failed to parse schema file: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`
    );
  }
}

/**
 * Loads research instructions from either direct text or file
 */
async function loadResearchInstructions(options: ResearchOptions): Promise<string> {
  if (options.instructionsFile) {
    return await fs.readFile(options.instructionsFile);
  } else if (options.instructions) {
    return options.instructions;
  } else {
    throw new Error(
      'Either --instructions or --instructions-file is required for create operation'
    );
  }
}

/**
 * Extracts URLs from various input sources
 */
async function extractUrls(options: { stdin?: boolean; ids?: string }): Promise<string[]> {
  let urls: string[] = [];

  if (options.stdin) {
    const stdinData = await readStdin();
    urls = stdinData
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'));
  } else if (options.ids) {
    const fileContent = await fs.readFile(options.ids);
    urls = fileContent
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'));
  } else {
    throw new Error('Either provide --ids file or use --stdin');
  }

  if (urls.length === 0) {
    throw new Error('No URLs found');
  }

  return urls;
}

// Load environment with error handling
try {
  loadEnv();
} catch (error) {
  console.error(
    'Failed to load environment:',
    error instanceof Error ? error.message : String(error)
  );
  console.error('Please ensure EXA_API_KEY is set in your environment or .env file');
  process.exit(1);
}

const program = new Command();

program
  .name('exaflow')
  .description('ExaFlow: Advanced Semantic Search Tool with MCP Server Integration')
  .version('2.0.0');

// Global options
program
  .option('-c, --concurrency <number>', 'Concurrency for batch operations', '5')
  .option('-t, --timeout <number>', 'Request timeout in milliseconds', '30000')
  .option('--compact', 'Output compact JSON instead of formatted', false)
  .option('--silent', 'Suppress event streaming to stderr', false);

// MCP Server command
program
  .command('mcp-server')
  .description('Start Model Context Protocol server for AI client integration')
  .option('--port <number>', 'Port for HTTP transport (default: stdio)', '3000')
  .option('--transport <type>', 'Transport type: stdio or http', 'stdio')
  .action(async options => {
    try {
      if (options.transport === 'http') {
        // Start HTTP transport server
        // HTTP transport implementation would go here
        process.exit(1);
      } else {
        // Start stdio transport server (default)
        console.error('Starting ExaFlow MCP server with stdio transport...');

        // Execute the MCP server with hardcoded command to prevent injection
        const { spawn } = await import('child_process');

        // Validate that we're using the expected hardcoded command
        const command = 'bun';
        const args = ['run', 'dist/mcp-server.js'];

        // Additional security: sanitize and validate the command and args
        if (
          command !== 'bun' ||
          !Array.isArray(args) ||
          args.length !== 3 ||
          args[0] !== 'run' ||
          !args[1].endsWith('mcp-server.js')
        ) {
          throw new Error('Invalid command execution attempted');
        }

        const mcpServer = spawn(command, args, {
          stdio: 'inherit',
          // Add additional security options
          shell: false, // Explicitly disable shell to prevent injection
          env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
        });

        mcpServer.on('error', error => {
          console.error('MCP server error:', error);
          process.exit(1);
        });

        mcpServer.on('exit', code => {
          process.exit(code || 0);
        });
      }
    } catch (error) {
      console.error(
        'Failed to start MCP server:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

// Context command
program
  .command('context')
  .description('Query Exa Context API for code-oriented responses')
  .argument('<query>', 'Query string')
  .option('--tokens <number>', 'Number of tokens for response', '5000')
  .option('--timeout <number>', 'Request timeout in milliseconds')
  .action(async (query: string, options: CommandOptions, command: unknown) => {
    const { globalOptions, streamer, timeout: globalTimeout } = createCommandContext(command);

    try {
      const result = await runContextTask(query, {
        tokens: parseInt(options.tokens || '5000'),
        timeout: parseInt(options.timeout || globalTimeout.toString()),
        taskId: `cli-context-${Date.now()}`,
      });

      process.exit(processResult(result, globalOptions));
    } catch (error) {
      handleCliError(error, streamer);
    }
  });

// Search command handlers

/**
 * Handles batch search from stdin input
 */
async function handleStdinSearch(
  searchOptions: SearchResultOptions,
  timeout: number,
  baseTaskId: string,
  concurrency: number
): Promise<unknown[]> {
  const tasks = await processStdinQueries(searchOptions, timeout, baseTaskId);
  return runBatch(tasks, concurrency);
}

/**
 * Handles batch search from file input
 */
async function handleFileSearch(
  inputFile: string,
  searchOptions: SearchResultOptions,
  timeout: number,
  baseTaskId: string,
  concurrency: number
): Promise<unknown[]> {
  const tasks = await processInputFileQueries(inputFile, searchOptions, timeout, baseTaskId);
  return runBatch(tasks, concurrency);
}

/**
 * Handles single search query
 */
async function handleSingleSearch(
  query: string,
  searchOptions: SearchResultOptions,
  timeout: number,
  baseTaskId: string
): Promise<unknown> {
  return runSearchTask(query, {
    searchType: searchOptions.type,
    numResults: parseInt(searchOptions.numResults),
    includeContents: searchOptions.includeContents,
    startDate: searchOptions.startDate,
    endDate: searchOptions.endDate,
    timeout,
    taskId: baseTaskId,
  });
}

/**
 * Executes search based on input source
 */
async function executeSearch(
  query: string | undefined,
  options: CommandOptions,
  context: CommandContext
): Promise<number> {
  const { globalOptions, concurrency, timeout } = context;

  const searchOptions: SearchResultOptions = {
    type: options.type as 'auto' | 'keyword' | 'neural' | 'fast',
    numResults: options.numResults || '10',
    includeContents: options.includeContents || false,
    startDate: options.startDate,
    endDate: options.endDate,
  };

  const baseTaskId = `cli-search-${Date.now()}`;

  if (options.stdin) {
    const results = await handleStdinSearch(searchOptions, timeout, baseTaskId, concurrency);
    return processBatchResults(results, globalOptions);
  }

  if (options.input) {
    const results = await handleFileSearch(
      options.input,
      searchOptions,
      timeout,
      baseTaskId,
      concurrency
    );
    return processBatchResults(results, globalOptions);
  }

  if (query) {
    const result = await handleSingleSearch(query, searchOptions, timeout, baseTaskId);
    return processResult(result, globalOptions);
  }

  throw new Error('Either provide a query argument or use --input or --stdin');
}

// Search command
program
  .command('search')
  .description('Search using Exa Search API')
  .argument('[query]', 'Search query string')
  .option('-i, --input <file>', 'Input file with queries')
  .option('--stdin', 'Read queries from stdin')
  .option('--type <type>', 'Search type: auto, keyword, neural, fast', 'auto')
  .option('--num-results <number>', 'Number of results', '10')
  .option('--include-contents', 'Include full content in results', false)
  .option('--start-date <date>', 'Start date filter (ISO 8601)')
  .option('--end-date <date>', 'End date filter (ISO 8601)')
  .action(async (query: string | undefined, options: CommandOptions, command: unknown) => {
    const context = createCommandContext(command);

    try {
      const exitCode = await executeSearch(query, options, context);
      process.exit(exitCode);
    } catch (error) {
      handleCliError(error, context.streamer);
    }
  });

// Contents command
program
  .command('contents')
  .description('Extract content from URLs using Exa Contents API')
  .option('-i, --ids <file>', 'File containing URLs (one per line)')
  .option('--stdin', 'Read URLs from stdin')
  .option('--livecrawl <mode>', 'Live crawl mode: always, fallback, never', 'fallback')
  .option('--subpages <number>', 'Number of subpages to crawl', '0')
  .option('--subpage-target <items>', 'Target subpage sections (comma-separated)')
  .action(async (options: CommandOptions, command: unknown) => {
    const { globalOptions, streamer, timeout } = createCommandContext(command);

    try {
      const subpageTarget = options.subpageTarget
        ? options.subpageTarget.split(',').map((s: string) => s.trim())
        : [];

      const urls = await extractUrls({ stdin: options.stdin, ids: options.ids });

      const result = await runContentsTask(urls, {
        livecrawl: options.livecrawl as 'always' | 'fallback' | 'never',
        subpages: parseInt(options.subpages || '0'),
        subpageTarget,
        timeout,
        taskId: `cli-contents-${Date.now()}`,
      });

      process.exit(processResult(result, globalOptions));
    } catch (error) {
      handleCliError(error, streamer);
    }
  });

// Websets command
program
  .command('websets')
  .description('Manage Exa Websets (async search and enrichment)')
  .argument('<operation>', 'Operation: create, search, poll, enrich')
  .option('--webset-id <id>', 'Webset ID for search/poll/enrich operations')
  .option('--search-query <query>', 'Search query for search operation')
  .option('--enrichment-type <type>', 'Enrichment type for enrich operation')
  .option('--webhook', 'Use webhook mode for async operations', false)
  .option('--poll', 'Poll for completion (works with create and search)', false)
  .action(async (operation: string, options: CommandOptions, command: unknown) => {
    const { globalOptions, streamer, timeout } = createCommandContext(command);

    try {
      if (!['create', 'search', 'poll', 'enrich'].includes(operation)) {
        throw new Error('Invalid operation. Use: create, search, poll, enrich');
      }

      const websetOptions: WebsetOptions = {
        websetId: options.websetId,
        searchQuery: options.searchQuery,
        enrichmentType: options.enrichmentType,
        webhook: options.webhook || false,
        poll: options.poll || false,
      };

      const result = await runWebsetTask(operation as 'create' | 'search' | 'poll' | 'enrich', {
        websetId: websetOptions.websetId,
        searchQuery: websetOptions.searchQuery,
        enrichmentType: websetOptions.enrichmentType,
        useWebhook: websetOptions.webhook,
        timeout,
        taskId: `cli-websets-${Date.now()}`,
      });

      process.exit(processResult(result, globalOptions));
    } catch (error) {
      handleCliError(error, streamer);
    }
  });

// Research command handlers

/**
 * Validates research operation type
 */
function validateResearchOperation(operation: string): void {
  if (!['create', 'get', 'list'].includes(operation)) {
    throw new Error('Invalid operation. Use: create, get, list');
  }
}

/**
 * Builds research parameters based on operation and options
 */
async function buildResearchParams(
  operation: string,
  options: ResearchOptions,
  timeout: number
): Promise<Record<string, unknown>> {
  const params: Record<string, unknown> = {
    model: options.model,
    taskId: options.taskId,
    poll: options.poll,
    timeout,
  };

  if (operation === 'create') {
    params.instructions = await loadResearchInstructions(options);

    if (options.schema) {
      params.outputSchema = await parseSchemaFile(options.schema);
    }
  }

  return params;
}

/**
 * Executes research operation
 */
async function executeResearch(
  operation: string,
  options: CommandOptions,
  context: CommandContext
): Promise<number> {
  const { timeout } = context;

  validateResearchOperation(operation);

  const researchOptions: ResearchOptions = {
    instructions: options.instructions,
    instructionsFile: options.instructionsFile,
    model: options.model || 'exa-research',
    schema: options.schema,
    taskId: options.taskId,
    poll: options.poll || false,
  };

  const researchParams = await buildResearchParams(operation, researchOptions, timeout);
  const result = await runResearchTask(operation as 'create' | 'get' | 'list', researchParams);

  return processResult(result, context.globalOptions);
}

// Research command
program
  .command('research')
  .description('Run research tasks with Exa Research API')
  .argument('[operation]', 'Operation: create, get, list (default: create)')
  .option('--instructions <text>', 'Research instructions (for create operation)')
  .option('--instructions-file <file>', 'File containing research instructions')
  .option('--model <model>', 'Model: exa-research, exa-research-pro', 'exa-research')
  .option('--schema <file>', 'JSON schema file for structured output')
  .option('--task-id <id>', 'Task ID for get operation')
  .option('--poll', 'Poll for completion (works with create)', false)
  .action(async (operation: string = 'create', options: CommandOptions, command: unknown) => {
    const context = createCommandContext(command);

    try {
      const exitCode = await executeResearch(operation, options, context);
      process.exit(exitCode);
    } catch (error) {
      handleCliError(error, context.streamer);
    }
  });

// Error handling
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse and run
program.parse();
