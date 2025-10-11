import type { SearchSession, SearchResult, SearchConfig } from '../types/index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class SessionManager {
  private sessionDir: string;
  private sessionsFile: string;

  constructor() {
    this.sessionDir = join(homedir(), '.exaflow', 'sessions');
    this.sessionsFile = join(this.sessionDir, 'sessions.json');
    
    // Ensure directory exists
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  saveSession(session: SearchSession): void {
    const sessions = this.loadAllSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2));
  }

  loadSession(sessionId: string): SearchSession | null {
    const sessions = this.loadAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  loadAllSessions(): SearchSession[] {
    if (!existsSync(this.sessionsFile)) {
      return [];
    }

    try {
      const data = readFileSync(this.sessionsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  deleteSession(sessionId: string): boolean {
    const sessions = this.loadAllSessions();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    
    if (filteredSessions.length !== sessions.length) {
      writeFileSync(this.sessionsFile, JSON.stringify(filteredSessions, null, 2));
      return true;
    }
    
    return false;
  }

  createSession(
    name: string, 
    query: string, 
    results: SearchResult[], 
    config: SearchConfig
  ): SearchSession {
    const session: SearchSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      queries: [query],
      results: [...results],
      config: { ...config },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveSession(session);
    return session;
  }

  updateSession(
    sessionId: string, 
    query: string, 
    results: SearchResult[], 
    config: SearchConfig
  ): SearchSession | null {
    const session = this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    session.queries.push(query);
    session.results = [...session.results, ...results];
    session.config = { ...config };
    session.updatedAt = new Date().toISOString();

    this.saveSession(session);
    return session;
  }

  getRecentSessions(limit: number = 10): SearchSession[] {
    const sessions = this.loadAllSessions();
    return sessions
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  searchSessions(searchTerm: string): SearchSession[] {
    const sessions = this.loadAllSessions();
    const term = searchTerm.toLowerCase();
    
    return sessions.filter(session => 
      session.name.toLowerCase().includes(term) ||
      session.queries.some(q => q.toLowerCase().includes(term)) ||
      session.results.some(r => 
        r.title.toLowerCase().includes(term) ||
        r.snippet?.toLowerCase().includes(term)
      )
    );
  }

  exportSession(sessionId: string, format: 'json' | 'csv' | 'markdown'): string | null {
    const session = this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);
      
      case 'csv':
        const csvHeaders = 'Title,URL,Author,Published Date,Snippet,Score\n';
        const csvRows = session.results.map(result => 
          `"${result.title}","${result.url}","${result.author || ''}","${result.publishedDate || ''}","${result.snippet || ''}","${result.score || ''}"`
        ).join('\n');
        return csvHeaders + csvRows;
      
      case 'markdown':
        let markdown = `# ${session.name}\n\n`;
        markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
        markdown += `**Updated:** ${new Date(session.updatedAt).toLocaleString()}\n`;
        markdown += `**Queries:** ${session.queries.length}\n`;
        markdown += `**Results:** ${session.results.length}\n\n`;
        
        markdown += '## Search Queries\n\n';
        session.queries.forEach((query, index) => {
          markdown += `${index + 1}. ${query}\n`;
        });
        
        markdown += '\n## Search Results\n\n';
        session.results.forEach((result, index) => {
          markdown += `### ${index + 1}. ${result.title}\n\n`;
          markdown += `**URL:** ${result.url}\n`;
          if (result.author) markdown += `**Author:** ${result.author}\n`;
          if (result.publishedDate) markdown += `**Published:** ${new Date(result.publishedDate).toLocaleDateString()}\n`;
          if (result.score) markdown += `**Score:** ${result.score.toFixed(4)}\n`;
          if (result.snippet) markdown += `**Snippet:** ${result.snippet}\n`;
          markdown += '\n---\n\n';
        });
        
        return markdown;
      
      default:
        return null;
    }
  }

  clearAllSessions(): void {
    if (existsSync(this.sessionsFile)) {
      writeFileSync(this.sessionsFile, '[]');
    }
  }

  getStats(): {
    totalSessions: number;
    totalQueries: number;
    totalResults: number;
    averageResultsPerQuery: number;
  } {
    const sessions = this.loadAllSessions();
    const totalQueries = sessions.reduce((sum, session) => sum + session.queries.length, 0);
    const totalResults = sessions.reduce((sum, session) => sum + session.results.length, 0);
    
    return {
      totalSessions: sessions.length,
      totalQueries,
      totalResults,
      averageResultsPerQuery: totalQueries > 0 ? totalResults / totalQueries : 0,
    };
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
