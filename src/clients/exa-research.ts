import { z } from 'zod';
import { BaseExaClient } from './base-client';
import type { ResultEnvelope } from '../schema';
import { ResearchTaskSchema, CitationSchema } from '../schema';

// Research API schemas
const CreateResearchTaskRequestSchema = z.object({
  instructions: z.string().min(1),
  model: z.enum(['exa-research', 'exa-research-pro']).default('exa-research'),
  outputSchema: z.record(z.any()).optional(),
  webhookUrl: z.string().url().optional(),
});

const ResearchTaskResponseSchema = z.object({
  id: z.string().optional(),
  researchId: z.string().optional(), // API may return researchId instead of id
  instructions: z.string().optional(),
  model: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  createdAt: z.union([z.string(), z.number()]).optional(), // API returns timestamp as number
  startedAt: z.union([z.string(), z.number()]).optional(),
  completedAt: z.union([z.string(), z.number()]).optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  outputSchema: z.record(z.any()).optional(),
});

const ResearchTaskListResponseSchema = z.object({
  tasks: z.array(
    ResearchTaskSchema.extend({
      model: z.enum(['exa-research', 'exa-research-pro']),
    })
  ),
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

export class ExaResearchClient extends BaseExaClient {
  constructor(apiKey?: string) {
    super(apiKey);
  }

  async createResearchTask(
    request: CreateResearchTaskRequest,
    taskId?: string
  ): Promise<ResultEnvelope<ResearchTask>> {
    this.requireApiKey('Research API');

    const actualTaskId = this.getTaskId(taskId, 'research-create');
    const streamer = this.createStreamer(actualTaskId, 'research');
    const startTime = Date.now();

    streamer.info('Creating research task', {
      model: request.model,
      instructionsLength: request.instructions.length,
      hasOutputSchema: !!request.outputSchema,
      hasWebhook: !!request.webhookUrl,
    });

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'POST',
      '/research/v1',
      request,
      ResearchTaskResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: false }, // Create requests should not be cached
      {
        errorCode: 'RESEARCH_CREATE_ERROR',
        errorPrefix: 'Research Create API',
        fallbackData: {
          status: 'failed' as const,
          id: '',
          instructions: '',
          model: '',
          createdAt: new Date().toISOString(),
          error: 'Failed to create research task',
        },
      }
    );

    // If successful, log completion with specific details
    if (result.status === 'success') {
      streamer.completed('research-create', {
        researchTaskId: result.data.id,
        model: result.data.model,
      });
    }

    // Return result as-is (base class already handles error formatting)
    return result;
  }

  async getResearchTask(taskId: string, requestId?: string): Promise<ResultEnvelope<ResearchTask>> {
    this.requireApiKey('Research API');

    const actualTaskId = this.getTaskId(requestId, 'research-get');
    const streamer = this.createStreamer(actualTaskId, 'research');
    const startTime = Date.now();

    streamer.info('Fetching research task', { taskId });

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'GET',
      `/research/v1/${taskId}`,
      null,
      ResearchTaskResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: true }, // Get requests can benefit from caching
      {
        errorCode: 'RESEARCH_GET_ERROR',
        errorPrefix: 'Research Get API',
        fallbackData: {
          status: 'failed' as const,
          id: '',
          instructions: '',
          model: '',
          createdAt: new Date().toISOString(),
          error: 'Failed to get research task',
        },
      }
    );

    // If successful, log completion with specific details
    if (result.status === 'success') {
      streamer.completed('research-get', {
        taskId: result.data.id,
        status: result.data.status,
      });
    }

    // Return result as-is (base class already handles error formatting)
    return result;
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
    this.requireApiKey('Research API');

    const actualTaskId = this.getTaskId(taskId, 'research-list');
    const streamer = this.createStreamer(actualTaskId, 'research');
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

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'GET',
      `/research/v1?${params}`,
      null,
      ResearchTaskListResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: true }, // List requests can benefit from caching
      {
        errorCode: 'RESEARCH_LIST_ERROR',
        errorPrefix: 'Research List API',
        fallbackData: {
          tasks: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      }
    );

    // If successful, log completion with specific details
    if (result.status === 'success') {
      streamer.completed('research-list', {
        tasksCount: result.data.tasks.length,
        total: result.data.total,
      });
    }

    // Return result as-is (base class already handles error formatting)
    return result;
  }

  // Polling for task completion using base class pollForCompletion
  async pollResearchCompletion(
    researchTaskId: string,
    maxWaitTime: number = 600000, // 10 minutes
    pollInterval: number = 10000, // 10 seconds
    taskId?: string
  ): Promise<ResultEnvelope<ResearchResult>> {
    const actualTaskId = this.getTaskId(taskId, 'research-poll');
    const streamer = this.createStreamer(actualTaskId, 'research');
    const startTime = Date.now();

    // Use base class pollForCompletion method
    return this.pollForCompletion(
      // Poll function
      async () => {
        const taskResult = await this.getResearchTask(researchTaskId);

        if (taskResult.status === 'error' || !taskResult.data) {
          throw new Error(taskResult.error?.message || 'Failed to get research task');
        }

        const researchTask = taskResult.data;

        // Transform task result to research result format
        if (researchTask.status === 'completed') {
          const researchResult: ResearchResult = {
            taskId: researchTask.id || researchTask.researchId || '',
            status: 'completed',
            result: researchTask.result,
            metadata: {
              model: researchTask.model || 'exa-research',
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

          return { status: 'completed', data: researchResult };
        } else if (researchTask.status === 'failed') {
          return {
            status: 'failed',
            error: researchTask.error || 'Unknown error',
            data: {
              taskId: researchTask.id || researchTask.researchId || '',
              status: 'failed',
              error: researchTask.error || 'Unknown error',
            },
          };
        }

        return { status: researchTask.status || 'pending' };
      },
      // Completion check
      status => status === 'completed',
      // Failure check
      status => status === 'failed',
      actualTaskId,
      streamer,
      startTime,
      maxWaitTime,
      pollInterval,
      'research-completion-poll'
    );
  }

  async executeTask(task: z.infer<typeof ResearchTaskSchema>): Promise<ResultEnvelope<any>> {
    const validatedTask = this.validateTask(task, ResearchTaskSchema);

    switch (validatedTask.operation) {
      case 'create':
        if (!validatedTask.instructions) {
          throw new Error('instructions are required for create operation');
        }
        return this.createResearchTask(
          {
            instructions: validatedTask.instructions,
            model: validatedTask.model ?? 'exa-research',
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

    const researchTaskId = createResult.data.id || createResult.data.researchId || '';

    if (!researchTaskId) {
      return {
        status: 'error',
        error: { code: 'RESEARCH_CREATE_ERROR', message: 'No research task ID returned' },
        data: { taskId: '', status: 'failed' as const, error: 'No research task ID' },
      } as ResultEnvelope<ResearchResult>;
    }

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

    const researchTaskId = createResult.data.id || createResult.data.researchId || '';

    if (!researchTaskId) {
      return {
        status: 'error',
        error: { code: 'RESEARCH_CREATE_ERROR', message: 'No research task ID returned' },
        data: { taskId: '', status: 'failed' as const, error: 'No research task ID' },
      } as ResultEnvelope<ResearchResult>;
    }

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
