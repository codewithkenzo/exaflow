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
import { EnhancedTaskSchema } from './schema';
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
function processResult(result: any, globalOptions: GlobalOptions): number {
  if (globalOptions.compact) {
    streamResultCompact(result);
  } else {
    streamResult(result);
  }
  return result.status === 'error' ? 1 : 0;
}

/**
 * Processes and outputs multiple results from batch operations
 */
function processBatchResults(results: any[], globalOptions: GlobalOptions): number {
  results.forEach(result => {
    if (globalOptions.compact) {
      streamResultCompact(result);
    } else {
      streamResult(result);
    }
  });

  const errorCount = results.filter(r => r.status === 'error').length;
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
): any {
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
  });
}

/**
 * Processes queries from stdin for batch operations
 */
async function processStdinQueries(
  options: SearchResultOptions,
  timeout: number,
  baseTaskId: string
): Promise<any[]> {
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
): Promise<any[]> {
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
          })
        );
  } else if (
    inputData &&
    typeof inputData === 'object' &&
    'tasks' in inputData &&
    Array.isArray((inputData as any).tasks)
  ) {
    // Object with tasks array
    const dataWithTasks = inputData as { tasks: any[] };
    return dataWithTasks.tasks.map((task: any, index: number) =>
      EnhancedTaskSchema.parse({
        ...task,
        type: 'search',
        timeout: task.timeout || timeout,
        retries: task.retries || 3,
        id: task.id || `${baseTaskId}-${index}`,
      })
    );
  } else {
    throw new Error('Invalid input file format');
  }
}

/**
 * Safely parses JSON schema file with security validation
 */
async function parseSchemaFile(schemaFile: string): Promise<Record<string, any>> {
  const schemaContent = await fs.readFile(schemaFile);

  // Validate JSON format before parsing
  if (typeof schemaContent !== 'string' || schemaContent.trim().startsWith('__proto__')) {
    throw new Error('Invalid schema file format');
  }

  try {
    const parsed = JSON.parse(schemaContent);

    // Validate it's a valid JSON schema object
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Schema must be a valid JSON object');
    }

    // Check for dangerous prototype pollution patterns
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    const checkForDangerousKeys = (obj: any, path = '') => {
      for (const key in obj) {
        if (dangerousKeys.includes(key)) {
          throw new Error(`Dangerous key "${key}" found in schema at ${path}`);
        }
        if (obj[key] && typeof obj[key] === 'object') {
          checkForDangerousKeys(obj[key], `${path}.${key}`);
        }
      }
    };
    checkForDangerousKeys(parsed);

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
  .action(async (query: string, options: any, command: any) => {
    const { globalOptions, streamer, timeout: globalTimeout } = createCommandContext(command);

    try {
      const result = await runContextTask(query, {
        tokens: parseInt(options.tokens),
        timeout: parseInt(options.timeout || globalTimeout.toString()),
        taskId: `cli-context-${Date.now()}`,
      });

      process.exit(processResult(result, globalOptions));
    } catch (error) {
      handleCliError(error, streamer);
    }
  });

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
  .action(async (query: string | undefined, options: any, command: any) => {
    const { globalOptions, streamer, concurrency, timeout } = createCommandContext(command);

    try {
      const searchOptions: SearchResultOptions = {
        type: options.type,
        numResults: options.numResults,
        includeContents: options.includeContents,
        startDate: options.startDate,
        endDate: options.endDate,
      };

      const baseTaskId = `cli-search-${Date.now()}`;

      if (options.stdin) {
        // Handle stdin input
        const tasks = await processStdinQueries(searchOptions, timeout, baseTaskId);
        const results = await runBatch(tasks, concurrency);
        process.exit(processBatchResults(results, globalOptions));
      } else if (options.input) {
        // Handle file input
        const tasks = await processInputFileQueries(
          options.input,
          searchOptions,
          timeout,
          baseTaskId
        );
        const results = await runBatch(tasks, concurrency);
        process.exit(processBatchResults(results, globalOptions));
      } else if (query) {
        // Single query
        const result = await runSearchTask(query, {
          searchType: searchOptions.type,
          numResults: parseInt(searchOptions.numResults),
          includeContents: searchOptions.includeContents,
          startDate: searchOptions.startDate,
          endDate: searchOptions.endDate,
          timeout,
          taskId: baseTaskId,
        });
        process.exit(processResult(result, globalOptions));
      } else {
        throw new Error('Either provide a query argument or use --input or --stdin');
      }
    } catch (error) {
      handleCliError(error, streamer);
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
  .action(async (options: any, command: any) => {
    const { globalOptions, streamer, timeout } = createCommandContext(command);

    try {
      const subpageTarget = options.subpageTarget
        ? options.subpageTarget.split(',').map((s: string) => s.trim())
        : [];

      const urls = await extractUrls({ stdin: options.stdin, ids: options.ids });

      const result = await runContentsTask(urls, {
        livecrawl: options.livecrawl,
        subpages: parseInt(options.subpages),
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
  .action(async (operation: string, options: any, command: any) => {
    const { globalOptions, streamer, timeout } = createCommandContext(command);

    try {
      if (!['create', 'search', 'poll', 'enrich'].includes(operation)) {
        throw new Error('Invalid operation. Use: create, search, poll, enrich');
      }

      const websetOptions: WebsetOptions = {
        websetId: options.websetId,
        searchQuery: options.searchQuery,
        enrichmentType: options.enrichmentType,
        webhook: options.webhook,
        poll: options.poll,
      };

      const result = await runWebsetTask(operation as any, {
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
  .action(async (operation: string = 'create', options: any, command: any) => {
    const { globalOptions, streamer, timeout } = createCommandContext(command);

    try {
      if (!['create', 'get', 'list'].includes(operation)) {
        throw new Error('Invalid operation. Use: create, get, list');
      }

      const researchOptions: ResearchOptions = {
        instructions: options.instructions,
        instructionsFile: options.instructionsFile,
        model: options.model,
        schema: options.schema,
        taskId: options.taskId,
        poll: options.poll,
      };

      let instructions: string | undefined;
      let outputSchema: Record<string, any> | undefined;

      if (operation === 'create') {
        instructions = await loadResearchInstructions(researchOptions);

        if (researchOptions.schema) {
          outputSchema = await parseSchemaFile(researchOptions.schema);
        }
      }

      const researchParams: any = {
        model: researchOptions.model,
        taskId: researchOptions.taskId,
        poll: researchOptions.poll,
        timeout,
      };

      if (instructions !== undefined) {
        researchParams.instructions = instructions;
      }

      if (outputSchema !== undefined) {
        researchParams.outputSchema = outputSchema;
      }

      const result = await runResearchTask(operation as any, researchParams);
      process.exit(processResult(result, globalOptions));
    } catch (error) {
      handleCliError(error, streamer);
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
