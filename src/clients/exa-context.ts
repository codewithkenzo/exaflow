import { z } from "zod";
import { httpClient } from "../util/http";
import { createEventStreamer } from "../util/streaming";
import type { ResultEnvelope } from "../schema";
import { ContextTaskSchema } from "../schema";
import { getEnv } from "../env";

// Context API response schemas
const ContextResponseSchema = z.object({
  response: z.string(),
  metadata: z.object({
    query: z.string(),
    tokensNum: z.number(),
    model: z.string(),
    sources: z.array(z.object({
      url: z.string().url(),
      title: z.string(),
      snippet: z.string(),
    })).optional(),
  }).optional(),
});

export type ContextResponse = z.infer<typeof ContextResponseSchema>;

export class ExaContextClient {
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.exa.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getApiKey(): string {
    return this.apiKey || getEnv().EXA_API_KEY;
  }

  async getContext(
    query: string,
    tokensNum: number = 5000,
    taskId?: string
  ): Promise<ResultEnvelope<ContextResponse>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("EXA_API_KEY is required for Context API");
    }
    const streamer = createEventStreamer(taskId || `context-${Date.now()}`);
    const startTime = Date.now();

    streamer.info("Starting Context API request", { query, tokensNum });

    try {
      streamer.apiRequest("POST", "/context", { query, tokensNum });

      const response = await httpClient.post(`${this.baseUrl}/context`, {
        query,
        tokensNum,
      }, {
        headers: {
          "Authorization": `Bearer ${this.getApiKey()}`,
        },
      });

      const duration = Date.now() - startTime;
      streamer.apiResponse("POST", "/context", 200, duration);

      const validatedResponse = ContextResponseSchema.parse(response);
      
      // Map sources to citations
      const citations = (validatedResponse.metadata?.sources || []).map(source => ({
        url: source.url,
        title: source.title,
        snippet: source.snippet,
      }));

      const result: ResultEnvelope<ContextResponse> = {
        status: "success",
        taskId: taskId || `context-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations,
        data: validatedResponse,
      };

      streamer.completed("context", { citationsCount: citations.length });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      streamer.failed(errorMessage, { duration });

      return {
        status: "error",
        taskId: taskId || `context-${Date.now()}`,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
        },
        citations: [],
        data: undefined,
        error: {
          code: "CONTEXT_API_ERROR",
          message: errorMessage,
        },
      };
    }
  }

  async executeTask(task: z.infer<typeof ContextTaskSchema>): Promise<ResultEnvelope<ContextResponse>> {
    const validatedTask = ContextTaskSchema.parse(task);
    return this.getContext(
      validatedTask.query,
      validatedTask.tokensNum,
      validatedTask.id || `context-${Date.now()}`
    );
  }

  // Utility method for simple context queries
  async query(
    query: string,
    options: {
      tokens?: number;
      taskId?: string;
    } = {}
  ): Promise<ResultEnvelope<ContextResponse>> {
    return this.getContext(
      query,
      options.tokens || 5000,
      options.taskId
    );
  }
}

// Export singleton instance
export const exaContextClient = new ExaContextClient();
