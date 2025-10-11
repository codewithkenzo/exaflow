import type { SearchConfig } from '../types/index.js';
import { sessionManager } from './session-manager.js';
import { exportManager } from './export-manager.js';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'search' | 'filter' | 'export' | 'session' | 'delay';
  config: any;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  currentStep: number;
  results: any[];
  logs: string[];
  error?: string;
}

export class WorkflowAutomation {
  private workflows: Workflow[] = [];
  private executions: WorkflowExecution[] = [];

  // Predefined workflow templates
  private readonly workflowTemplates = {
    academicResearch: {
      name: 'Academic Research Pipeline',
      description: 'Comprehensive academic research workflow',
      steps: [
        {
          id: 'initial-search',
          name: 'Initial Paper Search',
          description: 'Search for relevant academic papers',
          type: 'search' as const,
          config: {
            query: '', // Will be set at runtime
            specializedMode: 'research',
            numResults: 15,
            includeContents: true,
          },
        },
        {
          id: 'citation-analysis',
          name: 'Citation Network Analysis',
          description: 'Analyze citation patterns and key papers',
          type: 'search' as const,
          config: {
            query: '', // Will be derived from initial results
            specializedMode: 'research',
            numResults: 10,
            includeContents: false,
          },
        },
        {
          id: 'export-bibtex',
          name: 'Export Bibliography',
          description: 'Generate BibTeX bibliography',
          type: 'export' as const,
          config: {
            format: 'bibtex',
            filename: 'research-bibliography.bib',
          },
        },
        {
          id: 'save-session',
          name: 'Save Research Session',
          description: 'Save complete research session',
          type: 'session' as const,
          config: {
            name: 'Academic Research Session',
          },
        },
      ],
    },
    
    marketResearch: {
      name: 'Market Research Analysis',
      description: 'Comprehensive market and competitor analysis',
      steps: [
        {
          id: 'competitor-search',
          name: 'Competitor Analysis',
          description: 'Search for competitor information',
          type: 'search' as const,
          config: {
            query: '', // Will be set at runtime
            specializedMode: 'professional',
            numResults: 20,
            includeContents: true,
          },
        },
        {
          id: 'news-analysis',
          name: 'News and Trends',
          description: 'Search for recent news and market trends',
          type: 'search' as const,
          config: {
            query: '', // Will be derived from initial search
            specializedMode: 'news',
            numResults: 15,
            includeContents: true,
          },
        },
        {
          id: 'knowledge-research',
          name: 'Knowledge Base Research',
          description: 'Research industry knowledge and reports',
          type: 'search' as const,
          config: {
            query: '', // Will be derived from previous searches
            specializedMode: 'knowledge',
            numResults: 10,
            includeContents: true,
          },
        },
        {
          id: 'export-report',
          name: 'Generate Report',
          description: 'Export comprehensive market research report',
          type: 'export' as const,
          config: {
            format: 'markdown',
            filename: 'market-research-report.md',
          },
        },
      ],
    },
    
    technicalInvestigation: {
      name: 'Technical Investigation',
      description: 'Deep technical investigation and code research',
      steps: [
        {
          id: 'code-search',
          name: 'Code Repository Search',
          description: 'Search for relevant code repositories',
          type: 'search' as const,
          config: {
            query: '', // Will be set at runtime
            specializedMode: 'development',
            numResults: 15,
            includeContents: false,
          },
        },
        {
          id: 'tutorial-search',
          name: 'Tutorial and Documentation',
          description: 'Find tutorials and documentation',
          type: 'search' as const,
          config: {
            query: '', // Will be derived from code search
            specializedMode: 'blogs',
            numResults: 10,
            includeContents: true,
          },
        },
        {
          id: 'knowledge-deep-dive',
          name: 'Technical Knowledge Deep Dive',
          description: 'Research technical concepts and principles',
          type: 'search' as const,
          config: {
            query: '', // Will be derived from previous searches
            specializedMode: 'knowledge',
            numResults: 8,
            includeContents: true,
          },
        },
        {
          id: 'export-technical',
          name: 'Export Technical Summary',
          description: 'Generate technical investigation summary',
          type: 'export' as const,
          config: {
            format: 'markdown',
            filename: 'technical-investigation.md',
          },
        },
      ],
    },
  };

