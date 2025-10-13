import { describe, it, expect } from "bun:test";
import { z } from "zod";
import {
  CitationSchema,
  EventEnvelopeSchema,
  ResultEnvelopeSchema,
  ContextTaskSchema,
  SearchTaskSchema,
  ContentsTaskSchema,
  WebsetTaskSchema,
  ResearchTaskSchema,
  EnhancedTaskSchema,
  CliOptionsSchema,
} from "../src/schema";

describe("Schema Validation", () => {
  describe("CitationSchema", () => {
    it("should validate a complete citation", () => {
      const citation = {
        url: "https://example.com",
        title: "Example Page",
        snippet: "Example snippet",
        author: "John Doe",
        publishedDate: "2024-01-01T00:00:00Z",
        verificationReasoning: "Verified content",
      };

      const result = CitationSchema.safeParse(citation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe("https://example.com");
        expect(result.data.title).toBe("Example Page");
      }
    });

    it("should validate a minimal citation", () => {
      const citation = {
        url: "https://example.com",
      };

      const result = CitationSchema.safeParse(citation);
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL", () => {
      const citation = {
        url: "not-a-url",
      };

      const result = CitationSchema.safeParse(citation);
      expect(result.success).toBe(false);
    });
  });

  describe("EventEnvelopeSchema", () => {
    it("should validate a complete event envelope", () => {
      const event = {
        level: "info" as const,
        type: "test.event",
        message: "Test message",
        ts: "2024-01-01T00:00:00Z",
        taskId: "test-task-123",
        meta: { key: "value" },
      };

      const result = EventEnvelopeSchema.safeParse(event);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.level).toBe("info");
        expect(result.data.type).toBe("test.event");
        expect(result.data.meta?.key).toBe("value");
      }
    });

    it("should validate an event without meta", () => {
      const event = {
        level: "warn" as const,
        type: "test.warning",
        message: "Test warning",
        ts: "2024-01-01T00:00:00Z",
        taskId: "test-task-456",
      };

      const result = EventEnvelopeSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe("ResultEnvelopeSchema", () => {
    it("should validate a successful result", () => {
      const result = {
        status: "success" as const,
        taskId: "test-task-789",
        timing: {
          startedAt: "2024-01-01T00:00:00Z",
          completedAt: "2024-01-01T00:01:00Z",
          duration: 60000,
        },
        citations: [
          {
            url: "https://example.com",
            title: "Example",
          },
        ],
        data: { result: "test data" },
      };

      const parsedResult = ResultEnvelopeSchema.safeParse(result);
      expect(parsedResult.success).toBe(true);
      if (parsedResult.success) {
        expect(parsedResult.data.status).toBe("success");
        expect(parsedResult.data.citations).toHaveLength(1);
        expect((parsedResult.data.data as any).result).toBe("test data");
      }
    });

    it("should validate an error result", () => {
      const result = {
        status: "error" as const,
        taskId: "test-task-error",
        timing: {
          startedAt: "2024-01-01T00:00:00Z",
          completedAt: "2024-01-01T00:00:05Z",
          duration: 5000,
        },
        citations: [],
        data: null,
        error: {
          code: "TEST_ERROR",
          message: "Test error message",
        },
      };

      const parsedResult = ResultEnvelopeSchema.safeParse(result);
      expect(parsedResult.success).toBe(true);
      if (parsedResult.success) {
        expect(parsedResult.data.status).toBe("error");
        expect(parsedResult.data.error?.code).toBe("TEST_ERROR");
      }
    });
  });

  describe("Task Schemas", () => {
    it("should validate a context task", () => {
      const task = {
        type: "context" as const,
        query: "React hooks examples",
        tokensNum: 5000,
      };

      const result = ContextTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe("React hooks examples");
        expect(result.data.tokensNum).toBe(5000);
      }
    });

    it("should validate a search task", () => {
      const task = {
        type: "search" as const,
        query: "machine learning trends",
        searchType: "neural" as const,
        includeContents: true,
        numResults: 20,
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-12-31T23:59:59Z",
      };

      const result = SearchTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.searchType).toBe("neural");
        expect(result.data.includeContents).toBe(true);
        expect(result.data.numResults).toBe(20);
      }
    });

    it("should validate a contents task", () => {
      const task = {
        type: "contents" as const,
        ids: ["https://example.com", "https://test.com"],
        livecrawl: "always" as const,
        subpages: 5,
        subpageTarget: ["about", "news"],
      };

      const result = ContentsTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ids).toHaveLength(2);
        expect(result.data.livecrawl).toBe("always");
        expect(result.data.subpages).toBe(5);
      }
    });

    it("should validate a websets task", () => {
      const task = {
        type: "websets" as const,
        operation: "create" as const,
        websetId: "webset-123",
        searchQuery: "AI research papers",
        useWebhook: true,
      };

      const result = WebsetTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.operation).toBe("create");
        expect(result.data.useWebhook).toBe(true);
      }
    });

    it("should validate a research task", () => {
      const task = {
        type: "research" as const,
        operation: "create" as const,
        instructions: "Research the latest AI trends",
        model: "exa-research-pro" as const,
        outputSchema: { type: "object", properties: { summary: { type: "string" } } },
      };

      const result = ResearchTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe("exa-research-pro");
        expect(result.data.outputSchema).toBeDefined();
      }
    });
  });

  describe("Enhanced Task Schema", () => {
    it("should validate an enhanced task with metadata", () => {
      const task = {
        type: "context" as const,
        query: "TypeScript patterns",
        tokensNum: 3000,
        timeout: 60000,
        retries: 5,
        id: "custom-task-id",
      };

      const result = EnhancedTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(60000);
        expect(result.data.retries).toBe(5);
        expect(result.data.id).toBe("custom-task-id");
      }
    });
  });

  describe("CLI Options Schema", () => {
    it("should validate complete CLI options", () => {
      const options = {
        mode: "search" as const,
        query: "test query",
        concurrency: 10,
        timeout: 120000,
        type: "neural" as const,
        tokens: 10000,
        ids: ["https://example.com"],
        livecrawl: "always" as const,
        subpages: 3,
        subpageTarget: ["about", "contact"],
        model: "exa-research-pro" as const,
        poll: true,
        webhook: false,
      };

      const result = CliOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe("search");
        expect(result.data.concurrency).toBe(10);
        expect(result.data.type).toBe("neural");
      }
    });

    it("should validate minimal CLI options", () => {
      const options = {
        mode: "context" as const,
        query: "simple query",
      };

      const result = CliOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.concurrency).toBe(5); // default
        expect(result.data.timeout).toBe(30000); // default
      }
    });
  });
});

describe("Schema Integration", () => {
  it("should create valid event envelopes", () => {
    const streamer = {
      info: (message: string, meta?: any) => {
        const event = {
          level: "info" as const,
          type: "test.info",
          message,
          ts: new Date().toISOString(),
          taskId: "integration-test",
          meta,
        };

        const result = EventEnvelopeSchema.safeParse(event);
        expect(result.success).toBe(true);
      },
    };

    streamer.info("Integration test message", { test: true });
  });

  it("should handle schema validation errors gracefully", () => {
    const invalidCitation = {
      url: "invalid-url",
      title: 123, // wrong type
    };

    const result = CitationSchema.safeParse(invalidCitation);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors).toHaveLength(2);
      expect(result.error.errors[0].path).toContain("url");
      expect(result.error.errors[1].path).toContain("title");
    }
  });
});
