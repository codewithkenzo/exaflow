import { describe, it, expect, beforeEach } from 'bun:test';
import { z } from 'zod';
import { ExaSearchClient } from '../../src/clients/exa-search';
import { SearchTaskSchema } from '../../src/schema';

describe('ExaSearchClient', () => {
  describe('constructor', () => {
    it('should initialize with API key', () => {
      const client = new ExaSearchClient('test-key');
      expect(client).toBeDefined();
    });
  });

  describe('search', () => {
    it('should create valid search params', () => {
      const client = new ExaSearchClient('test-key');
      const params = {
        type: 'search' as const,
        query: 'test',
        searchType: 'neural' as const,
        includeContents: false,
        numResults: 5,
      };
      const result = SearchTaskSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  describe('neuralSearch', () => {
    it('should create neural search params', () => {
      const client = new ExaSearchClient('test-key');
      const params = {
        type: 'search' as const,
        query: 'test',
        searchType: 'neural' as const,
        includeContents: true,
        numResults: 10,
      };
      const result = SearchTaskSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });
});
