import { z } from 'zod';
import { httpClient } from '../util/http';
import { createEventStreamer } from '../util/streaming';
import type { ResultEnvelope } from '../schema';
import { ResearchTaskSchema } from '../schema';
import { getEnv } from '../env';

// Research API schemas
const CreateResearchTaskRequestSchema = z.object({
  instructions: z.string().min(1),
  model: z.enum(['exa-research', 'exa-research-pro']).default('exa-research'),
  outputSchema: z.record(z.any()).optional(),
  webhookUrl: z.string().url().optional(),
});

const ResearchTaskResponseSchema = z.object({
  id: z.string(),
  instructions: z.string(),
  model: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  outputSchema: z.record(z.any()).optional(),
});

const ResearchTaskListResponseSchema = z.object({
  tasks: z.array(ResearchTaskSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const ResearchResultSchema = z.object({
  taskId: z.string(),
  status: z.enum(['completed', 'failed']),
  result: z.any().optional(),
  error: z.string().optional(),
  citations: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        snippet: z.string().optional(),
        publishedDate: z.string().datetime().optional(),
        author: z.string().optional(),
      })
    )
    .optional(),
  metadata: z
    .object({
      model: z.string(),
      tokensUsed: z.number().optional(),
      processingTime: z.number().optional(),
      sourcesCount: z.number().optional(),
    })
    .optional(),
});

export type CreateResearchTaskRequest = z.infer<typeof CreateResearchTaskRequestSchema>;
export type ResearchTask = z.infer<typeof ResearchTaskResponseSchema>;
export type ResearchResult = z.infer<typeof ResearchResultSchema>;