  constructor() {
    // Initialize with workflow templates
    this.workflows = Object.entries(this.workflowTemplates).map(([id, template]) => ({
      id,
      ...template,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  createWorkflow(name: string, description: string, steps: WorkflowStep[]): Workflow {
    const workflow: Workflow = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      steps,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workflows.push(workflow);
    return workflow;
  }

  getWorkflow(id: string): Workflow | null {
    return this.workflows.find(w => w.id === id) || null;
  }

  getAllWorkflows(): Workflow[] {
    return [...this.workflows];
  }

  getEnabledWorkflows(): Workflow[] {
    return this.workflows.filter(w => w.enabled);
  }

  updateWorkflow(id: string, updates: Partial<Workflow>): Workflow | null {
    const workflow = this.getWorkflow(id);
    if (!workflow) {
      return null;
    }

    Object.assign(workflow, updates, { updatedAt: new Date().toISOString() });
    return workflow;
  }

  deleteWorkflow(id: string): boolean {
    const index = this.workflows.findIndex(w => w.id === id);
    if (index >= 0) {
      this.workflows.splice(index, 1);
      return true;
    }
    return false;
  }

  async executeWorkflow(
    workflowId: string, 
    initialQuery: string,
    onProgress?: (step: number, total: number, message: string) => void,
    onStepComplete?: (step: WorkflowStep, results: any) => void
  ): Promise<WorkflowExecution> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const execution: WorkflowExecution = {
      id: `execution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowId,
      status: 'running',
      startedAt: new Date().toISOString(),
      currentStep: 0,
      results: [],
      logs: [],
    };

    this.executions.push(execution);

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStep = i;
        
        onProgress?.(i + 1, workflow.steps.length, `Executing: ${step.name}`);
        execution.logs.push(`Starting step: ${step.name}`);

        const stepResults = await this.executeStep(step, initialQuery, execution.results);
        execution.results.push({ stepId: step.id, results: stepResults });
        
        onStepComplete?.(step, stepResults);
        execution.logs.push(`Completed step: ${step.name}`);

        // Small delay between steps
        await this.delay(1000);
      }

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.logs.push('Workflow completed successfully');

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.error = error instanceof Error ? error.message : String(error);
      execution.logs.push(`Workflow failed: ${execution.error}`);
    }

    return execution;
  }

  private async executeStep(step: WorkflowStep, query: string, previousResults: any[]): Promise<any> {
    switch (step.type) {
      case 'search':
        return await this.executeSearchStep(step, query, previousResults);
      
      case 'filter':
        return await this.executeFilterStep(step, previousResults);
      
      case 'export':
        return await this.executeExportStep(step, previousResults);
      
      case 'session':
        return await this.executeSessionStep(step, query, previousResults);
      
      case 'delay':
        return await this.executeDelayStep(step);
      
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeSearchStep(step: WorkflowStep, query: string, previousResults: any[]): Promise<any> {
    const { specializedMode, numResults, includeContents } = step.config;
    
    // Import here to avoid circular dependencies
    const { applySpecializedMode } = await import('./specialized-modes.js');
    const { runSearchTask } = await import('../../index.js');

    const config: SearchConfig = {
      mode: 'neural',
      numResults: numResults || 10,
      includeContents: includeContents || false,
      contentType: 'all',
      language: 'en',
    };

    let finalQuery = query;
    
    // Apply specialized mode if specified
    if (specializedMode) {
      const result = applySpecializedMode(query, config, specializedMode);
      finalQuery = result.enhancedQuery;
      Object.assign(config, result.enhancedConfig);
    }

    const result = await runSearchTask(finalQuery, {
      searchType: config.mode,
      numResults: config.numResults,
      includeContents: config.includeContents,
      timeout: 30000,
      retries: 3,
      taskId: `workflow-search-${Date.now()}`,
    });

    if (result.status !== 'success') {
      throw new Error(`Search step failed: ${result.error?.message}`);
    }

    return result.data;
  }

  private async executeFilterStep(step: WorkflowStep, previousResults: any[]): Promise<any> {
    const { filterType, criteria } = step.config;
    
    // Implementation for filtering results would go here
    // For now, just return the last results
    return previousResults[previousResults.length - 1] || null;
  }

  private async executeExportStep(step: WorkflowStep, previousResults: any[]): Promise<any> {
    const { format, filename } = step.config;
    
    // Combine all results from previous steps
    const allResults = previousResults
      .filter(r => r?.results)
      .flatMap(r => r.results);

    if (allResults.length === 0) {
      throw new Error('No results to export');
    }

    const exportOptions = {
      format,
      includeMetadata: true,
      includeContents: true,
    };

    const exportedFile = exportManager.exportResults(allResults, format, exportOptions, filename);
    
    return { exportedFile, resultCount: allResults.length };
  }

  private async executeSessionStep(step: WorkflowStep, query: string, previousResults: any[]): Promise<any> {
    const { name } = step.config;
    
    // Combine all results from previous steps
    const allResults = previousResults
      .filter(r => r?.results)
      .flatMap(r => r.results);

    const config: SearchConfig = {
      mode: 'neural',
      numResults: 10,
      includeContents: true,
      contentType: 'all',
      language: 'en',
    };

    const session = sessionManager.createSession(name, query, allResults, config);
    
    return { sessionId: session.id, resultCount: allResults.length };
  }

  private async executeDelayStep(step: WorkflowStep): Promise<any> {
    const { duration = 1000 } = step.config;
    await this.delay(duration);
    return { delayed: duration };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getExecution(id: string): WorkflowExecution | null {
    return this.executions.find(e => e.id === id) || null;
  }

  getAllExecutions(): WorkflowExecution[] {
    return [...this.executions];
  }

  cancelExecution(id: string): boolean {
    const execution = this.getExecution(id);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
      execution.logs.push('Execution cancelled');
      return true;
    }
    return false;
  }

  // Get workflow recommendations based on query
  getWorkflowRecommendations(query: string): Workflow[] {
    const queryLower = query.toLowerCase();
    const recommendations: { workflow: Workflow; score: number }[] = [];

    for (const workflow of this.getEnabledWorkflows()) {
      let score = 0;
      const description = workflow.description.toLowerCase();
      const name = workflow.name.toLowerCase();

      // Score based on keyword matching
      if (queryLower.includes('research') || queryLower.includes('academic') || queryLower.includes('paper')) {
        if (name.includes('academic')) score += 10;
        if (description.includes('academic')) score += 5;
      }

      if (queryLower.includes('market') || queryLower.includes('competitor') || queryLower.includes('business')) {
        if (name.includes('market')) score += 10;
        if (description.includes('market')) score += 5;
      }

      if (queryLower.includes('code') || queryLower.includes('technical') || queryLower.includes('programming')) {
        if (name.includes('technical')) score += 10;
        if (description.includes('technical')) score += 5;
      }

      // Base score for all workflows
      score += 1;

      if (score > 1) {
        recommendations.push({ workflow, score });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .map(r => r.workflow);
  }
}

// Singleton instance
export const workflowAutomation = new WorkflowAutomation();
