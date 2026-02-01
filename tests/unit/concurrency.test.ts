import { describe, it, expect, beforeEach } from 'bun:test';
import { ConcurrencyPool } from '../../src/util/concurrency';
import type { EnhancedTask } from '../../src/schema';

describe('ConcurrencyPool', () => {
  let pool: ConcurrencyPool<string>;

  beforeEach(() => {
    pool = new ConcurrencyPool<string>(2);
  });

  describe('initial state', () => {
    it('should have correct max concurrency', () => {
      expect((pool as any).maxConcurrency).toBe(2);
    });

    it('should have zero running', () => {
      expect((pool as any).running).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute simple tasks', async () => {
      const tasks: EnhancedTask[] = [
        { id: '1', type: 'search', input: { query: 'a' }, config: {} },
        { id: '2', type: 'search', input: { query: 'b' }, config: {} },
        { id: '3', type: 'search', input: { query: 'c' }, config: {} },
      ];
      const results = await pool.execute(tasks, async (task) => task.input.query.toUpperCase());
      expect(results.length).toBe(3);
      expect(results[0].result).toBe('A');
      expect(results[1].result).toBe('B');
      expect(results[2].result).toBe('C');
    });

    it('should track stats', async () => {
      const stats = pool.getStats();
      expect(stats).toBeDefined();
    });
  });
});
