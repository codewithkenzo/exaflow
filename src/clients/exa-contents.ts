import { z } from 'zod';
import { BaseExaClient } from './base-client';
import type { ResultEnvelope } from '../schema';
import { ContentsTaskSchema, CitationSchema } from '../schema';

// Contents API request/response schemas
const ContentsRequestSchema = z.object({
  ids: z.array(z.string().url()).min(1).max(25),
  text: z.boolean().default(true),
  livecrawl: z.enum(['always', 'fallback', 'never']).default('fallback'),
  subpages: z.number().int().min(0).max(20).default(0),
  subpageTarget: z.array(z.string()).default([]),
});

const ContentResultSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  publishedDate: z.string().datetime().optional(),
  author: z.string().nullable().optional(),
  text: z.string().optional(),
  extractedAt: z.string().datetime().optional(),
  crawlTime: z.number().optional(),
  subpages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        text: z.string().optional(),
        extractedAt: z.string().datetime().optional(),
      })
    )
    .optional(),
});

const ContentsResponseSchema = z.object({
  results: z.array(ContentResultSchema),
  query: z.string().optional(),
});

export type ContentsRequest = z.infer<typeof ContentsRequestSchema>;
export type ContentResult = z.infer<typeof ContentResultSchema>;
export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;

export class ExaContentsClient extends BaseExaClient {
  constructor(apiKey?: string) {
    super(apiKey);
  }

  async getContents(
    ids: string[],
    options: {
      livecrawl?: 'always' | 'fallback' | 'never';
      subpages?: number;
      subpageTarget?: string[];
      includeText?: boolean;
    } = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    this.requireApiKey('Contents API');

    const actualTaskId = this.getTaskId(taskId, 'contents');
    const streamer = this.createStreamer(actualTaskId, 'contents');
    const startTime = Date.now();

    const contentsOptions: ContentsRequest = {
      ids,
      text: options.includeText !== false,
      livecrawl: options.livecrawl || 'fallback',
      subpages: options.subpages || 0,
      subpageTarget: options.subpageTarget || [],
    };

    streamer.info('Starting Contents API request', {
      urlsCount: ids.length,
      ...contentsOptions,
    });

    // Use base class executeRequest method
    const result = await this.executeRequest(
      'POST',
      '/contents',
      contentsOptions,
      ContentsResponseSchema,
      actualTaskId,
      streamer,
      startTime,
      { useCache: true }, // Contents requests can benefit from caching
      {
        errorCode: 'CONTENTS_API_ERROR',
        errorPrefix: 'Contents API',
        fallbackData: { results: [] },
      }
    );

    // If successful, add citations and log completion
    if (result.status === 'success') {
      // Map results to citations (including subpages)
      const citations: z.infer<typeof CitationSchema>[] = [];

      result.data.results.forEach(resultItem => {
        // Main content citation
        citations.push({
          url: resultItem.url,
          title: resultItem.title,
          author: resultItem.author,
          publishedDate: resultItem.publishedDate,
          snippet: resultItem.text ? resultItem.text.slice(0, 500) + '...' : undefined,
        });

        // Subpage citations
        if (resultItem.subpages) {
          resultItem.subpages.forEach(subpage => {
            citations.push({
              url: subpage.url,
              title: subpage.title,
              snippet: subpage.text ? subpage.text.slice(0, 500) + '...' : undefined,
            });
          });
        }
      });

      const totalSubpages = result.data.results.reduce(
        (sum, resultItem) => sum + (resultItem.subpages?.length || 0),
        0
      );

      streamer.completed('contents', {
        resultsCount: result.data.results.length,
        totalSubpages,
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
    task: z.infer<typeof ContentsTaskSchema>
  ): Promise<ResultEnvelope<ContentsResponse>> {
    const validatedTask = this.validateTask(task, ContentsTaskSchema);

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
    options: Omit<Parameters<typeof this.getContents>[1], 'subpageTarget'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents([url], options, taskId);
  }

  async getContentsWithSubpages(
    urls: string[],
    maxSubpages: number = 3,
    targetSections: string[] = ['about', 'news', 'blog'],
    options: Omit<Parameters<typeof this.getContents>[1], 'subpages' | 'subpageTarget'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents(
      urls,
      {
        ...options,
        subpages: maxSubpages,
        subpageTarget: targetSections,
      },
      taskId
    );
  }

  async forceLiveCrawl(
    urls: string[],
    options: Omit<Parameters<typeof this.getContents>[1], 'livecrawl'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents(urls, { ...options, livecrawl: 'always' }, taskId);
  }

  async getCachedContentsOnly(
    urls: string[],
    options: Omit<Parameters<typeof this.getContents>[1], 'livecrawl'> = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    return this.getContents(urls, { ...options, livecrawl: 'never' }, taskId);
  }

  // Best practice method for targeted subpage extraction
  async extractTargetedSections(
    urls: string[],
    targetSections: string[],
    maxSubpages: number = 5,
    options: Omit<
      Parameters<typeof this.getContents>[1],
      'subpages' | 'subpageTarget' | 'livecrawl'
    > = {},
    taskId?: string
  ): Promise<ResultEnvelope<ContentsResponse>> {
    const actualTaskId = this.getTaskId(taskId, 'contents-targeted');
    const streamer = this.createStreamer(actualTaskId, 'contents');

    streamer.info('Extracting targeted sections', {
      urlsCount: urls.length,
      targetSections,
      maxSubpages,
    });

    return this.getContents(
      urls,
      {
        ...options,
        livecrawl: 'fallback', // Use fallback for balanced approach
        subpages: maxSubpages,
        subpageTarget: targetSections,
      },
      actualTaskId
    );
  }
}

// Export singleton instance
export const exaContentsClient = new ExaContentsClient();
