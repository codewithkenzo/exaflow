import { z } from 'zod';
import {
  EnhancedTask,
  ResultEnvelope,
  ContextTaskSchema,
  SearchTaskSchema,
  ContentsTaskSchema,
  WebsetTaskSchema,
  ResearchTaskSchema,
} from './schema';
import { executeWithOrdering } from './util/concurrency';
import { createEventStreamer, streamResult } from './util/streaming';
import { loadEnv } from './env';
import { exaContextClient } from './clients/exa-context';
import { exaSearchClient } from './clients/exa-search';
import { exaContentsClient } from './clients/exa-contents';
import { exaWebsetsClient } from './clients/exa-websets';
import { exaResearchClient } from './clients/exa-research';

// Lazy load environment - called by functions that need it
function ensureEnv(): void {
  loadEnv();
}

export async function runTask(task: EnhancedTask): Promise<ResultEnvelope> {
  ensureEnv();
  const streamer = createEventStreamer(task.id || `task-${Date.now()}`);

  streamer.started(task.type, {
    timeout: task.timeout,
    retries: task.retries,
  });

  try {
    switch (task.type) {
      case 'context': {
        const contextTask = task as z.infer<typeof ContextTaskSchema> & {
          timeout: number;
          retries: number;
        };
        return await exaContextClient.executeTask(contextTask);
      }
      case 'search': {
        const searchTask = task as z.infer<typeof SearchTaskSchema> & {
          timeout: number;
          retries: number;
        };
        return await exaSearchClient.executeTask(searchTask);
      }
      case 'contents': {
        const contentsTask = task as z.infer<typeof ContentsTaskSchema> & {
          timeout: number;
          retries: number;
        };
        return await exaContentsClient.executeTask(contentsTask);
      }
      case 'websets': {
        const websetTask = task as z.infer<typeof WebsetTaskSchema> & {
          timeout: number;
          retries: number;
        };
        return await exaWebsetsClient.executeTask(websetTask);
      }
      case 'research': {
        const researchTask = task as z.infer<typeof ResearchTaskSchema> & {
          timeout: number;
          retries: number;
        };
        return await exaResearchClient.executeTask(researchTask);
      }
      default:
        throw new Error(`Unknown task type: ${(task as EnhancedTask).type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    streamer.failed(errorMessage);

    return {
      status: 'error',
      taskId: task.id || `task-${Date.now()}`,
      timing: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
      },
      citations: [],
      data: null,
      error: {
        code: 'TASK_EXECUTION_ERROR',
        message: errorMessage,
      },
    };
  }
}

export async function runBatch(
  tasks: EnhancedTask[],
  concurrency: number = 5,
  preserveOrder: boolean = true
): Promise<ResultEnvelope[]> {
  ensureEnv();
  const streamer = createEventStreamer(`batch-${Date.now()}`);
  const startTime = Date.now();

  streamer.batchStarted(tasks.length, concurrency);

  try {
    const concurrencyResults = await executeWithOrdering(
      tasks,
      async (task: EnhancedTask) => {
        streamer.info(`Starting task: ${task.type}`, { taskId: task.id });
        const result = await runTask(task);

        if (result.status === 'success') {
          streamer.info(`Completed task: ${task.type}`, {
            taskId: task.id,
            citationsCount: result.citations.length,
          });
        } else {
          streamer.warn(`Failed task: ${task.type}`, {
            taskId: task.id,
            error: result.error?.message,
          });
        }

        return result;
      },
      concurrency
    );

    // Extract the ResultEnvelope objects from ConcurrencyResult
    const results = concurrencyResults.map(cr => cr.result);
    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    streamer.batchCompleted(tasks.length, duration, {
      successCount,
      errorCount,
    });

    return results;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    streamer.failed(`Batch execution failed: ${errorMessage}`, { duration });

    // Return error results for all tasks
    return tasks.map(task => ({
      status: 'error' as const,
      taskId: task.id || `task-${Date.now()}`,
      timing: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        duration,
      },
      citations: [],
      data: null,
      error: {
        code: 'BATCH_EXECUTION_ERROR',
        message: errorMessage,
      },
    }));
  }
}

// Utility functions for specific task types
export async function runContextTask(
  query: string,
  options: {
    tokens?: number;
    timeout?: number;
    retries?: number;
    taskId?: string;
  } = {}
): Promise<ResultEnvelope> {
  const task: EnhancedTask = {
    type: 'context',
    query,
    tokensNum: options.tokens || 5000,
    timeout: options.timeout || 30000,
    retries: options.retries || 3,
    id: options.taskId,
  };

  return runTask(task);
}

export async function runSearchTask(
  query: string,
  options: {
    searchType?: 'auto' | 'keyword' | 'neural' | 'fast';
    numResults?: number;
    includeContents?: boolean;
    startDate?: string;
    endDate?: string;
    timeout?: number;
    retries?: number;
    taskId?: string;
  } = {}
): Promise<ResultEnvelope> {
  const task: EnhancedTask = {
    type: 'search',
    query,
    searchType: options.searchType || 'auto',
    numResults: options.numResults || 10,
    includeContents: options.includeContents || false,
    startDate: options.startDate,
    endDate: options.endDate,
    timeout: options.timeout || 30000,
    retries: options.retries || 3,
    id: options.taskId,
  };

  return runTask(task);
}

export async function runContentsTask(
  urls: string[],
  options: {
    livecrawl?: 'always' | 'fallback' | 'never';
    subpages?: number;
    subpageTarget?: string[];
    timeout?: number;
    retries?: number;
    taskId?: string;
  } = {}
): Promise<ResultEnvelope> {
  const task: EnhancedTask = {
    type: 'contents',
    ids: urls,
    livecrawl: options.livecrawl || 'fallback',
    subpages: options.subpages || 0,
    subpageTarget: options.subpageTarget || [],
    timeout: options.timeout || 60000, // Contents may take longer
    retries: options.retries || 3,
    id: options.taskId,
  };

  return runTask(task);
}

export async function runWebsetTask(
  operation: 'create' | 'search' | 'poll' | 'enrich',
  options: {
    websetId?: string;
    searchQuery?: string;
    enrichmentType?: string;
    useWebhook?: boolean;
    timeout?: number;
    retries?: number;
    taskId?: string;
  } = {}
): Promise<ResultEnvelope> {
  const task: EnhancedTask = {
    type: 'websets',
    operation,
    websetId: options.websetId,
    searchQuery: options.searchQuery,
    enrichmentType: options.enrichmentType,
    useWebhook: options.useWebhook || false,
    timeout: options.timeout || 300000, // Websets operations can be long
    retries: options.retries || 3,
    id: options.taskId,
  };

  return runTask(task);
}

export async function runResearchTask(
  operation: 'create' | 'get' | 'list',
  options: {
    instructions?: string;
    model?: 'exa-research' | 'exa-research-pro';
    outputSchema?: Record<string, any>;
    taskId?: string;
    poll?: boolean;
    timeout?: number;
    retries?: number;
  } = {}
): Promise<ResultEnvelope> {
  const task: EnhancedTask = {
    type: 'research',
    operation,
    instructions: options.instructions,
    model: options.model || 'exa-research',
    outputSchema: options.outputSchema,
    taskId: options.taskId,
    timeout: options.timeout || 600000, // Research can be very long
    retries: options.retries || 3,
    id: options.taskId,
  };

  return runTask(task);
}

// Export clients for direct usage
export {
  exaContextClient,
  exaSearchClient,
  exaContentsClient,
  exaWebsetsClient,
  exaResearchClient,
};

// Export utilities
export { createEventStreamer, streamResult, loadEnv };

// Export types
export type { EnhancedTask, ResultEnvelope, EventEnvelope } from './schema';
