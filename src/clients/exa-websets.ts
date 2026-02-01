import { z } from 'zod';
import { BaseExaClient } from './base-client';
import type { ResultEnvelope } from '../schema';
import { WebsetTaskSchema, CitationSchema } from '../schema';

// Websets API schemas
const CreateWebsetRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  settings: z
    .object({
      maxItems: z.number().int().min(1).max(10000).default(1000),
      maxAge: z.number().int().min(1).default(86400), // 24 hours in seconds
    })
    .optional(),
});

const WebsetSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'failed']),
  createdAt: z.string().datetime(),
  itemCount: z.number(),
  settings: z
    .object({
      maxItems: z.number(),
      maxAge: z.number(),
    })
    .optional(),
});

const CreateWebsetSearchRequestSchema = z.object({
  query: z.string(),
  searchType: z.enum(['keyword', 'semantic']).default('semantic'),
  maxResults: z.number().int().min(1).max(1000).default(100),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
});

const WebsetSearchSchema = z.object({
  id: z.string(),
  websetId: z.string(),
  query: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  resultCount: z.number().optional(),
});

const WebsetItemSchema = z.object({
  id: z.string(),
  websetId: z.string(),
  searchId: z.string(),
  url: z.string().url(),
  title: z.string(),
  snippet: z.string().optional(),
  publishedDate: z.string().datetime().optional(),
  author: z.string().optional(),
  verificationReasoning: z.string().optional(),
  relevanceScore: z.number().optional(),
  extractedAt: z.string().datetime(),
  enrichments: z
    .array(
      z.object({
        type: z.string(),
        data: z.any(),
        extractedAt: z.string().datetime(),
      })
    )
    .optional(),
});

const WebsetEnrichmentRequestSchema = z.object({
  itemIds: z.array(z.string()),
  enrichmentTypes: z.array(z.string()),
  webhookUrl: z.string().url().optional(),
});

const CreateWebsetResponseSchema = z.object({
  webset: WebsetSchema,
});

const CreateWebsetSearchResponseSchema = z.object({
  search: WebsetSearchSchema,
});

