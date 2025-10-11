import { z } from "zod";
import { httpClient } from "../util/http";
import { createEventStreamer } from "../util/streaming";
import type { ResultEnvelope } from "../schema";
import { SearchTaskSchema, CitationSchema } from "../schema";
import { getEnv } from "../env";

// Search API request/response schemas
const SearchRequestSchema = z.object({
  query: z.string(),
  type: z.enum(["auto", "keyword", "neural", "fast"]).default("auto"),
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

export class ExaSearchClient {
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.exa.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getApiKey(): string {
    return this.apiKey || getEnv().EXA_API_KEY;
  }

  async search(
    query: string,
    options: {
      type?: "auto" | "keyword" | "neural" | "fast";
      numResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
      startDate?: string;
      endDate?: string;
      includeContents?: boolean;
    } = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("EXA_API_KEY is required for Search API");
    }

    const streamer = createEventStreamer(taskId || `search-${Date.now()}`);
    const startTime = Date.now();

    const searchOptions: SearchRequest = {
      query,
      type: options.type || "auto",
      numResults: options.numResults || 10,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      startPublishedDate: options.startDate || undefined,
      endPublishedDate: options.endDate || undefined,
      text: options.includeContents || false,
    };

    streamer.info("Starting Search API request", { query, ...searchOptions });

    try {
      streamer.apiRequest("POST", "/search", searchOptions);

      const response = await httpClient.post(`${this.baseUrl}/search`, searchOptions, {
        headers: {
          "Authorization": `Bearer ${this.getApiKey()}`,
        },
      });

      const duration = Date.now() - startTime;
      streamer.apiResponse("POST", "/search", 200, duration);

      const validatedResponse = SearchResponseSchema.parse(response);
      
      // Map results to citations
      const citations = validatedResponse.results.map(result => {
        const citation = {
          url: result.url,
          title: result.title,
          author: result.author,
          publishedDate: result.publishedDate,
        };
        
        return CitationSchema.parse(citation);
      });

      const result: ResultEnvelope<SearchResponse> = {
        status: "success",
        taskId: taskId || `search-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations,
        data: validatedResponse,
      };

      streamer.completed("search", { 
        resultsCount: validatedResponse.results.length,
        citationsCount: citations.length 
      });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      streamer.failed(errorMessage, { duration });

      return {
        status: "error",
        taskId: taskId || `search-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: null,
        error: {
          code: "SEARCH_API_ERROR",
          message: errorMessage,
        },
      };
    }
  }

  async executeTask(task: z.infer<typeof SearchTaskSchema>): Promise<ResultEnvelope<SearchResponse>> {
    const validatedTask = SearchTaskSchema.parse(task);
    
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
    options: Omit<Parameters<typeof this.search>[1], "type"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { ...options, type: "neural" }, taskId);
  }

  async keywordSearch(
    query: string,
    options: Omit<Parameters<typeof this.search>[1], "type"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { ...options, type: "keyword" }, taskId);
  }

  async fastSearch(
    query: string,
    options: Omit<Parameters<typeof this.search>[1], "type"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { ...options, type: "fast" }, taskId);
  }

  // Search with date range
  async searchWithDateRange(
    query: string,
    startDate: string,
    endDate: string,
    options: Omit<Parameters<typeof this.search>[1], "startDate" | "endDate"> = {},
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
    options: Omit<Parameters<typeof this.search>[1], "includeDomains" | "excludeDomains"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<SearchResponse>> {
    return this.search(query, { 
      ...options, 
      includeDomains: domains.include, 
      excludeDomains: domains.exclude 
    }, taskId);
  }
}

// Export singleton instance
export const exaSearchClient = new ExaSearchClient();
