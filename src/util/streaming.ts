import type { EventEnvelope } from '../schema';

export class EventStreamer {
  private taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  private createEvent(
    level: EventEnvelope['level'],
    type: string,
    message: string,
    meta?: Record<string, any>
  ): EventEnvelope {
    const event: EventEnvelope = {
      level,
      type,
      message,
      ts: new Date().toISOString(),
      taskId: this.taskId,
      meta,
    };

    // Event envelope validation bypassed for performance
    // Schema validation is handled at the application level

    return event;
  }

  private sendEvent(event: EventEnvelope): void {
    // Send to stderr as JSONL
    console.error(JSON.stringify(event));
  }

  debug(message: string, meta?: Record<string, any>): void {
    const event = this.createEvent('debug', 'debug', message, meta);
    this.sendEvent(event);
  }

  info(message: string, meta?: Record<string, any>): void {
    const event = this.createEvent('info', 'info', message, meta);
    this.sendEvent(event);
  }

  warn(message: string, meta?: Record<string, any>): void {
    const event = this.createEvent('warn', 'warn', message, meta);
    this.sendEvent(event);
  }

  error(message: string, meta?: Record<string, any>): void {
    const event = this.createEvent('error', 'error', message, meta);
    this.sendEvent(event);
  }

  // Specific event types for our use cases
  started(taskType: string, meta?: Record<string, any>): void {
    this.info(`Task started: ${taskType}`, { ...meta, taskType });
  }

  progress(message: string, progress?: number, total?: number, meta?: Record<string, any>): void {
    this.info(message, { progress, total, ...meta });
  }

  completed(resultType: string, meta?: Record<string, any>): void {
    this.info(`Task completed: ${resultType}`, { ...meta, resultType });
  }

  failed(error: Error | string, meta?: Record<string, any>): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.error(`Task failed: ${errorMessage}`, {
      errorMessage,
      errorStack,
      ...meta,
    });
  }

  retry(attempt: number, maxAttempts: number, reason: string, meta?: Record<string, any>): void {
    this.warn(`Retry attempt ${attempt}/${maxAttempts}: ${reason}`, {
      attempt,
      maxAttempts,
      reason,
      ...meta,
    });
  }

  // API-specific events
  apiRequest(method: string, url: string, meta?: Record<string, any>): void {
    this.debug(`API request: ${method} ${url}`, { method, url, ...meta });
  }

  apiResponse(
    method: string,
    url: string,
    status: number,
    duration: number,
    meta?: Record<string, any>
  ): void {
    this.debug(`API response: ${method} ${url} (${status})`, {
      method,
      url,
      status,
      duration,
      ...meta,
    });
  }

  // Async operation events
  asyncStarted(operation: string, expectedDuration?: number, meta?: Record<string, any>): void {
    this.info(`Async operation started: ${operation}`, {
      operation,
      expectedDuration,
      ...meta,
    });
  }

  asyncPolling(
    operation: string,
    attempt: number,
    status?: string,
    meta?: Record<string, any>
  ): void {
    this.info(`Polling async operation: ${operation} (attempt ${attempt})`, {
      operation,
      attempt,
      status,
      ...meta,
    });
  }

  asyncCompleted(operation: string, result: any, meta?: Record<string, any>): void {
    this.info(`Async operation completed: ${operation}`, {
      operation,
      result,
      ...meta,
    });
  }

  // Webhook events
  webhookReceived(eventType: string, payload: any, meta?: Record<string, any>): void {
    this.info(`Webhook received: ${eventType}`, {
      eventType,
      payload,
      ...meta,
    });
  }

  webhookProcessed(eventType: string, success: boolean, meta?: Record<string, any>): void {
    this.info(`Webhook processed: ${eventType}`, {
      eventType,
      success,
      ...meta,
    });
  }

  // Concurrency events
  concurrencyUpdate(
    stats: { running: number; queued: number; completed: number },
    meta?: Record<string, any>
  ): void {
    this.debug('Concurrency stats updated', { stats, ...meta });
  }

  batchStarted(totalTasks: number, concurrency: number, meta?: Record<string, any>): void {
    this.info(`Batch started: ${totalTasks} tasks with concurrency ${concurrency}`, {
      totalTasks,
      concurrency,
      ...meta,
    });
  }

  batchProgress(completed: number, total: number, meta?: Record<string, any>): void {
    this.progress(`Batch progress: ${completed}/${total} tasks completed`, completed, total, meta);
  }

  batchCompleted(totalTasks: number, totalDuration: number, meta?: Record<string, any>): void {
    this.info(`Batch completed: ${totalTasks} tasks in ${totalDuration}ms`, {
      totalTasks,
      totalDuration,
      ...meta,
    });
  }
}

// Factory function to create event streamers
export function createEventStreamer(taskId: string): EventStreamer {
  return new EventStreamer(taskId);
}

// Global event streamer for operations without specific task ID
export const globalEventStreamer = new EventStreamer('global');

// Utility function to stream results to stdout
export function streamResult<T>(result: T): void {
  console.log(JSON.stringify(result, null, 2));
}

// Utility function to stream results as compact JSON
export function streamResultCompact<T>(result: T): void {
  console.log(JSON.stringify(result));
}
