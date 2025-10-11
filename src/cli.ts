#!/usr/bin/env node

import React from "react";
import { Command } from "commander";

import { loadEnv } from "./env";
import { 
  runBatch, 
  runContextTask, 
  runSearchTask, 
  runContentsTask, 
  runWebsetTask, 
  runResearchTask 
} from "./index";
import { 
  EnhancedTaskSchema
} from "./schema";
import { 
  readInputFile, 
  readStdin,
  fs 
} from "./util/fs";
import { streamResult, streamResultCompact, createEventStreamer } from "./util/streaming";

// Load environment with error handling
try {
  loadEnv();
} catch (error) {
  console.error("Failed to load environment:", error instanceof Error ? error.message : String(error));
  console.error("Please ensure EXA_API_KEY is set in your environment or .env file");
  process.exit(1);
}

const program = new Command();

program
  .name("exaflow")
  .description("ExaFlow: Interactive Semantic Search Tool with TUI and MCP Server Integration")
  .version("2.0.0");

// Global options
program
  .option("-c, --concurrency <number>", "Concurrency for batch operations", "5")
  .option("-t, --timeout <number>", "Request timeout in milliseconds", "30000")
  .option("--compact", "Output compact JSON instead of formatted", false)
  .option("--silent", "Suppress event streaming to stderr", false);