const ListWebsetItemsResponseSchema = z.object({
  items: z.array(WebsetItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type CreateWebsetRequest = z.infer<typeof CreateWebsetRequestSchema>;
export type Webset = z.infer<typeof WebsetSchema>;
export type CreateWebsetSearchRequest = z.infer<typeof CreateWebsetSearchRequestSchema>;
export type WebsetSearch = z.infer<typeof WebsetSearchSchema>;
export type WebsetItem = z.infer<typeof WebsetItemSchema>;
export type WebsetEnrichmentRequest = z.infer<typeof WebsetEnrichmentRequestSchema>;

export class ExaWebsetsClient extends BaseExaClient {
  constructor(apiKey?: string) {
    super(apiKey);
  }

  // Webset management
  async createWebset(
    request: CreateWebsetRequest = {},
    taskId?: string
  ): Promise<ResultEnvelope<z.infer<typeof CreateWebsetResponseSchema>>> {
    this.requireApiKey('Websets API');

    const actualTaskId = this.getTaskId(taskId, 'webset-create');
    const streamer = this.createStreamer(actualTaskId, 'websets');
    const startTime = Date.now();

    streamer.info('Creating webset', request);

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'POST',
      '/websets/v0/websets',
      request,
      CreateWebsetResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: false }, // Create requests should not be cached
      {
        errorCode: 'WEBSET_CREATE_ERROR',
        errorPrefix: 'Websets Create API',
        fallbackData: {
          webset: {
            id: '',
            status: 'failed' as const,
            createdAt: new Date().toISOString(),
            itemCount: 0,
          },
        },
      }
    );

    // If successful, log completion with specific details
    if (result.status === 'success') {
      streamer.completed('webset-create', { websetId: result.data.webset.id });
    }

    // Return result as-is (base class already handles error formatting)
    return result;
  }

  async createWebsetSearch(
    websetId: string,
    request: CreateWebsetSearchRequest,
    taskId?: string
  ): Promise<ResultEnvelope<z.infer<typeof CreateWebsetSearchResponseSchema>>> {
    this.requireApiKey('Websets API');

    const actualTaskId = this.getTaskId(taskId, 'webset-search');
    const streamer = this.createStreamer(actualTaskId, 'websets');
    const startTime = Date.now();

    streamer.info('Creating webset search', { websetId, ...request });

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'POST',
      `/websets/v0/websets/${websetId}/searches`,
      request,
      CreateWebsetSearchResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: false }, // Search requests should not be cached
      {
        errorCode: 'WEBSET_SEARCH_ERROR',
        errorPrefix: 'Websets Search API',
        fallbackData: {
          search: {
            id: '',
            websetId: '',
            query: '',
            status: 'failed' as const,
            createdAt: new Date().toISOString(),
            resultCount: 0,
          },
        },
      }
    );

    // If successful, log completion with specific details
    if (result.status === 'success') {
      streamer.completed('webset-search', {
        websetId,
        searchId: result.data.search.id,
      });
    }

    // Return result as-is (base class already handles error formatting)
    return result;
  }

  async getWebsetItems(
    websetId: string,
    options: {
      page?: number;
      pageSize?: number;
      searchId?: string;
    } = {},
    taskId?: string
  ): Promise<ResultEnvelope<z.infer<typeof ListWebsetItemsResponseSchema>>> {
    this.requireApiKey('Websets API');

    const actualTaskId = this.getTaskId(taskId, 'webset-items');
    const streamer = this.createStreamer(actualTaskId, 'websets');
    const startTime = Date.now();

    const params = new URLSearchParams({
      page: String(options.page || 1),
      pageSize: String(options.pageSize || 50),
    });

    if (options.searchId) {
      params.append('searchId', options.searchId);
    }

    streamer.info('Fetching webset items', { websetId, options });

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'GET',
      `/websets/v0/websets/${websetId}/items?${params}`,
      null,
      ListWebsetItemsResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: true }, // Get requests can benefit from caching
      {
        errorCode: 'WEBSET_ITEMS_ERROR',
        errorPrefix: 'Websets Items API',
        fallbackData: { items: [], total: 0, page: 1, pageSize: 50 },
      }
    );

    // If successful, create citations with verification reasoning and log completion
    if (result.status === 'success') {
      // Map items to citations with verification reasoning
      const citations = result.data.items.map(item => ({
        url: item.url,
        title: item.title,
        snippet: item.snippet,
        author: item.author,
        publishedDate: item.publishedDate,
        verificationReasoning: item.verificationReasoning,
      }));

      streamer.completed('webset-items', {
        websetId,
        itemsCount: result.data.items.length,
        total: result.data.total,
      });

      // Return result with citations
      return {
        ...result,
        citations,
      };
    }

    // Return error result as-is (base class already handles error formatting)
    return result;
  }

  async enrichItems(
    websetId: string,
    request: WebsetEnrichmentRequest,
    taskId?: string
  ): Promise<ResultEnvelope<{ message: string }>> {
    this.requireApiKey('Websets API');

    const actualTaskId = this.getTaskId(taskId, 'webset-enrich');
    const streamer = this.createStreamer(actualTaskId, 'websets');
    const startTime = Date.now();

    streamer.info('Enriching webset items', { websetId, ...request });

    // Define the response schema
    const EnrichResponseSchema = z.object({ message: z.string() });

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'POST',
      `/websets/v0/websets/${websetId}/enrichments`,
      request,
      EnrichResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: false }, // Enrichment requests should not be cached
      {
        errorCode: 'WEBSET_ENRICH_ERROR',
        errorPrefix: 'Websets Enrichment API',
        fallbackData: { message: 'Failed to start enrichment' },
      }
    );

    // If successful, log completion with specific details
    if (result.status === 'success') {
      streamer.completed('webset-enrich', {
        websetId,
        itemsCount: request.itemIds.length,
        enrichmentTypes: request.enrichmentTypes,
      });
    }

    // Return result as-is (base class already handles error formatting)
    return result;
  }

  // Polling methods for async operations using base class pollForCompletion
  async pollSearchCompletion(
    websetId: string,
    searchId: string,
    maxWaitTime: number = 300000, // 5 minutes
    pollInterval: number = 5000, // 5 seconds
    taskId?: string
  ): Promise<ResultEnvelope<WebsetSearch>> {
    this.requireApiKey('Websets API');

    const actualTaskId = this.getTaskId(taskId, 'webset-poll');
    const streamer = this.createStreamer(actualTaskId, 'websets');
    const startTime = Date.now();

    // Use base class pollForCompletion method
    return this.pollForCompletion(
      // Poll function
      async () => {
        // Use base class executeRequest to get search status
        const result = await this.executeRequest(
          'GET',
          `/websets/v0/websets/${websetId}/searches/${searchId}`,
          null,
          WebsetSearchSchema,
          actualTaskId,
          streamer,
          startTime,
          { useCache: true }, // Status checks can benefit from caching
          {
            errorCode: 'WEBSET_SEARCH_STATUS_ERROR',
            errorPrefix: 'Websets Search Status API',
            fallbackData: {
              id: '',
              websetId: '',
              query: '',
              status: 'failed' as const,
              createdAt: new Date().toISOString(),
              resultCount: 0,
            },
          }
        );

        if (result.status === 'error' || !result.data) {
          throw new Error(result.error?.message || 'Failed to get search status');
        }

        const search = result.data;

        if (search.status === 'completed') {
          return { status: 'completed', data: search };
        } else if (search.status === 'failed') {
          return {
            status: 'failed',
            error: 'Search operation failed',
            data: search,
          };
        }

        return { status: search.status };
      },
      // Completion check
      status => status === 'completed',
      // Failure check
      status => status === 'failed',
      actualTaskId,
      streamer,
      startTime,
      maxWaitTime,
      pollInterval,
      'webset-search-completion-poll'
    );
  }

  async executeTask(task: z.infer<typeof WebsetTaskSchema>): Promise<ResultEnvelope<any>> {
    const validatedTask = this.validateTask(task, WebsetTaskSchema);

    switch (validatedTask.operation) {
      case 'create':
        return this.createWebset({}, validatedTask.id);

      case 'search':
        if (!validatedTask.websetId || !validatedTask.searchQuery) {
          throw new Error('websetId and searchQuery are required for search operation');
        }
        return this.createWebsetSearch(
          validatedTask.websetId,
          {
            query: validatedTask.searchQuery,
            searchType: 'semantic' as const,
            maxResults: 100,
          },
          validatedTask.id
        );

      case 'poll':
        if (!validatedTask.websetId) {
          throw new Error('websetId is required for poll operation');
        }
        // For polling, we'd need to implement listing searches first
        throw new Error('Poll operation requires search ID - implement search listing first');

      case 'enrich':
        if (!validatedTask.websetId || !validatedTask.enrichmentType) {
          throw new Error('websetId and enrichmentType are required for enrich operation');
        }
        return this.enrichItems(
          validatedTask.websetId,
          {
            itemIds: [], // Would need to get items first
            enrichmentTypes: [validatedTask.enrichmentType],
          },
          validatedTask.id
        );

      default:
        throw new Error(`Unknown operation: ${validatedTask.operation}`);
    }
  }
}

// Export singleton instance
export const exaWebsetsClient = new ExaWebsetsClient();
