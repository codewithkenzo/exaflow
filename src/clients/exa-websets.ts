import { z } from "zod";
import { httpClient } from "../util/http";
import { createEventStreamer } from "../util/streaming";
import { ResultEnvelope, WebsetTaskSchema, CitationSchema } from "../schema";
import { getEnv } from "../env";

// Websets API schemas
const CreateWebsetRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  settings: z.object({
    maxItems: z.number().int().min(1).max(10000).default(1000),
    maxAge: z.number().int().min(1).default(86400), // 24 hours in seconds
  }).optional(),
});

const WebsetSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "completed", "failed"]),
  createdAt: z.string().datetime(),
  itemCount: z.number(),
  settings: z.object({
    maxItems: z.number(),
    maxAge: z.number(),
  }).optional(),
});

const CreateWebsetSearchRequestSchema = z.object({
  query: z.string(),
  searchType: z.enum(["keyword", "semantic"]).default("semantic"),
  maxResults: z.number().int().min(1).max(1000).default(100),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
});

const WebsetSearchSchema = z.object({
  id: z.string(),
  websetId: z.string(),
  query: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  resultCount: z.number().default(0),
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
  enrichments: z.array(z.object({
    type: z.string(),
    data: z.any(),
    extractedAt: z.string().datetime(),
  })).optional(),
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

export class ExaWebsetsClient {
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.exa.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getApiKey(): string {
    return this.apiKey || getEnv().EXA_API_KEY;
  }

  // Webset management
  async createWebset(
    request: CreateWebsetRequest = {},
    taskId?: string
  ): Promise<ResultEnvelope<z.infer<typeof CreateWebsetResponseSchema>>> {
    const streamer = createEventStreamer(taskId || `webset-create-${Date.now()}`);
    const startTime = Date.now();

    streamer.info("Creating webset", request);

    try {
      const response = await httpClient.post(`${this.baseUrl}/websets`, request, {
        headers: {
          "Authorization": `Bearer ${this.getApiKey()}`,
        },
      });

      const duration = Date.now() - startTime;
      const validatedResponse = CreateWebsetResponseSchema.parse(response);

      const result: ResultEnvelope<z.infer<typeof CreateWebsetResponseSchema>> = {
        status: "success",
        taskId: taskId || `webset-create-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: validatedResponse,
      };

      streamer.completed("webset-create", { websetId: validatedResponse.webset.id });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      streamer.failed(errorMessage, { duration });

      return {
        status: "error",
        taskId: taskId || `webset-create-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: { webset: { id: "", status: "failed" as const, createdAt: new Date().toISOString(), itemCount: 0 } },
        error: {
          code: "WEBSET_CREATE_ERROR",
          message: errorMessage,
        },
      };
    }
  }

  async createWebsetSearch(
    websetId: string,
    request: CreateWebsetSearchRequest,
    taskId?: string
  ): Promise<ResultEnvelope<z.infer<typeof CreateWebsetSearchResponseSchema>>> {
    const streamer = createEventStreamer(taskId || `webset-search-${Date.now()}`);
    const startTime = Date.now();

    streamer.info("Creating webset search", { websetId, ...request });

    try {
      const response = await httpClient.post(
        `${this.baseUrl}/websets/${websetId}/searches`,
        request,
        {
          headers: {
            "Authorization": `Bearer ${this.getApiKey()}`,
          },
        }
      );

      const duration = Date.now() - startTime;
      const validatedResponse = CreateWebsetSearchResponseSchema.parse(response);

      const result: ResultEnvelope<z.infer<typeof CreateWebsetSearchResponseSchema>> = {
        status: "success",
        taskId: taskId || `webset-search-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: validatedResponse,
      };

      streamer.completed("webset-search", { 
        websetId, 
        searchId: validatedResponse.search.id 
      });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      streamer.failed(errorMessage, { duration });

      return {
        status: "error",
        taskId: taskId || `webset-search-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: { search: { id: "", websetId: "", query: "", status: "failed" as const, createdAt: new Date().toISOString(), resultCount: 0 } },
        error: {
          code: "WEBSET_SEARCH_ERROR",
          message: errorMessage,
        },
      };
    }
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
    const streamer = createEventStreamer(taskId || `webset-items-${Date.now()}`);
    const startTime = Date.now();

    const params = new URLSearchParams({
      page: String(options.page || 1),
      pageSize: String(options.pageSize || 50),
    });

    if (options.searchId) {
      params.append("searchId", options.searchId);
    }

    streamer.info("Fetching webset items", { websetId, options });

    try {
      const response = await httpClient.get(
        `${this.baseUrl}/websets/${websetId}/items?${params}`,
        {
          headers: {
            "Authorization": `Bearer ${this.getApiKey()}`,
          },
        }
      );

      const duration = Date.now() - startTime;
      const validatedResponse = ListWebsetItemsResponseSchema.parse(response);

      // Map items to citations with verification reasoning
      const citations = validatedResponse.items.map(item => ({
        url: item.url,
        title: item.title,
        snippet: item.snippet,
        author: item.author,
        publishedDate: item.publishedDate,
        verificationReasoning: item.verificationReasoning,
      }));

      const result: ResultEnvelope<z.infer<typeof ListWebsetItemsResponseSchema>> = {
        status: "success",
        taskId: taskId || `webset-items-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations,
        data: validatedResponse,
      };

      streamer.completed("webset-items", { 
        websetId, 
        itemsCount: validatedResponse.items.length,
        total: validatedResponse.total 
      });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      streamer.failed(errorMessage, { duration });

      return {
        status: "error",
        taskId: taskId || `webset-items-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: { items: [], total: 0, page: 1, pageSize: 50 },
        error: {
          code: "WEBSET_ITEMS_ERROR",
          message: errorMessage,
        },
      };
    }
  }

  async enrichItems(
    websetId: string,
    request: WebsetEnrichmentRequest,
    taskId?: string
  ): Promise<ResultEnvelope<{ message: string }>> {
    const streamer = createEventStreamer(taskId || `webset-enrich-${Date.now()}`);
    const startTime = Date.now();

    streamer.info("Enriching webset items", { websetId, ...request });

    try {
      const response = await httpClient.post(
        `${this.baseUrl}/websets/${websetId}/enrichments`,
        request,
        {
          headers: {
            "Authorization": `Bearer ${this.getApiKey()}`,
          },
        }
      );

      const duration = Date.now() - startTime;

      const result: ResultEnvelope<{ message: string }> = {
        status: "success",
        taskId: taskId || `webset-enrich-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: { message: "Enrichment started successfully" },
      };

      streamer.completed("webset-enrich", { 
        websetId, 
        itemsCount: request.itemIds.length,
        enrichmentTypes: request.enrichmentTypes 
      });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      streamer.failed(errorMessage, { duration });

      return {
        status: "error",
        taskId: taskId || `webset-enrich-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: { message: "" },
        error: {
          code: "WEBSET_ENRICH_ERROR",
          message: errorMessage,
        },
      };
    }
  }

  // Polling methods for async operations
  async pollSearchCompletion(
    websetId: string,
    searchId: string,
    maxWaitTime: number = 300000, // 5 minutes
    pollInterval: number = 5000, // 5 seconds
    taskId?: string
  ): Promise<ResultEnvelope<WebsetSearch>> {
    const streamer = createEventStreamer(taskId || `webset-poll-${Date.now()}`);
    const startTime = Date.now();
    let attempts = 0;

    streamer.asyncStarted("webset-search-poll", maxWaitTime, { websetId, searchId });

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;
      streamer.asyncPolling("webset-search-poll", attempts);

      try {
        const response = await httpClient.get(
          `${this.baseUrl}/websets/${websetId}/searches/${searchId}`,
          {
            headers: {
              "Authorization": `Bearer ${this.getApiKey()}`,
            },
          }
        );

        const search = WebsetSearchSchema.parse(response);

        if (search.status === "completed") {
          const duration = Date.now() - startTime;
          
          const result: ResultEnvelope<WebsetSearch> = {
            status: "success",
            taskId: taskId || `webset-poll-${Date.now()}`,
            timing: {
              startedAt: new Date(startTime).toISOString(),
              completedAt: new Date().toISOString(),
              duration,
            },
            citations: [],
            data: search,
          };

          streamer.asyncCompleted("webset-search-poll", { 
            websetId, 
            searchId, 
            resultCount: search.resultCount,
            attempts 
          });
          return result;

        } else if (search.status === "failed") {
          throw new Error("Search failed");
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        streamer.failed(errorMessage, { duration, attempts });

        return {
          status: "error",
          taskId: taskId || `webset-poll-${Date.now()}`,
          timing: {
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            duration,
          },
          citations: [],
          data: { id: "", websetId: "", query: "", status: "failed" as const, createdAt: new Date().toISOString(), resultCount: 0 },
          error: {
            code: "WEBSET_POLL_ERROR",
            message: errorMessage,
          },
        };
      }
    }

    // Timeout
    const duration = Date.now() - startTime;
    streamer.failed("Polling timeout", { duration, attempts });

    return {
      status: "error",
      taskId: taskId || `webset-poll-${Date.now()}`,
      timing: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        duration,
      },
      citations: [],
      data: { id: "", websetId: "", query: "", status: "failed" as const, createdAt: new Date().toISOString(), resultCount: 0 },
      error: {
        code: "POLLING_TIMEOUT",
        message: `Search polling timed out after ${maxWaitTime}ms`,
      },
    };
  }

  async executeTask(task: z.infer<typeof WebsetTaskSchema>): Promise<ResultEnvelope<any>> {
    const validatedTask = WebsetTaskSchema.parse(task);

    switch (validatedTask.operation) {
      case "create":
        return this.createWebset({}, validatedTask.id);
      
      case "search":
        if (!validatedTask.websetId || !validatedTask.searchQuery) {
          throw new Error("websetId and searchQuery are required for search operation");
        }
        return this.createWebsetSearch(
          validatedTask.websetId,
          {
            query: validatedTask.searchQuery,
            searchType: "semantic" as const,
            maxResults: 100,
          },
          validatedTask.id
        );
      
      case "poll":
        if (!validatedTask.websetId) {
          throw new Error("websetId is required for poll operation");
        }
        // For polling, we'd need to implement listing searches first
        throw new Error("Poll operation requires search ID - implement search listing first");
      
      case "enrich":
        if (!validatedTask.websetId || !validatedTask.enrichmentType) {
          throw new Error("websetId and enrichmentType are required for enrich operation");
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
