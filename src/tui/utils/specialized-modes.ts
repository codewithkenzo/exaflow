import type { SearchConfig } from '../types/index.js';

export interface SpecializedMode {
  id: string;
  name: string;
  description: string;
  defaultConfig: Partial<SearchConfig>;
  queryEnhancer: (query: string, config: SearchConfig) => string;
  coverageLevel: 'Very High' | 'High' | 'Medium' | 'Low';
  icon: string;
}

export const specializedModes: Record<string, SpecializedMode> = {
  research: {
    id: 'research',
    name: 'Research Mode',
    description: 'Academic paper discovery with sophisticated filtering',
    defaultConfig: {
      contentType: 'papers',
      mode: 'neural',
      numResults: 15,
      includeContents: true,
    },
    queryEnhancer: (query: string) => 
      `${query} (site:arxiv.org OR site:semanticscholar.org OR site:researchgate.net OR site:acm.org OR academic paper OR research study OR journal article)`,
    coverageLevel: 'Very High',
    icon: '📚',
  },
  
  professional: {
    id: 'professional',
    name: 'Professional Mode',
    description: 'LinkedIn profile and company research',
    defaultConfig: {
      contentType: 'profiles',
      mode: 'neural',
      numResults: 12,
      includeContents: false,
    },
    queryEnhancer: (query: string) => 
      `${query} (site:linkedin.com OR professional profile OR company OR corporation OR startup OR business)`,
    coverageLevel: 'Very High',
    icon: '💼',
  },
  
  development: {
    id: 'development',
    name: 'Development Mode',
    description: 'GitHub repository and technical content search',
    defaultConfig: {
      contentType: 'repos',
      mode: 'neural',
      numResults: 10,
      includeContents: false,
    },
    queryEnhancer: (query: string) => 
      `${query} (site:github.com OR site:gitlab.com OR code repository OR programming OR development OR software)`,
    coverageLevel: 'High',
    icon: '💻',
  },
  
  knowledge: {
    id: 'knowledge',
    name: 'Knowledge Mode',
    description: 'Wikipedia and knowledge base exploration',
    defaultConfig: {
      contentType: 'knowledge',
      mode: 'neural',
      numResults: 8,
      includeContents: true,
    },
    queryEnhancer: (query: string) => 
      `${query} (site:wikipedia.org OR site:.gov OR site:.edu OR encyclopedia OR knowledge base OR educational resource)`,
    coverageLevel: 'Very High',
    icon: '🧠',
  },
  
  news: {
    id: 'news',
    name: 'News Mode',
    description: 'Current events and news articles',
    defaultConfig: {
      contentType: 'news',
      mode: 'auto',
      numResults: 12,
      includeContents: false,
    },
    queryEnhancer: (query: string) => 
      `${query} (site:news.google.com OR site:bbc.com OR site:cnn.com OR site:reuters.com OR news OR article OR report)`,
    coverageLevel: 'High',
    icon: '📰',
  },
  
  blogs: {
    id: 'blogs',
    name: 'Blogs Mode',
    description: 'Blog posts and technical articles',
    defaultConfig: {
      contentType: 'blogs',
      mode: 'neural',
      numResults: 10,
      includeContents: true,
    },
    queryEnhancer: (query: string) => 
      `${query} (site:medium.com OR site:dev.to OR site:substack.com OR blog OR tutorial OR guide)`,
    coverageLevel: 'High',
    icon: '📝',
  },
};

export function getSpecializedMode(modeId: string): SpecializedMode | null {
  return specializedModes[modeId] || null;
}

export function getAllSpecializedModes(): SpecializedMode[] {
  return Object.values(specializedModes);
}

export function applySpecializedMode(
  query: string, 
  config: SearchConfig, 
  modeId: string
): { enhancedQuery: string; enhancedConfig: SearchConfig } {
  const mode = getSpecializedMode(modeId);
  if (!mode) {
    return { enhancedQuery: query, enhancedConfig: config };
  }

  const enhancedQuery = mode.queryEnhancer(query, config);
  const enhancedConfig = { ...config, ...mode.defaultConfig };

  return { enhancedQuery, enhancedConfig };
}

export function getCoverageColor(level: string): string {
  switch (level) {
    case 'Very High': return 'green';
    case 'High': return 'blue';
    case 'Medium': return 'yellow';
    case 'Low': return 'red';
    default: return 'gray';
  }
}

export function getRecommendedMode(query: string): string {
  const queryLower = query.toLowerCase();
  
  // Research indicators
  if (queryLower.includes('research') || 
      queryLower.includes('paper') || 
      queryLower.includes('study') ||
      queryLower.includes('academic') ||
      queryLower.includes('journal')) {
    return 'research';
  }
  
  // Professional indicators
  if (queryLower.includes('linkedin') || 
      queryLower.includes('company') || 
      queryLower.includes('job') ||
      queryLower.includes('professional') ||
      queryLower.includes('career')) {
    return 'professional';
  }
  
  // Development indicators
  if (queryLower.includes('github') || 
      queryLower.includes('code') || 
      queryLower.includes('programming') ||
      queryLower.includes('repository') ||
      queryLower.includes('software')) {
    return 'development';
  }
  
  // Knowledge indicators
  if (queryLower.includes('wikipedia') || 
      queryLower.includes('explain') || 
      queryLower.includes('what is') ||
      queryLower.includes('definition') ||
      queryLower.includes('encyclopedia')) {
    return 'knowledge';
  }
  
  // News indicators
  if (queryLower.includes('news') || 
      queryLower.includes('breaking') || 
      queryLower.includes('latest') ||
      queryLower.includes('current') ||
      queryLower.includes('recent')) {
    return 'news';
  }
  
  // Blogs indicators
  if (queryLower.includes('tutorial') || 
      queryLower.includes('how to') || 
      queryLower.includes('guide') ||
      queryLower.includes('blog') ||
      queryLower.includes('article')) {
    return 'blogs';
  }
  
  return 'research'; // Default to research mode
}
