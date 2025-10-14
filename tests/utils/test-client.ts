import { BaseExaClient } from '../../src/clients/base-client';
import { z } from 'zod';
import type { ResultEnvelope } from '../../src/schema';

// Test schema for validation
const TestTaskSchema = z.object({
  query: z.string(),
  type: z.string().optional(),
});

const TestResultSchema = z.object({
  results: z.array(z.string()).optional(),
  response: z.string().optional(),
  mockData: z.any().optional(),
});

/**
 * Test implementation of BaseExaClient for testing purposes
 */
export class TestExaClient extends BaseExaClient {
  async executeTask(task: any, options?: any): Promise<ResultEnvelope<any>> {
    const taskId = this.getTaskId(task.taskId, 'test');
    const startTime = Date.now();
    const streamer = this.createStreamer(taskId, 'test-client');

    try {
      // Validate the task
      const validatedTask = this.validateTask(task, TestTaskSchema);

      // Simulate processing based on task type
      if (validatedTask.type === 'search') {
        return this.executeRequest(
          'POST',
          '/search',
          { query: validatedTask.query, numResults: 10 },
          TestResultSchema,
          taskId,
          streamer,
          startTime,
          options,
          {
            errorCode: 'SEARCH_FAILED',
            errorPrefix: 'Search operation failed',
            fallbackData: { results: [], mockData: true }
          }
        );
      } else if (validatedTask.type === 'context') {
        return this.executeRequest(
          'POST',
          '/context',
          { query: validatedTask.query, tokensNum: 1000 },
          TestResultSchema,
          taskId,
          streamer,
          startTime,
          options,
          {
            errorCode: 'CONTEXT_FAILED',
            errorPrefix: 'Context operation failed',
            fallbackData: { response: 'Fallback response', mockData: true }
          }
        );
      } else {
        // Default operation
        streamer.taskStarted('test-operation');
        streamer.taskCompleted('test-operation');

        return this.createResultEnvelope(
          'success',
          taskId,
          startTime,
          [],
          { mockData: true, query: validatedTask.query }
        );
      }
    } catch (error) {
      return this.createErrorResult(
        taskId,
        startTime,
        'TASK_EXECUTION_FAILED',
        error instanceof Error ? error.message : String(error),
        { mockData: true, error: true }
      );
    }
  }
}