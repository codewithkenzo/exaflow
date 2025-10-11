import { z } from "zod";
import { httpClient } from "../util/http";
import { createEventStreamer } from "../util/streaming";
import type { ResultEnvelope } from "../schema";
import { ContentsTaskSchema, CitationSchema } from "../schema";
import { getEnv } from "../env";

// Contents API request/response schemas
const ContentsRequestSchema = z.object({
  ids: z.array(z.string().url()).min(1).max(25),
  text: z.boolean().default(true),
  livecrawl: z.enum(["always", "fallback", "never"]).default("fallback"),
  subpages: z.number().int().min(0).max(20).default(0),
  subpageTarget: z.array(z.string()).default([]),
});

const ContentResultSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  publishedDate: z.string().datetime().optional(),
  author: z.string().optional(),
  text: z.string().optional(),
  extractedAt: z.string().datetime().optional(),
  crawlTime: z.number().optional(),
  subpages: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    text: z.string().optional(),
    extractedAt: z.string().datetime().optional(),
  })).optional(),
});

const ContentsResponseSchema = z.object({
  results: z.array(ContentResultSchema),
  query: z.string().optional(),
});

export type ContentsRequest = z.infer<typeof ContentsRequestSchema>;
export type ContentResult = z.infer<typeof ContentResultSchema>;
export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;

export class ExaContentsClient {
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.exa.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getApiKey(): string {
    return this.apiKey || getEnv().EXA_API_KEY;
  }

  async getContents(
    ids: string[],
    options: {
      livecrawl?: "always" | "fallback" | "never";
      subpages?: number;
      subpageTarget?: string[];
      includeText?: boolean;
    } = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    const streamer = createEventStreamer(taskId || `contents-${Date.now()}`);
    const startTime = Date.now();

    const contentsOptions: ContentsRequest = {
      ids,
      text: options.includeText !== false,
      livecrawl: options.livecrawl || "fallback",
      subpages: options.subpages || 0,
      subpageTarget: options.subpageTarget || [],
    };

    streamer.info("Starting Contents API request", { 
      urlsCount: ids.length, 
      ...contentsOptions 
    });

    try {
      streamer.apiRequest("POST", "/contents", contentsOptions);

      const response = await httpClient.post(`${this.baseUrl}/contents`, contentsOptions, {
        headers: {
          "Authorization": `Bearer ${this.getApiKey()}`,
        },
      });

      const duration = Date.now() - startTime;
      streamer.apiResponse("POST", "/contents", 200, duration);

      const validatedResponse = ContentsResponseSchema.parse(response);
      
      // Map results to citations (including subpages)
      const citations: z.infer<typeof CitationSchema>[] = [];
      
      validatedResponse.results.forEach(result => {
        // Main content citation
        citations.push({
          url: result.url,
          title: result.title,
          author: result.author,
          publishedDate: result.publishedDate,
          snippet: result.text ? result.text.slice(0, 500) + "..." : undefined,
        });

        // Subpage citations
        if (result.subpages) {
          result.subpages.forEach(subpage => {
            citations.push({
              url: subpage.url,
              title: subpage.title,
              snippet: subpage.text ? subpage.text.slice(0, 500) + "..." : undefined,
            });
          });
        }
      });

      const result: ResultEnvelope<ContentsResponse> = {
        status: "success",
        taskId: taskId || `contents-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations,
        data: validatedResponse,
      };

      const totalSubpages = validatedResponse.results.reduce(
        (sum, result) => sum + (result.subpages?.length || 0), 
        0
      );

      streamer.completed("contents", { 
        resultsCount: validatedResponse.results.length,
        totalSubpages,
        citationsCount: citations.length 
      });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      streamer.failed(errorMessage, { duration });

      return {
        status: "error",
        taskId: taskId || `contents-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: null,
        error: {
          code: "CONTENTS_API_ERROR",
          message: errorMessage,
        },
      };
    }
  }

  async executeTask(task: z.infer<typeof ContentsTaskSchema>): Promise<ResultEnvelope<ContentsResponse>> {
    const validatedTask = ContentsTaskSchema.parse(task);
    
    return this.getContents(
      validatedTask.ids,
      {
        livecrawl: validatedTask.livecrawl,
        subpages: validatedTask.subpages,
        subpageTarget: validatedTask.subpageTarget,
        includeText: true,
      },
      validatedTask.id
    );
  }

  // Utility methods for common use cases
  async getSingleContent(
    url: string,
    options: Omit<Parameters<typeof this.getContents>[1], "subpageTarget"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents([url], options, taskId);
  }

  async getContentsWithSubpages(
    urls: string[],
    maxSubpages: number = 3,
    targetSections: string[] = ["about", "news", "blog"],
    options: Omit<Parameters<typeof this.getContents>[1], "subpages" | "subpageTarget"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents(urls, {
      ...options,
      subpages: maxSubpages,
      subpageTarget: targetSections,
    }, taskId);
  }

  async forceLiveCrawl(
    urls: string[],
    options: Omit<Parameters<typeof this.getContents>[1], "livecrawl"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents(urls, { ...options, livecrawl: "always" }, taskId);
  }

  async getCachedContentsOnly(
    urls: string[],
    options: Omit<Parameters<typeof this.getContents>[1], "livecrawl"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents(urls, { ...options, livecrawl: "never" }, taskId);
  }

  // Best practice method for targeted subpage extraction
  async extractTargetedSections(
    urls: string[],
    targetSections: string[],
    maxSubpages: number = 5,
    options: Omit<Parameters<typeof this.getContents>[1], "subpages" | "subpageTarget" | "livecrawl"> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    const streamer = createEventStreamer(taskId || `contents-targeted-${Date.now()}`);
    streamer.info("Extracting targeted sections", { 
      urlsCount: urls.length,
      targetSections,
      maxSubpages 
    });

    return this.getContents(urls, {
      ...options,
      livecrawl: "fallback", // Use fallback for balanced approach
      subpages: maxSubpages,
      subpageTarget: targetSections,
    }, taskId);
  }
}

// Export singleton instance
export const exaContentsClient = new ExaContentsClient();
