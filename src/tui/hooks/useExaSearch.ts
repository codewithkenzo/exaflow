import { useState, useCallback } from 'react';
import { runSearchTask } from '../../index.js';
import type { SearchConfig, SearchResult, ContentType } from '../types/index.js';

export function useExaSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentTypeToQuery = (contentType: ContentType): string => {
    switch (contentType) {
      case 'papers':
        return 'site:arxiv.org OR site:semanticscholar.org OR site:researchgate.net';
      case 'blogs':
        return 'site:medium.com OR site:dev.to OR site:substack.com OR blog';
      case 'repos':
        return 'site:github.com OR site:gitlab.com OR code repository';
      case 'profiles':
        return 'site:linkedin.com OR profile OR bio';
      case 'news':
        return 'site:news.google.com OR site:bbc.com OR site:cnn.com OR news';
      case 'knowledge':
        return 'site:wikipedia.org OR site:gov OR educational';
      default:
        return '';
    }
  };

  const transformExaResult = (item: any, index: number): SearchResult => {
    return {
      id: item.id || `result-${index}`,
      title: item.title || 'Untitled',
      url: item.url || '',
      snippet: item.text || item.snippet || '',
      author: item.author || item.publishedDate?.author || undefined,
      publishedDate: item.publishedDate?.publishedDate || undefined,
      score: item.score,
      contentType: determineContentType(item.url, item.title),
      metadata: {
        ...item,
        index,
      },
    };
  };

  const determineContentType = (url: string, title: string): ContentType => {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    if (urlLower.includes('arxiv.org') || urlLower.includes('semanticscholar.org')) {
      return 'papers';
    }
    if (urlLower.includes('github.com') || urlLower.includes('gitlab.com')) {
      return 'repos';
    }
    if (urlLower.includes('linkedin.com')) {
      return 'profiles';
    }
    if (urlLower.includes('wikipedia.org') || urlLower.includes('.gov')) {
      return 'knowledge';
    }
    if (titleLower.includes('blog') || urlLower.includes('medium.com') || urlLower.includes('substack.com')) {
      return 'blogs';
    }
    if (titleLower.includes('news') || urlLower.includes('cnn.com') || urlLower.includes('bbc.com')) {
      return 'news';
    }

    return 'all';
  };

  const search = useCallback(async (query: string, config: SearchConfig) => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Build enhanced query with content type filters
      let enhancedQuery = query;
      const contentTypeFilter = contentTypeToQuery(config.contentType);
      if (contentTypeFilter) {
        enhancedQuery = `${query} (${contentTypeFilter})`;
      }

      const searchParams: any = {
        type: config.mode,
        numResults: config.numResults,
        includeContents: config.includeContents,
        timeout: 30000,
        retries: 3,
        taskId: `tui-search-${Date.now()}`,
      };

      if (config.startDate) {
        searchParams.startDate = config.startDate;
      }

      if (config.endDate) {
        searchParams.endDate = config.endDate;
      }

      const result = await runSearchTask(enhancedQuery, searchParams);

      if (result.status === 'success' && result.data) {
        const data = result.data as any;
        const transformedResults = data.results?.map((item: any, index: number) => 
          transformExaResult(item, index)
        ) || [];

        setResults(transformedResults);
      } else {
        setError(result.error?.message || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clearResults,
  };
}