export class ExaResearchClient {
  private readonly apiKey?: string;
  private readonly baseUrl = 'https://api.exa.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getApiKey(): string {
    return this.apiKey || getEnv().EXA_API_KEY;
  }

  async createResearchTask(
    request: CreateResearchTaskRequest,
    taskId?: string
  ): Promise<ResultEnvelope<ResearchTask>> {
    const streamer = createEventStreamer(taskId || `research-create-${Date.now()}`);
    const startTime = Date.now();

    streamer.info('Creating research task', {
      model: request.model,
      instructionsLength: request.instructions.length,
      hasOutputSchema: !!request.outputSchema,
      hasWebhook: !!request.webhookUrl,
    });

    try {
      const response = await httpClient.post(`${this.baseUrl}/research`, request, {
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
        },
      });

      const duration = Date.now() - startTime;
      const validatedTask = ResearchTaskResponseSchema.parse(response);

      const result: ResultEnvelope<ResearchTask> = {
        status: 'success',
        taskId: taskId || `research-create-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: validatedTask,
      };

      streamer.completed('research-create', {
        researchTaskId: validatedTask.id,
        model: validatedTask.model,
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      streamer.failed(errorMessage, { duration });

      return {
        status: 'error',
        taskId: taskId || `research-create-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: {
          status: 'failed' as const,
          id: '',
          instructions: '',
          model: '',
          createdAt: new Date().toISOString(),
          error: errorMessage,
        },
        error: {
          code: 'RESEARCH_CREATE_ERROR',
          message: errorMessage,
        },
      };
    }
  }

  async getResearchTask(taskId: string, requestId?: string): Promise<ResultEnvelope<ResearchTask>> {
    const streamer = createEventStreamer(requestId || `research-get-${Date.now()}`);
    const startTime = Date.now();

    streamer.info('Fetching research task', { taskId });

    try {
      const response = await httpClient.get(`${this.baseUrl}/research/${taskId}`, {
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
        },
      });

      const duration = Date.now() - startTime;
      const validatedTask = ResearchTaskResponseSchema.parse(response);

      const result: ResultEnvelope<ResearchTask> = {
        status: 'success',
        taskId: requestId || `research-get-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: validatedTask,
      };

      streamer.completed('research-get', {
        taskId: validatedTask.id,
        status: validatedTask.status,
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      streamer.failed(errorMessage, { duration });

      return {
        status: 'error',
        taskId: requestId || `research-get-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: {
          status: 'failed' as const,
          id: '',
          instructions: '',
          model: '',
          createdAt: new Date().toISOString(),
          error: errorMessage,
        },
        error: {
          code: 'RESEARCH_GET_ERROR',
          message: errorMessage,
        },
      };
    }
  }

  async listResearchTasks(
    options: {
      page?: number;
      pageSize?: number;
      status?: ('pending' | 'running' | 'completed' | 'failed')[];
      model?: ('exa-research' | 'exa-research-pro')[];
    } = {},
    taskId?: string
  ): Promise<ResultEnvelope<z.infer<typeof ResearchTaskListResponseSchema>>> {
    const streamer = createEventStreamer(taskId || `research-list-${Date.now()}`);
    const startTime = Date.now();

    const params = new URLSearchParams({
      page: String(options.page || 1),
      pageSize: String(options.pageSize || 20),
    });

    if (options.status) {
      params.append('status', options.status.join(','));
    }

    if (options.model) {
      params.append('model', options.model.join(','));
    }

    streamer.info('Listing research tasks', options);

    try {
      const response = await httpClient.get(`${this.baseUrl}/research?${params}`, {
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
        },
      });

      const duration = Date.now() - startTime;
      const validatedResponse = ResearchTaskListResponseSchema.parse(response);

      const result: ResultEnvelope<z.infer<typeof ResearchTaskListResponseSchema>> = {
        status: 'success',
        taskId: taskId || `research-list-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: validatedResponse,
      };

      streamer.completed('research-list', {
        tasksCount: validatedResponse.tasks.length,
        total: validatedResponse.total,
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      streamer.failed(errorMessage, { duration });

      return {
        status: 'error',
        taskId: taskId || `research-list-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: {
          tasks: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
        error: {
          code: 'RESEARCH_LIST_ERROR',
          message: errorMessage,
        },
      };
    }
  }

  // Polling for task completion
  async pollResearchCompletion(
    researchTaskId: string,
    maxWaitTime: number = 600000, // 10 minutes
    pollInterval: number = 10000, // 10 seconds
    taskId?: string
  ): Promise<ResultEnvelope<ResearchResult>> {
    const streamer = createEventStreamer(taskId || `research-poll-${Date.now()}`);
    const startTime = Date.now();
    let attempts = 0;

    streamer.asyncStarted('research-completion-poll', maxWaitTime, { researchTaskId });

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;
      streamer.asyncPolling('research-completion-poll', attempts);

      try {
        const taskResult = await this.getResearchTask(researchTaskId, taskId);

        if (taskResult.status === 'error' || !taskResult.data) {
          throw new Error(taskResult.error?.message || 'Failed to get research task');
        }

        const researchTask = taskResult.data;

        if (researchTask.status === 'completed') {
          const duration = Date.now() - startTime;

          // Transform task result to research result format
          const researchResult: ResearchResult = {
            taskId: researchTask.id,
            status: 'completed',
            result: researchTask.result,
            metadata: {
              model: researchTask.model,
              processingTime:
                researchTask.completedAt && researchTask.startedAt
                  ? new Date(researchTask.completedAt).getTime() -
                    new Date(researchTask.startedAt).getTime()
                  : undefined,
              sourcesCount: Array.isArray(researchTask.result?.citations)
                ? researchTask.result.citations.length
                : undefined,
            },
          };

          // Extract citations if available in result
          if (researchTask.result?.citations && Array.isArray(researchTask.result.citations)) {
            researchResult.citations = researchTask.result.citations.map((citation: any) => ({
              url: citation.url,
              title: citation.title,
              snippet: citation.snippet,
              publishedDate: citation.publishedDate,
              author: citation.author,
            }));
          }

          const result: ResultEnvelope<ResearchResult> = {
            status: 'success',
            taskId: taskId || `research-poll-${Date.now()}`,
            timing: {
              startedAt: new Date(startTime).toISOString(),
              completedAt: new Date().toISOString(),
              duration,
            },
            citations: researchResult.citations || [],
            data: researchResult,
          };

          streamer.asyncCompleted('research-completion-poll', {
            researchTaskId,
            attempts,
            result: researchResult.status,
          });
          return result;
        } else if (researchTask.status === 'failed') {
          const duration = Date.now() - startTime;

          const researchResult: ResearchResult = {
            taskId: researchTask.id,
            status: 'failed',
            error: researchTask.error || 'Unknown error',
          };

          const result: ResultEnvelope<ResearchResult> = {
            status: 'error',
            taskId: taskId || `research-poll-${Date.now()}`,
            timing: {
              startedAt: new Date(startTime).toISOString(),
              completedAt: new Date().toISOString(),
              duration,
            },
            citations: [],
            data: researchResult,
            error: {
              code: 'RESEARCH_TASK_FAILED',
              message: researchTask.error || 'Research task failed',
            },
          };

          streamer.failed('Research task failed', {
            researchTaskId,
            attempts,
            error: researchTask.error,
          });
          return result;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        streamer.failed(errorMessage, { duration, attempts });

        return {
          status: 'error',
          taskId: taskId || `research-poll-${Date.now()}`,
          timing: {
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            duration,
          },
          citations: [],
          data: {
            status: 'failed' as const,
            taskId: researchTaskId,
            error: errorMessage,
          },
          error: {
            code: 'RESEARCH_POLL_ERROR',
            message: errorMessage,
          },
        };
      }
    }

    // Timeout
    const duration = Date.now() - startTime;
    streamer.failed('Research polling timeout', { duration, attempts });

    return {
      status: 'error',
      taskId: taskId || `research-poll-${Date.now()}`,
      timing: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        duration,
      },
      citations: [],
      data: {
        status: 'failed' as const,
        taskId: researchTaskId,
        error: `Research polling timed out after ${maxWaitTime}ms`,
      },
      error: {
        code: 'RESEARCH_POLLING_TIMEOUT',
        message: `Research polling timed out after ${maxWaitTime}ms`,
      },
    };
  }

  async executeTask(task: z.infer<typeof ResearchTaskSchema>): Promise<ResultEnvelope<any>> {
    const validatedTask = ResearchTaskSchema.parse(task);

    switch (validatedTask.operation) {
      case 'create':
        if (!validatedTask.instructions) {
          throw new Error('instructions are required for create operation');
        }
        return this.createResearchTask(
          {
            instructions: validatedTask.instructions,
            model: validatedTask.model,
            outputSchema: validatedTask.outputSchema,
          },
          validatedTask.taskId
        );

      case 'get':
        if (!validatedTask.taskId) {
          throw new Error('taskId is required for get operation');
        }
        return this.getResearchTask(validatedTask.taskId, validatedTask.taskId);

      case 'list':
        return this.listResearchTasks({}, validatedTask.taskId);

      default:
        throw new Error(`Unknown operation: ${validatedTask.operation}`);
    }
  }

  // Utility methods for common research workflows
  async quickResearch(
    instructions: string,
    model: 'exa-research' | 'exa-research-pro' = 'exa-research',
    poll: boolean = true,
    maxWaitTime: number = 600000
  ): Promise<ResultEnvelope<ResearchResult>> {
    const taskId = `research-quick-${Date.now()}`;

    // Create task
    const createResult = await this.createResearchTask(
      {
        instructions,
        model,
      },
      taskId
    );

    if (createResult.status === 'error' || !createResult.data) {
      return createResult as unknown as ResultEnvelope<ResearchResult>;
    }

    const researchTaskId = createResult.data.id;

    if (!poll) {
      // Return the task creation result without polling
      return {
        ...createResult,
        data: {
          taskId: researchTaskId,
          status: 'pending' as const,
        },
      } as ResultEnvelope<ResearchResult>;
    }

    // Poll for completion
    return this.pollResearchCompletion(researchTaskId, maxWaitTime, undefined, taskId);
  }

  async structuredResearch(
    instructions: string,
    outputSchema: Record<string, any>,
    model: 'exa-research' | 'exa-research-pro' = 'exa-research',
    poll: boolean = true,
    maxWaitTime: number = 600000
  ): Promise<ResultEnvelope<ResearchResult>> {
    const taskId = `research-structured-${Date.now()}`;

    // Create task with output schema
    const createResult = await this.createResearchTask(
      {
        instructions,
        model,
        outputSchema,
      },
      taskId
    );

    if (createResult.status === 'error' || !createResult.data) {
      return createResult as unknown as ResultEnvelope<ResearchResult>;
    }

    const researchTaskId = createResult.data.id;

    if (!poll) {
      return {
        ...createResult,
        data: {
          taskId: researchTaskId,
          status: 'pending' as const,
        },
      } as ResultEnvelope<ResearchResult>;
    }

    // Poll for completion
    return this.pollResearchCompletion(researchTaskId, maxWaitTime, undefined, taskId);
  }
}

// Export singleton instance
export const exaResearchClient = new ExaResearchClient();
