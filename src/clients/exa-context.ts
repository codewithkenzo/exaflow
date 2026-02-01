import { z } from 'zod';
import { BaseExaClient } from './base-client';
import type { ResultEnvelope } from '../schema';
import { ContextTaskSchema } from '../schema';

// Context API response schemas
const ContextResponseSchema = z.object({
  response: z.string(),
  metadata: z
    .object({
      query: z.string(),
      tokensNum: z.number(),
      model: z.string(),
      sources: z
        .array(
          z.object({
            url: z.string().url(),
            title: z.string(),
            snippet: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
});

export type ContextResponse = z.infer<typeof ContextResponseSchema>;

export class ExaContextClient extends BaseExaClient {
  async getContext(
    query: string,
    tokensNum: number = 5000,
    taskId?: string
  ): Promise<ResultEnvelope<ContextResponse>> {
    this.requireApiKey('Context API');
    const finalTaskId = this.getTaskId(taskId, 'context');
    const streamer = this.createStreamer(finalTaskId, 'context');
    const startTime = Date.now();

    streamer.info('Starting Context API request', { query, tokensNum });

    // Execute request using base class method
    const result = await this.executeRequest(
      'POST',
      '/context',
      { query, tokensNum },
      ContextResponseSchema,
      finalTaskId,
      streamer,
      startTime,
      undefined,
      {
        errorCode: 'CONTEXT_API_ERROR',
        errorPrefix: 'Context API request failed',
        fallbackData: { response: '' },
      }
    );

    // Map sources to citations if successful
    if (result.status === 'success' && result.data.metadata?.sources) {
      result.citations = result.data.metadata.sources.map(source => ({
        url: source.url,
        title: source.title,
        snippet: source.snippet,
      }));
    }

    streamer.completed('context', { citationsCount: result.citations.length });
    return result;
  }

  async executeTask(
    task: z.infer<typeof ContextTaskSchema>
  ): Promise<ResultEnvelope<ContextResponse>> {
    const validatedTask = this.validateTask(task, ContextTaskSchema);
    return this.getContext(validatedTask.query, validatedTask.tokensNum, validatedTask.id);
  }

  // Utility method for simple context queries
  async query(
    query: string,
    options: {
      tokens?: number;
      taskId?: string;
    } = {}
  ): Promise<ResultEnvelope<ContextResponse>> {
    const finalTaskId = this.getTaskId(options.taskId, 'context-query');
    return this.getContext(query, options.tokens || 5000, finalTaskId);
  }
}

// Export singleton instance
export const exaContextClient = new ExaContextClient();
