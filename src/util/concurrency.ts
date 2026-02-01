import type { EnhancedTask } from '../schema';

export interface ConcurrencyResult<T> {
  task: EnhancedTask;
  result: T;
  index: number;
}

export class ConcurrencyPool<T> {
  private readonly maxConcurrency: number;
  private readonly preserveOrder: boolean;
  private running = 0;
  private queue: Array<{
    task: EnhancedTask;
    index: number;
    resolve: (result: ConcurrencyResult<T>) => void;
    reject: (error: Error) => void;
  }> = [];
  private pendingResults = new Map<number, ConcurrencyResult<T>>();
  private nextIndex = 0;

  constructor(maxConcurrency: number, preserveOrder = true) {
    this.maxConcurrency = Math.max(1, maxConcurrency);
    this.preserveOrder = preserveOrder;
  }

  async execute(
    tasks: EnhancedTask[],
    executor: (task: EnhancedTask) => Promise<T>
  ): Promise<ConcurrencyResult<T>[]> {
    const promises: Promise<ConcurrencyResult<T>>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const promise = new Promise<ConcurrencyResult<T>>((resolve, reject) => {
        this.queue.push({
          task: tasks[i],
          index: i,
          resolve,
          reject,
        });
      });

      promises.push(promise);
      // Start processing if we have capacity
      this.processQueue(executor);
    }

    // Wait for all promises to resolve
    const allResults = await Promise.all(promises);

    if (this.preserveOrder) {
      // Sort by original index to maintain order
      return allResults.sort((a, b) => a.index - b.index);
    }

    return allResults;
  }

  private async processQueue(executor: (task: EnhancedTask) => Promise<T>): Promise<void> {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, index, resolve, reject } = this.queue.shift()!;

    try {
      const result = await executor(task);
      const concurrencyResult: ConcurrencyResult<T> = {
        task,
        result,
        index,
      };

      if (this.preserveOrder) {
        this.pendingResults.set(index, concurrencyResult);
        this.drainPending(resolve);
      } else {
        resolve(concurrencyResult);
      }
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.running--;
      this.processQueue(executor);
    }
  }

  private drainPending(resolve: (result: ConcurrencyResult<T>) => void): void {
    while (this.pendingResults.has(this.nextIndex)) {
      const result = this.pendingResults.get(this.nextIndex)!;
      this.pendingResults.delete(this.nextIndex);
      this.nextIndex++;
      resolve(result);
    }
  }

  getStats(): { running: number; queued: number; completed: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      completed: this.nextIndex,
    };
  }
}

// Simplified version that doesn't preserve order for better performance
export async function executeWithConcurrency<T>(
  tasks: EnhancedTask[],
  executor: (task: EnhancedTask) => Promise<T>,
  maxConcurrency: number
): Promise<ConcurrencyResult<T>[]> {
  const pool = new ConcurrencyPool<T>(maxConcurrency, false);
  return pool.execute(tasks, executor);
}

// Order-preserving version
export async function executeWithOrdering<T>(
  tasks: EnhancedTask[],
  executor: (task: EnhancedTask) => Promise<T>,
  maxConcurrency: number
): Promise<ConcurrencyResult<T>[]> {
  const results: ConcurrencyResult<T>[] = new Array(tasks.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const promise = (async (index: number) => {
      try {
        const result = await executor(tasks[index]);
        results[index] = { task: tasks[index], result, index };
      } catch (error) {
        results[index] = {
          task: tasks[index],
          result: error as T,
          index,
        };
        throw error;
      }
    })(i);

    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let j = executing.length - 1; j >= 0; j--) {
        if (await Promise.race([executing[j], Promise.resolve('completed')])) {
          executing.splice(j, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}
