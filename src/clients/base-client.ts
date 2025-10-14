import { z } from 'zod';
import { httpClient } from '../util/http';
import { cachedHttpClient } from '../util/http-cache';
import { createEventStreamer, EventStreamer } from '../util/streaming';
import type { ResultEnvelope, CitationSchema } from '../schema';
import { getEnv } from '../env';

/**
 * Configuration options for API requests
 */
export interface ApiRequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  useCache?: boolean;
}

/**
 * Base class for all Exa API clients
 * Provides common functionality for API key management, error handling,
 * event streaming, and result envelope creation
 */
export abstract class BaseExaClient {
  protected readonly apiKey?: string;
  protected readonly baseUrl = 'https://api.exa.ai';
  private static taskIdCounter = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get the API key from instance or environment
   */
  protected getApiKey(): string {
    return this.apiKey || getEnv().EXA_API_KEY;
  }

  /**
   * Check if API key is available
   */
  protected hasApiKey(): boolean {
    try {
      return !!this.getApiKey();
    } catch {
      return false;
    }
  }

  /**
   * Check if API key is available and throw error if not
   */
  protected requireApiKey(apiName: string): string {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`EXA_API_KEY is required for ${apiName}`);
    }
    return apiKey;
  }

  /**
   * Create an event streamer with the given task ID
   */
  protected createStreamer(taskId?: string, clientName?: string): EventStreamer {
    const defaultTaskId = clientName ? `${clientName}-${Date.now()}` : `task-${Date.now()}`;
    return createEventStreamer(taskId || defaultTaskId);
  }

  /**
   * Create a result envelope with the given data and metadata
   */
  protected createResultEnvelope<T>(
    status: 'success' | 'partial' | 'error',
    taskId: string,
    startTime: number,
    citations: z.infer<typeof CitationSchema>[] = [],
    data: T,
    error?: { code: string; message: string; details?: Record<string, unknown> }
  ): ResultEnvelope<T> {
    const duration = Date.now() - startTime;

    return {
      status,
      taskId,
      timing: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        duration,
      },
      citations,
      data,
      error,
    };
  }

  /**
   * Create an error result envelope
   */
  protected createErrorResult<T>(
    taskId: string,
    startTime: number,
    errorCode: string,
    errorMessage: string,
    fallbackData: T,
    errorDetails?: Record<string, unknown>
  ): ResultEnvelope<T> {
    return this.createResultEnvelope('error', taskId, startTime, [], fallbackData, {
      code: errorCode,
      message: errorMessage,
      details: errorDetails,
    });
  }

  /**
   * Execute an API request with common error handling and streaming
   */
  protected async executeRequest<TRequest, TResponse, TValidated>(
    method: 'GET' | 'POST',
    endpoint: string,
    requestData: TRequest | null,
    validationSchema: z.ZodSchema<TValidated>,
    taskId: string,
    streamer: EventStreamer,
    startTime: number,
    options?: ApiRequestOptions,
    errorContext?: {
      errorCode: string;
      errorPrefix: string;
      fallbackData: TValidated;
    }
  ): Promise<ResultEnvelope<TValidated>> {
    try {
      // Log the request
      if (requestData) {
        streamer.apiRequest(method, endpoint, requestData as Record<string, unknown>);
      } else {
        streamer.apiRequest(method, endpoint);
      }

      // Execute the request
      let response: unknown;

      const requestConfig = {
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          ...options?.headers,
        },
        timeout: options?.timeout,
        retries: options?.retries,
        signal: options?.signal,
      };

      // Choose HTTP client based on cache preference
      const client = options?.useCache !== false ? cachedHttpClient : httpClient;

      if (method === 'POST' && requestData) {
        response = await client.post(`${this.baseUrl}${endpoint}`, requestData, requestConfig);
      } else {
        response = await client.get(`${this.baseUrl}${endpoint}`, requestConfig);
      }

      // Calculate duration and log response
      const duration = Date.now() - startTime;
      streamer.apiResponse(method, endpoint, 200, duration);

      // Validate the response
      const validatedResponse = validationSchema.parse(response);

      // Return success result
      return this.createResultEnvelope('success', taskId, startTime, [], validatedResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;

      streamer.failed(errorMessage, { duration });

      // Return error result
      if (errorContext) {
        return this.createErrorResult(
          taskId,
          startTime,
          errorContext.errorCode,
          errorMessage,
          errorContext.fallbackData
        );
      }

      // Default error handling
      throw error;
    }
  }

  /**
   * Poll for completion of an async operation
   */
  protected async pollForCompletion<T>(
    pollFunction: () => Promise<{ status: string; data?: T; error?: string }>,
    isComplete: (status: string) => boolean,
    hasFailed: (status: string) => boolean,
    taskId: string,
    streamer: EventStreamer,
    startTime: number,
    maxWaitTime: number = 300000,
    pollInterval: number = 5000,
    operationName: string = 'operation'
  ): Promise<ResultEnvelope<T>> {
    let attempts = 0;

    streamer.asyncStarted(operationName, maxWaitTime);

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;
      streamer.asyncPolling(operationName, attempts);

      try {
        const result = await pollFunction();

        if (hasFailed(result.status)) {
          const duration = Date.now() - startTime;
          const errorMessage = result.error || `${operationName} failed`;

          streamer.failed(errorMessage, { duration, attempts });

          return this.createErrorResult(
            taskId,
            startTime,
            `${operationName.toUpperCase()}_FAILED`,
            errorMessage,
            {} as T
          );
        }

        if (isComplete(result.status) && result.data) {
          const duration = Date.now() - startTime;

          streamer.asyncCompleted(operationName, { attempts });

          return this.createResultEnvelope('success', taskId, startTime, [], result.data);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        streamer.failed(errorMessage, { duration, attempts });

        return this.createErrorResult(
          taskId,
          startTime,
          `${operationName.toUpperCase()}_POLL_ERROR`,
          errorMessage,
          {} as T
        );
      }
    }

    // Timeout
    const duration = Date.now() - startTime;
    const timeoutMessage = `${operationName} polling timed out after ${maxWaitTime}ms`;

    streamer.failed(timeoutMessage, { duration, attempts });

    return this.createErrorResult(
      taskId,
      startTime,
      `${operationName.toUpperCase()}_POLLING_TIMEOUT`,
      timeoutMessage,
      {} as T
    );
  }

  /**
   * Validate task data using a schema
   */
  protected validateTask<T>(task: unknown, schema: z.ZodSchema<T>): T {
    return schema.parse(task);
  }

  /**
   * Get a default task ID if none provided
   */
  protected getTaskId(taskId?: string, prefix?: string): string {
    if (taskId) {
      return taskId;
    }

    // Use counter to ensure uniqueness even for rapid calls
    BaseExaClient.taskIdCounter++;
    return `${prefix || 'task'}-${Date.now()}-${BaseExaClient.taskIdCounter}`;
  }

  /**
   * Abstract method that each client must implement
   * to execute their specific task type
   */
  abstract executeTask(task: any): Promise<ResultEnvelope<any>>;
}
