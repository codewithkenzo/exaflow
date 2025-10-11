export type SearchMode = 'auto' | 'keyword' | 'neural' | 'fast';

export type ContentType = 'all' | 'papers' | 'blogs' | 'repos' | 'profiles' | 'news' | 'knowledge';

export type SearchConfig = {
  mode: SearchMode;
  numResults: number;
  includeContents: boolean;
  startDate?: string;
  endDate?: string;
  contentType: ContentType;
  language: string;
  userLocation?: string;
};

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  author?: string;
  publishedDate?: string;
  score?: number;
  contentType: ContentType;
  metadata?: Record<string, any>;
};

export type SearchSession = {
  id: string;
  name: string;
  queries: string[];
  results: SearchResult[];
  config: SearchConfig;
  createdAt: string;
  updatedAt: string;
};

export type ExportFormat = 'json' | 'csv' | 'bibtex' | 'markdown';

export type ExportOptions = {
  format: ExportFormat;
  includeMetadata: boolean;
  includeContents: boolean;
};