// TUI command
program
  .command("tui")
  .description("Launch interactive terminal user interface")
  .action(async () => {
    try {
      // Import and run the TUI
      const { render } = await import('ink');
      const { App } = await import('./tui/components/App.tsx');
      
      const { waitUntilExit } = render(React.createElement(App));
      
      waitUntilExit().then(() => {
        process.exit(0);
      }).catch((error) => {
        console.error('TUI error:', error);
        process.exit(1);
      });
      
    } catch (error) {
      console.error('Failed to start TUI:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// MCP Server command
program
  .command("mcp-server")
  .description("Start Model Context Protocol server for AI client integration")
  .option("--port <number>", "Port for HTTP transport (default: stdio)", "3000")
  .option("--transport <type>", "Transport type: stdio or http", "stdio")
  .action(async (options) => {
    try {
      if (options.transport === 'http') {
        // Start HTTP transport server
        console.log(`Starting ExaFlow MCP server on port ${options.port}`);
        // Implementation would go here for HTTP transport
        console.log('HTTP transport not yet implemented. Use stdio transport.');
        process.exit(1);
      } else {
        // Start stdio transport server (default)
        console.error('Starting ExaFlow MCP server with stdio transport...');
        
        // Execute the MCP server
        const { spawn } = await import('child_process');
        const mcpServer = spawn('bun', ['run', 'dist/mcp-server.js'], {
          stdio: 'inherit',
        });
        
        mcpServer.on('error', (error) => {
          console.error('MCP server error:', error);
          process.exit(1);
        });
        
        mcpServer.on('exit', (code) => {
          process.exit(code || 0);
        });
      }
    } catch (error) {
      console.error('Failed to start MCP server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Context command
program
  .command("context")
  .description("Query Exa Context API for code-oriented responses")
  .argument("<query>", "Query string")
  .option("--tokens <number>", "Number of tokens for response", "5000")
  .option("--timeout <number>", "Request timeout in milliseconds")
  .action(async (query: string, options: any, command: any) => {
    const globalOptions = command.parent?.opts() || {};
    const streamOutput = !globalOptions.silent;
    const streamer = streamOutput ? createEventStreamer(`cli-context-${Date.now()}`) : null;

    try {
      const result = await runContextTask(query, {
        tokens: parseInt(options.tokens),
        timeout: parseInt(options.timeout || globalOptions.timeout),
        taskId: `cli-context-${Date.now()}`,
      });

      if (globalOptions.compact) {
        streamResultCompact(result);
      } else {
        streamResult(result);
      }

      process.exit(result.status === "error" ? 1 : 0);

    } catch (error) {
      streamer?.failed(`CLI error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Search command
program
  .command("search")
  .description("Search using Exa Search API")
  .argument("[query]", "Search query string")
  .option("-i, --input <file>", "Input file with queries")
  .option("--stdin", "Read queries from stdin")
  .option("--type <type>", "Search type: auto, keyword, neural, fast", "auto")
  .option("--num-results <number>", "Number of results", "10")
  .option("--include-contents", "Include full content in results", false)
  .option("--start-date <date>", "Start date filter (ISO 8601)")
  .option("--end-date <date>", "End date filter (ISO 8601)")
  .action(async (query: string | undefined, options: any, command: any) => {
    const globalOptions = command.parent?.opts() || {};
    const streamOutput = !globalOptions.silent;
    const streamer = streamOutput ? createEventStreamer(`cli-search-${Date.now()}`) : null;

    try {
      const concurrency = parseInt(globalOptions.concurrency);
      const timeout = parseInt(globalOptions.timeout);

      if (options.stdin) {
        // Handle stdin input
        const stdinData = await readStdin();
        const queries = stdinData.trim().split('\n').filter(line => line.trim());
        
        const tasks = queries.map((q, index) => EnhancedTaskSchema.parse({
          type: "search",
          query: q,
          searchType: options.type,
          numResults: parseInt(options.numResults),
          includeContents: options.includeContents,
          startDate: options.startDate,
          endDate: options.endDate,
          timeout,
          retries: 3,
          id: `cli-search-${Date.now()}-${index}`,
        }));

        const results = await runBatch(tasks, concurrency);
        results.forEach(result => {
          if (globalOptions.compact) {
            streamResultCompact(result);
          } else {
            streamResult(result);
          }
        });

        const errorCount = results.filter(r => r.status === "error").length;
        process.exit(errorCount > 0 ? 1 : 0);

      } else if (options.input) {
        // Handle file input
        const inputData = await readInputFile(options.input);
        
        let tasks: any[] = [];
        
        if (Array.isArray(inputData)) {
          // Array of queries or tasks
          if (inputData.length > 0 && typeof inputData[0] === "string") {
            // Array of query strings
            tasks = inputData.map((q, index) => EnhancedTaskSchema.parse({
              type: "search",
              query: q,
              searchType: options.type,
              numResults: parseInt(options.numResults),
              includeContents: options.includeContents,
              startDate: options.startDate,
              endDate: options.endDate,
              timeout,
              retries: 3,
              id: `cli-search-${Date.now()}-${index}`,
            }));
          } else {
            // Array of task objects
            tasks = inputData.map((task, index) => EnhancedTaskSchema.parse({
              ...task,
              type: "search",
              timeout: task.timeout || timeout,
              retries: task.retries || 3,
              id: task.id || `cli-search-${Date.now()}-${index}`,
            }));
          }
        } else if (inputData && typeof inputData === 'object' && 'tasks' in inputData && Array.isArray(inputData.tasks)) {
          // Object with tasks array
          const dataWithTasks = inputData as { tasks: any[] };
          tasks = dataWithTasks.tasks.map((task: any, index: number) => EnhancedTaskSchema.parse({
            ...task,
            type: "search",
            timeout: task.timeout || timeout,
            retries: task.retries || 3,
            id: task.id || `cli-search-${Date.now()}-${index}`,
          }));
        } else {
          throw new Error("Invalid input file format");
        }

        const results = await runBatch(tasks, concurrency);
        results.forEach(result => {
          if (globalOptions.compact) {
            streamResultCompact(result);
          } else {
            streamResult(result);
          }
        });

        const errorCount = results.filter(r => r.status === "error").length;
        process.exit(errorCount > 0 ? 1 : 0);

      } else if (query) {
        // Single query
        const result = await runSearchTask(query, {
          searchType: options.type,
          numResults: parseInt(options.numResults),
          includeContents: options.includeContents,
          startDate: options.startDate,
          endDate: options.endDate,
          timeout,
          taskId: `cli-search-${Date.now()}`,
        });

        if (globalOptions.compact) {
          streamResultCompact(result);
        } else {
          streamResult(result);
        }

        process.exit(result.status === "error" ? 1 : 0);

      } else {
        throw new Error("Either provide a query argument or use --input or --stdin");
      }

    } catch (error) {
      streamer?.failed(`CLI error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Contents command
program
  .command("contents")
  .description("Extract content from URLs using Exa Contents API")
  .option("-i, --ids <file>", "File containing URLs (one per line)")
  .option("--stdin", "Read URLs from stdin")
  .option("--livecrawl <mode>", "Live crawl mode: always, fallback, never", "fallback")
  .option("--subpages <number>", "Number of subpages to crawl", "0")
  .option("--subpage-target <items>", "Target subpage sections (comma-separated)")
  .action(async (options: any, command: any) => {
    const globalOptions = command.parent?.opts() || {};
    const streamOutput = !globalOptions.silent;
    const streamer = streamOutput ? createEventStreamer(`cli-contents-${Date.now()}`) : null;

    try {
      const timeout = parseInt(globalOptions.timeout);
      const subpageTarget = options.subpageTarget 
        ? options.subpageTarget.split(',').map((s: string) => s.trim())
        : [];

      let urls: string[] = [];

      if (options.stdin) {
        const stdinData = await readStdin();
        urls = stdinData.trim().split('\n')
          .map(line => line.trim())
          .filter(line => line && line.startsWith('http'));
      } else if (options.ids) {
        const fileContent = await fs.readFile(options.ids);
        urls = fileContent.trim().split('\n')
          .map(line => line.trim())
          .filter(line => line && line.startsWith('http'));
      } else {
        throw new Error("Either provide --ids file or use --stdin");
      }

      if (urls.length === 0) {
        throw new Error("No URLs found");
      }

      const result = await runContentsTask(urls, {
        livecrawl: options.livecrawl,
        subpages: parseInt(options.subpages),
        subpageTarget,
        timeout,
        taskId: `cli-contents-${Date.now()}`,
      });

      if (globalOptions.compact) {
        streamResultCompact(result);
      } else {
        streamResult(result);
      }

      process.exit(result.status === "error" ? 1 : 0);

    } catch (error) {
      streamer?.failed(`CLI error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Websets command
program
  .command("websets")
  .description("Manage Exa Websets (async search and enrichment)")
  .argument("<operation>", "Operation: create, search, poll, enrich")
  .option("--webset-id <id>", "Webset ID for search/poll/enrich operations")
  .option("--search-query <query>", "Search query for search operation")
  .option("--enrichment-type <type>", "Enrichment type for enrich operation")
  .option("--webhook", "Use webhook mode for async operations", false)
  .option("--poll", "Poll for completion (works with create and search)", false)
  .action(async (operation: string, options: any, command: any) => {
    const globalOptions = command.parent?.opts() || {};
    const streamOutput = !globalOptions.silent;
    const streamer = streamOutput ? createEventStreamer(`cli-websets-${Date.now()}`) : null;

    try {
      const timeout = parseInt(globalOptions.timeout);

      if (!["create", "search", "poll", "enrich"].includes(operation)) {
        throw new Error("Invalid operation. Use: create, search, poll, enrich");
      }

      const result = await runWebsetTask(operation as any, {
        websetId: options.websetId,
        searchQuery: options.searchQuery,
        enrichmentType: options.enrichmentType,
        useWebhook: options.webhook,
        timeout,
        taskId: `cli-websets-${Date.now()}`,
      });

      if (globalOptions.compact) {
        streamResultCompact(result);
      } else {
        streamResult(result);
      }

      process.exit(result.status === "error" ? 1 : 0);

    } catch (error) {
      streamer?.failed(`CLI error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Research command
program
  .command("research")
  .description("Run research tasks with Exa Research API")
  .argument("[operation]", "Operation: create, get, list (default: create)")
  .option("--instructions <text>", "Research instructions (for create operation)")
  .option("--instructions-file <file>", "File containing research instructions")
  .option("--model <model>", "Model: exa-research, exa-research-pro", "exa-research")
  .option("--schema <file>", "JSON schema file for structured output")
  .option("--task-id <id>", "Task ID for get operation")
  .option("--poll", "Poll for completion (works with create)", false)
  .action(async (operation: string = "create", options: any, command: any) => {
    const globalOptions = command.parent?.opts() || {};
    const streamOutput = !globalOptions.silent;
    const streamer = streamOutput ? createEventStreamer(`cli-research-${Date.now()}`) : null;

    try {
      const timeout = parseInt(globalOptions.timeout);

      if (!["create", "get", "list"].includes(operation)) {
        throw new Error("Invalid operation. Use: create, get, list");
      }

      let instructions: string | undefined;
      let outputSchema: Record<string, any> | undefined;

      if (operation === "create") {
        if (options.instructionsFile) {
          instructions = await fs.readFile(options.instructionsFile);
        } else if (options.instructions) {
          instructions = options.instructions;
        } else {
          throw new Error("Either --instructions or --instructions-file is required for create operation");
        }

        if (options.schema) {
          const schemaContent = await fs.readFile(options.schema);
          outputSchema = JSON.parse(schemaContent);
        }
      }

      const researchParams: any = {
        model: options.model,
        taskId: options.taskId,
        poll: options.poll,
        timeout,
      };
      
      if (instructions !== undefined) {
        researchParams.instructions = instructions;
      }
      
      if (outputSchema !== undefined) {
        researchParams.outputSchema = outputSchema;
      }

      const result = await runResearchTask(operation as any, researchParams);

      if (globalOptions.compact) {
        streamResultCompact(result);
      } else {
        streamResult(result);
      }

      process.exit(result.status === "error" ? 1 : 0);

    } catch (error) {
      streamer?.failed(`CLI error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Parse and run
program.parse();
