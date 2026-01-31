import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";

import {
  EventStreamer,
  createEventStreamer,
  globalEventStreamer,
  streamResult,
  streamResultCompact,
} from '../../src/util/streaming';

describe('EventStreamer', () => {
  let streamer: EventStreamer;
  let consoleErrorSpy: { mockRestore: () => void };

  beforeEach(() => {
    streamer = new EventStreamer('test-task-123');
    // Spy on console.error to capture JSONL output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with provided task ID', () => {
      const testStreamer = new EventStreamer('my-task-id');
      expect((testStreamer as any).taskId).toBe('my-task-id');
    });
  });

  describe('createEvent', () => {
    it('should create events with correct structure', () => {
      const event = (streamer as any).createEvent('info', 'test', 'Test message', { key: 'value' });

      expect(event).toHaveProperty('level', 'info');
      expect(event).toHaveProperty('type', 'test');
      expect(event).toHaveProperty('message', 'Test message');
      expect(event).toHaveProperty('ts');
      expect(event).toHaveProperty('taskId', 'test-task-123');
      expect(event).toHaveProperty('meta', { key: 'value' });
    });

    it('should create events without optional meta', () => {
      const event = (streamer as any).createEvent('debug', 'test', 'Debug message');

      expect(event.level).toBe('debug');
      expect(event.type).toBe('test');
      expect(event.message).toBe('Debug message');
      expect(event.meta).toBeUndefined();
    });

    it('should include ISO timestamp', () => {
      const event = (streamer as any).createEvent('info', 'info', 'Test');
      expect(event.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('sendEvent', () => {
    it('should send events as JSON to stderr', () => {
      const event = { level: 'info' as const, type: 'test', message: 'msg', ts: 'now', taskId: '123' };
      (streamer as any).sendEvent(event);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toBe(JSON.stringify(event));
    });
  });

  describe('log levels', () => {
    it('should create debug events', () => {
      streamer.debug('Debug message', { key: 'value' });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should create info events', () => {
      streamer.info('Info message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should create warn events', () => {
      streamer.warn('Warning message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should create error events', () => {
      streamer.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('task lifecycle events', () => {
    it('should log started events', () => {
      streamer.started('search', { query: 'test' });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Task started: search');
    });

    it('should log progress events', () => {
      streamer.progress('Processing...', 50, 100);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should log completed events', () => {
      streamer.completed('search', { results: 10 });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Task completed: search');
    });

    it('should log failed events with error message', () => {
      streamer.failed(new Error('Something went wrong'));
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Task failed: Something went wrong');
    });

    it('should log failed events with string error', () => {
      streamer.failed('Connection refused');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Connection refused');
    });

    it('should include error stack trace for Error objects', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      streamer.failed(error);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.meta.errorStack).toBe('Error stack trace');
    });
  });

  describe('retry events', () => {
    it('should log retry events', () => {
      streamer.retry(1, 3, 'Rate limited');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Retry attempt 1/3: Rate limited');
    });
  });

  describe('API events', () => {
    it('should log API request events', () => {
      streamer.apiRequest('POST', '/search', { query: 'test' });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('API request: POST /search');
    });

    it('should log API response events', () => {
      streamer.apiResponse('POST', '/search', 200, 150);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('API response: POST /search (200)');
    });
  });

  describe('async operation events', () => {
    it('should log async started events', () => {
      streamer.asyncStarted('research', 30000);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Async operation started: research');
    });

    it('should log async polling events', () => {
      streamer.asyncPolling('research', 5, 'processing');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Polling async operation: research (attempt 5)');
    });

    it('should log async completed events', () => {
      streamer.asyncCompleted('research', { result: 'done' });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Async operation completed: research');
    });
  });

  describe('webhook events', () => {
    it('should log webhook received events', () => {
      streamer.webhookReceived('task.completed', { taskId: '123' });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Webhook received: task.completed');
    });

    it('should log webhook processed events', () => {
      streamer.webhookProcessed('task.completed', true);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrency events', () => {
    it('should log concurrency update events', () => {
      streamer.concurrencyUpdate({ running: 5, queued: 10, completed: 3 });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should log batch started events', () => {
      streamer.batchStarted(100, 5);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Batch started: 100 tasks');
    });

    it('should log batch progress events', () => {
      streamer.batchProgress(50, 100);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should log batch completed events', () => {
      streamer.batchCompleted(100, 5000);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain('Batch completed: 100 tasks');
    });
  });
});

describe('createEventStreamer', () => {
  it('should create an EventStreamer with the given task ID', () => {
    const streamer = createEventStreamer('my-custom-task');
    expect(streamer).toBeInstanceOf(EventStreamer);
  });
});

describe('globalEventStreamer', () => {
  it('should be an instance of EventStreamer', () => {
    expect(globalEventStreamer).toBeInstanceOf(EventStreamer);
  });

  it('should have "global" as task ID', () => {
    expect((globalEventStreamer as any).taskId).toBe('global');
  });
});

describe('streamResult', () => {
  it('should output result as formatted JSON to stdout', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = { data: 'test', count: 42 };

    streamResult(result);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toBe(JSON.stringify(result, null, 2));

    consoleLogSpy.mockRestore();
  });
});

describe('streamResultCompact', () => {
  it('should output result as compact JSON to stdout', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = { data: 'test', count: 42 };

    streamResultCompact(result);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toBe(JSON.stringify(result));

    consoleLogSpy.mockRestore();
  });
});
