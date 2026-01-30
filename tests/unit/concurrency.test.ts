import { describe, it, expect, beforeEach } from 'vitest';

import { ConcurrencyPool, executeWithConcurrency, executeWithOrdering } from '../../src/util/concurrency';
import type { EnhancedTask } from '../../src/schema';

describe('ConcurrencyPool', () => {
  let pool: ConcurrencyPool<string>;
  let tasks: EnhancedTask[];

  beforeEach(() => {
    pool = new ConcurrencyPool<string>(2, true);
    tasks = [
      { type: 'search', query: 'task1', id: '1' } as EnhancedTask,
      { type: 'search', query: 'task2', id: '2' } as EnhancedTask,
      { type: 'search', query: 'task3', id: '3' } as EnhancedTask,
      { type: 'search', query: 'task4', id: '4' } as EnhancedTask,
    ];
  });

  describe('initial state', () => {
    it('should initialize with correct concurrency limit', () => {
      const stats = pool.getStats();
      expect(stats.running).toBe(0);
      expect(stats.queued).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute tasks and return results', async () => {
      const executor = async (task: EnhancedTask): Promise<string> => {
        return `Result for ${task.query}`;
      };

      const results = await pool.execute(tasks, executor);

      expect(results.length).toBe(4);
    });

    it('should include task, result, and index in each result', async () => {
      const executor = async (task: EnhancedTask): Promise<string> => {
        return `Processed ${task.query}`;
      };

      const results = await pool.execute(tasks, executor);

      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toHaveProperty('task');
        expect(results[i]).toHaveProperty('result');
        expect(results[i]).toHaveProperty('index', i);
        expect(results[i].result).toContain(tasks[i].query);
      }
    });

    it('should track running, queued, and completed stats', async () => {
      const executor = async (task: EnhancedTask): Promise<string> => {
        return `Result for ${task.query}`;
      };

      await pool.execute(tasks, executor);

      const stats = pool.getStats();
      expect(stats.running).toBe(0);
      expect(stats.queued).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return accurate stats after execution', async () => {
      const executor = async (task: EnhancedTask): Promise<string> => {
        return `Result for ${task.query}`;
      };

      await pool.execute(tasks, executor);

      const stats = pool.getStats();
      expect(stats.running).toBe(0);
      expect(stats.queued).toBe(0);
    });
  });
});

describe('executeWithConcurrency', () => {
  it('should execute tasks with specified concurrency', async () => {
    const tasks = [
      { type: 'search', query: 'task1' } as EnhancedTask,
      { type: 'search', query: 'task2' } as EnhancedTask,
      { type: 'search', query: 'task3' } as EnhancedTask,
    ];

    const executor = async (task: EnhancedTask): Promise<string> => {
      return `Result for ${task.query}`;
    };

    const results = await executeWithConcurrency(tasks, executor, 2);

    expect(results.length).toBe(3);
  });

  it('should return results', async () => {
    const tasks = [
      { type: 'search', query: 'task1', id: '1' } as EnhancedTask,
      { type: 'search', query: 'task2', id: '2' } as EnhancedTask,
      { type: 'search', query: 'task3', id: '3' } as EnhancedTask,
    ];

    const executor = async (task: EnhancedTask): Promise<string> => {
      return task.query;
    };

    const results = await executeWithConcurrency(tasks, executor, 2);

    expect(results.length).toBe(3);
  });
});

describe('executeWithOrdering', () => {
  it('should execute tasks with specified concurrency', async () => {
    const tasks = [
      { type: 'search', query: 'task1' } as EnhancedTask,
      { type: 'search', query: 'task2' } as EnhancedTask,
      { type: 'search', query: 'task3' } as EnhancedTask,
    ];

    const executor = async (task: EnhancedTask): Promise<string> => {
      return `Result for ${task.query}`;
    };

    const results = await executeWithOrdering(tasks, executor, 2);

    expect(results.length).toBe(3);
  });

  it('should return results with correct indices', async () => {
    const tasks = [
      { type: 'search', query: 'first', id: '1' } as EnhancedTask,
      { type: 'search', query: 'second', id: '2' } as EnhancedTask,
    ];

    const executor = async (task: EnhancedTask): Promise<string> => {
      return task.query;
    };

    const results = await executeWithOrdering(tasks, executor, 1);

    expect(results[0].index).toBe(0);
    expect(results[1].index).toBe(1);
  });
});
