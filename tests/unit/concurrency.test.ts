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
      const results = await pool.execute(['a', 'b', 'c'], async (item) => item.toUpperCase());
      expect(results.length).toBe(3);
    });

    it('should track stats', async () => {
      const stats = pool.getStats();
      expect(stats).toBeDefined();
    });
  });
});
