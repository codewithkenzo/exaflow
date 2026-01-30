import { z } from 'zod';

// Base citation schema
export const CitationSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  author: z.string().nullable().optional(),
  publishedDate: z.string().nullable().optional(),
  verificationReasoning: z.string().optional(),
});

// Event envelope for JSONL streaming
export const EventEnvelopeSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  type: z.string(),
  message: z.string(),
  ts: z.string().datetime(),
  taskId: z.string(),
  meta: z.optional(z.record(z.unknown())),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

// Result envelope with citations
export const ResultEnvelopeSchema = z.object({
  status: z.enum(['success', 'partial', 'error']),
  taskId: z.string(),
  timing: z.object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    duration: z.number().nonnegative(),
  }),
  citations: z.array(CitationSchema),
  data: z.unknown(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.optional(z.record(z.unknown())),
    })
    .optional(),
});

export type ResultEnvelope<T = unknown> = z.infer<typeof ResultEnvelopeSchema> & {
  data: T;
};

// Input task schemas
export const ContextTaskSchema = z.object({
  type: z.literal('context'),
  query: z.string().min(1),
  tokensNum: z.number().int().min(100).max(50000).default(5000),
  id: z.string().optional(),
});

export const SearchTaskSchema = z.object({
  type: z.literal('search'),
  query: z.string().min(1),
  searchType: z.enum(['auto', 'keyword', 'neural', 'fast']).default('auto'),
  includeContents: z.boolean().default(false),
  numResults: z.number().int().min(1).max(50).default(10),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  id: z.string().optional(),
});

export const ContentsTaskSchema = z.object({
  type: z.literal('contents'),
  ids: z.array(z.string().url()).min(1),
  livecrawl: z.enum(['always', 'fallback', 'never']).default('fallback'),
  subpages: z.number().int().min(0).max(20).default(0),
  subpageTarget: z.array(z.string()).default([]),
  id: z.string().optional(),
});

export const WebsetTaskSchema = z.object({
  type: z.literal('websets'),
  operation: z.enum(['create', 'search', 'poll', 'enrich']),
  websetId: z.string().optional(),
  searchQuery: z.string().optional(),
  enrichmentType: z.string().optional(),
  useWebhook: z.boolean().default(false),
  id: z.string().optional(),
});

export const ResearchTaskSchema = z.object({
  type: z.literal('research'),
  operation: z.enum(['create', 'get', 'list']),
  instructions: z.string().optional(),
  model: z.enum(['exa-research', 'exa-research-pro']).default('exa-research'),
  outputSchema: z.optional(z.record(z.unknown())),
  taskId: z.string().optional(),
});

// Union of all task types
export const InputTaskSchema = z.discriminatedUnion('type', [
  ContextTaskSchema,
  SearchTaskSchema,
  ContentsTaskSchema,
  WebsetTaskSchema,
  ResearchTaskSchema,
]);

export type InputTask = z.infer<typeof InputTaskSchema>;

// Shared task metadata
export const TaskMetadataSchema = z.object({
  timeout: z.number().int().min(1000).max(300000).default(30000),
  retries: z.number().int().min(0).max(10).default(3),
  id: z.string().optional(),
});

export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;

// CLI input options
export const CliOptionsSchema = z.object({
  mode: z.enum(['context', 'search', 'contents', 'websets', 'research']),
  query: z.string().optional(),
  input: z.string().optional(),
  stdin: z.boolean().default(false),
  concurrency: z.number().int().min(1).max(20).default(5),
  timeout: z.number().int().min(1000).max(300000).default(30000),
  type: z.enum(['auto', 'keyword', 'neural', 'fast']).optional(),
  tokens: z.number().int().min(100).max(50000).optional(),
  ids: z.array(z.string().url()).optional(),
  livecrawl: z.enum(['always', 'fallback', 'never']).optional(),
  subpages: z.number().int().min(0).max(20).optional(),
  subpageTarget: z.array(z.string()).optional(),
  model: z.enum(['exa-research', 'exa-research-pro']).optional(),
  poll: z.boolean().default(false),
  webhook: z.boolean().default(false),
});

export type CliOptions = z.infer<typeof CliOptionsSchema>;

// Enhanced task with metadata
export const EnhancedTaskSchema = InputTaskSchema.and(TaskMetadataSchema);
export type EnhancedTask = z.infer<typeof EnhancedTaskSchema>;

// Batch input schema
export const BatchInputSchema = z.object({
  tasks: z.array(EnhancedTaskSchema).min(1),
  preserveOrder: z.boolean().default(true),
});

export type BatchInput = z.infer<typeof BatchInputSchema>;
