import { z } from 'zod';
import { BaseExaClient } from './base-client';
import type { ResultEnvelope } from '../schema';
import { SearchTaskSchema, CitationSchema } from '../schema';

// Search API request/response schemas
const SearchRequestSchema = z.object({
  query: z.string(),
  type: z.enum(['auto', 'keyword', 'neural', 'fast']).default('auto'),
  numResults: z.number().int().min(1).max(50).default(10),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  startCrawlDate: z.string().datetime().optional(),
  endCrawlDate: z.string().datetime().optional(),
  startPublishedDate: z.string().datetime().optional(),
  endPublishedDate: z.string().datetime().optional(),
  text: z.boolean().default(false),
});

const SearchResultSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  publishedDate: z.string().datetime().nullable().optional(),
  author: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  highlights: z.array(z.string()).nullable().optional(),
});

const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  totalResults: z.number().nullable().optional(),
  query: z.string().nullable().optional(),
  searchType: z.string().nullable().optional(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export class ExaSearchClient extends BaseExaClient {
  constructor(apiKey?: string) {
    super(apiKey);
  }

  async search(
    query: string,
    options: {
      type?: 'auto' | 'keyword' | 'neural' | 'fast';
      numResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
      startDate?: string;
      endDate?: string;
      includeContents?: boolean;
    } = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    this.requireApiKey('Search API');

    const actualTaskId = this.getTaskId(taskId, 'search');
    const streamer = this.createStreamer(actualTaskId, 'search');
    const startTime = Date.now();

    const searchOptions: SearchRequest = {
      query,
      type: options.type || 'auto',
      numResults: options.numResults || 10,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      startPublishedDate: options.startDate || undefined,
      endPublishedDate: options.endDate || undefined,
      text: options.includeContents || false,
    };

    streamer.info('Starting Search API request', searchOptions);

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'POST',
      '/search',
      searchOptions,
      SearchResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: false }, // Search requests should not be cached
      {
        errorCode: 'SEARCH_API_ERROR',
        errorPrefix: 'Search API',
        fallbackData: { results: [], query: '' },
      }
    );

    // If successful, add citations and log completion
    if (result.status === 'success') {
      // Map results to citations
      const citations = result.data.results.map(resultItem => {
        const citation = {
          url: resultItem.url,
          title: resultItem.title,
          author: resultItem.author,
          publishedDate: resultItem.publishedDate,
        };

        return CitationSchema.parse(citation);
      });

      streamer.completed('search', {
        resultsCount: result.data.results.length,
        citationsCount: citations.length,
      });

      // Return result with citations
      return {
        ...result,
        citations,
      };
    }

    // Return error result as-is
    return result;
  }

  async executeTask(
    task: z.infer<typeof SearchTaskSchema>
  ): Promise<ResultEnvelope<SearchResponse>> {
    const validatedTask = this.validateTask(task, SearchTaskSchema);

    return this.search(
      validatedTask.query,
      {
        type: validatedTask.searchType,
        numResults: validatedTask.numResults,
        startDate: validatedTask.startDate,
        endDate: validatedTask.endDate,
        includeContents: validatedTask.includeContents,
      },
      validatedTask.id
    );
  }

  // Utility methods for different search types
  async neuralSearch(
    query: string,
    options: Omit<Parameters<typeof this.search>[1], 'type'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { ...options, type: 'neural' }, taskId);
  }

  async keywordSearch(
    query: string,
    options: Omit<Parameters<typeof this.search>[1], 'type'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { ...options, type: 'keyword' }, taskId);
  }

  async fastSearch(
    query: string,
    options: Omit<Parameters<typeof this.search>[1], 'type'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { ...options, type: 'fast' }, taskId);
  }

  // Search with date range
  async searchWithDateRange(
    query: string,
    startDate: string,
    endDate: string,
    options: Omit<Parameters<typeof this.search>[1], 'startDate' | 'endDate'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { ...options, startDate, endDate }, taskId);
  }

  // Search with domain filtering
  async searchDomains(
    query: string,
    domains: {
      include?: string[];
      exclude?: string[];
    },
    options: Omit<Parameters<typeof this.search>[1], 'includeDomains' | 'excludeDomains'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(
      query,
      {
        ...options,
        includeDomains: domains.include,
        excludeDomains: domains.exclude,
      },
      taskId
    );
  }
}

// Export singleton instance
export const exaSearchClient = new ExaSearchClient();
