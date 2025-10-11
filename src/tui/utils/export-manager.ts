import type { SearchResult, ExportFormat, ExportOptions } from '../types/index.js';
import { writeFileSync } from 'fs';

export class ExportManager {
  exportResults(
    results: SearchResult[], 
    format: ExportFormat, 
    options: ExportOptions,
    filename?: string
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `exaflow-export-${timestamp}.${format}`;
    const outputFilename = filename || defaultFilename;

    let content: string;

    switch (format) {
      case 'json':
        content = this.exportToJSON(results, options);
        break;
      case 'csv':
        content = this.exportToCSV(results, options);
        break;
      case 'bibtex':
        content = this.exportToBibTeX(results, options);
        break;
      case 'markdown':
        content = this.exportToMarkdown(results, options);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    writeFileSync(outputFilename, content, 'utf-8');
    return outputFilename;
  }

  private exportToJSON(results: SearchResult[], options: ExportOptions): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      count: results.length,
      options: options,
      results: options.includeMetadata 
        ? results 
        : results.map(({ id, title, url, snippet, author, publishedDate, score }) => ({
            id,
            title,
            url,
            snippet,
            author,
            publishedDate,
            score,
          }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportToCSV(results: SearchResult[], options: ExportOptions): string {
    const headers = ['Title', 'URL', 'Author', 'Published Date', 'Snippet', 'Score'];
    if (options.includeMetadata) {
      headers.push('Content Type', 'ID');
    }

    const rows = results.map(result => {
      const row = [
        `"${this.escapeCsvField(result.title)}"`,
        `"${result.url}"`,
        `"${this.escapeCsvField(result.author || '')}"`,
        `"${result.publishedDate || ''}"`,
        `"${this.escapeCsvField(result.snippet || '')}"`,
        result.score ? result.score.toString() : '',
      ];

      if (options.includeMetadata) {
        row.push(`"${result.contentType}"`, `"${result.id}"`);
      }

      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  private exportToBibTeX(results: SearchResult[], options: ExportOptions): string {
    const entries = results.map((result, index) => {
      const key = `exaflow${index + 1}${Date.now().toString().slice(-4)}`;
      const author = result.author || 'Unknown Author';
      const title = result.title;
      const year = result.publishedDate 
        ? new Date(result.publishedDate).getFullYear().toString() 
        : new Date().getFullYear().toString();
      const url = result.url;

      let entry = `@misc{${key},\n`;
      entry += `  author = "${this.escapeBibTeXField(author)}",\n`;
      entry += `  title = "${this.escapeBibTeXField(title)}",\n`;
      entry += `  year = "${year}",\n`;
      entry += `  url = "${url}",\n`;
      entry += `  urldate = "${new Date().toISOString().split('T')[0]}"\n`;
      entry += `}`;

      return entry;
    });

    return entries.join('\n\n');
  }

  private exportToMarkdown(results: SearchResult[], options: ExportOptions): string {
    let markdown = `# ExaFlow Search Results Export\n\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n`;
    markdown += `**Results:** ${results.length}\n`;
    markdown += `**Format:** ${options.includeContents ? 'Full content' : 'Snippets only'}\n\n`;

    results.forEach((result, index) => {
      markdown += `## ${index + 1}. ${result.title}\n\n`;
      
      markdown += `**URL:** [${result.url}](${result.url})\n`;
      
      if (result.author) {
        markdown += `**Author:** ${result.author}\n`;
      }
      
      if (result.publishedDate) {
        markdown += `**Published:** ${new Date(result.publishedDate).toLocaleDateString()}\n`;
      }
      
      if (result.score) {
        markdown += `**Score:** ${result.score.toFixed(4)}\n`;
      }
      
      if (options.includeMetadata) {
        markdown += `**Content Type:** ${result.contentType}\n`;
        markdown += `**ID:** ${result.id}\n`;
      }
      
      if (result.snippet) {
        markdown += `\n**Snippet:**\n> ${result.snippet}\n`;
      }
      
      // If full content is available and requested
      if (options.includeContents && result.metadata?.text) {
        markdown += `\n**Full Content:**\n${result.metadata.text}\n`;
      }
      
      markdown += '\n---\n\n';
    });

    return markdown;
  }

  private escapeCsvField(field: string): string {
    return field.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  private escapeBibTeXField(field: string): string {
    return field
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}');
  }

  createBibliography(results: SearchResult[], style: 'apa' | 'mla' | 'chicago' = 'apa'): string {
    return results.map((result, index) => {
      const author = result.author || 'Unknown Author';
      const title = result.title;
      const year = result.publishedDate 
        ? new Date(result.publishedDate).getFullYear().toString() 
        : 'n.d.';
      const retrievedDate = new Date().toLocaleDateString();

      switch (style) {
        case 'apa':
          return `${index + 1}. ${author} (${year}). *${title}*. Retrieved ${retrievedDate}, from ${result.url}`;
        
        case 'mla':
          return `${index + 1}. "${title}." ${author}, ${year}. ${result.url}. Accessed ${retrievedDate}.`;
        
        case 'chicago':
          return `${index + 1}. ${author}. "${title}." Last modified ${new Date(result.publishedDate || Date.now()).toLocaleDateString()}. ${result.url} (accessed ${retrievedDate}).`;
        
        default:
          return `${index + 1}. ${author}. ${title}. ${result.url}.`;
      }
    }).join('\n\n');
  }

  generateSummary(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No results to summarize.';
    }

    const summary = {
      totalResults: results.length,
      contentTypes: {} as Record<string, number>,
      averageScore: 0,
      dateRange: { earliest: null as string | null, latest: null as string | null },
      topSources: {} as Record<string, number>,
    };

    // Analyze content types
    results.forEach(result => {
      summary.contentTypes[result.contentType] = (summary.contentTypes[result.contentType] || 0) + 1;
      
      // Track scores
      if (result.score) {
        summary.averageScore += result.score;
      }
      
      // Track dates
      if (result.publishedDate) {
        const date = new Date(result.publishedDate);
        if (!summary.dateRange.earliest || date < new Date(summary.dateRange.earliest)) {
          summary.dateRange.earliest = result.publishedDate;
        }
        if (!summary.dateRange.latest || date > new Date(summary.dateRange.latest)) {
          summary.dateRange.latest = result.publishedDate;
        }
      }
      
      // Track sources
      try {
        const url = new URL(result.url);
        const domain = url.hostname;
        summary.topSources[domain] = (summary.topSources[domain] || 0) + 1;
      } catch {
        // Invalid URL, skip
      }
    });

    // Calculate average score
    const scoredResults = results.filter(r => r.score !== undefined);
    if (scoredResults.length > 0) {
      summary.averageScore = scoredResults.reduce((sum, r) => sum + (r.score || 0), 0) / scoredResults.length;
    }

    // Generate summary text
    let summaryText = `# Search Results Summary\n\n`;
    summaryText += `**Total Results:** ${summary.totalResults}\n\n`;
    
    summaryText += `## Content Types\n\n`;
    Object.entries(summary.contentTypes).forEach(([type, count]) => {
      const percentage = ((count / summary.totalResults) * 100).toFixed(1);
      summaryText += `- ${type}: ${count} (${percentage}%)\n`;
    });
    
    if (scoredResults.length > 0) {
      summaryText += `\n## Quality Metrics\n\n`;
      summaryText += `- **Average Score:** ${summary.averageScore.toFixed(4)}\n`;
      summaryText += `- **Scored Results:** ${scoredResults.length}/${summary.totalResults}\n`;
    }
    
    if (summary.dateRange.earliest && summary.dateRange.latest) {
      summaryText += `\n## Date Range\n\n`;
      summaryText += `- **Earliest:** ${new Date(summary.dateRange.earliest).toLocaleDateString()}\n`;
      summaryText += `- **Latest:** ${new Date(summary.dateRange.latest).toLocaleDateString()}\n`;
    }
    
    if (Object.keys(summary.topSources).length > 0) {
      summaryText += `\n## Top Sources\n\n`;
      Object.entries(summary.topSources)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([domain, count]) => {
          summaryText += `- ${domain}: ${count} results\n`;
        });
    }

    return summaryText;
  }
}

// Singleton instance
export const exportManager = new ExportManager();
