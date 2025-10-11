import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { SearchPanel } from './SearchPanel.js';
import { EnhancedSearchPanel } from './EnhancedSearchPanel.js';
import { ResultsPanel } from './ResultsPanel.js';
import { ConfigPanel } from './ConfigPanel.js';
import { WorkflowPanel } from './WorkflowPanel.js';
import { StatusBar } from './StatusBar.js';
import { useExaSearch } from '../hooks/useExaSearch.js';
import { SearchConfig, SearchResult, SearchMode } from '../types/index.js';
import { WorkflowExecution } from '../utils/workflow-automation.js';

export function App() {
  const { exit } = useApp();
  const [activePanel, setActivePanel] = useState<'search' | 'results' | 'config' | 'workflow'>('search');
  const [useEnhancedSearch, setUseEnhancedSearch] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    mode: 'neural',
    numResults: 10,
    includeContents: false,
    startDate: undefined,
    endDate: undefined,
    contentType: 'all',
    language: 'en',
    userLocation: undefined,
  });

  const { 
    results, 
    loading, 
    error, 
    search, 
    clearResults 
  } = useExaSearch();

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    } else if (key.tab) {
      // Cycle through panels
      setActivePanel(prev => {
        if (prev === 'search') return 'results';
        if (prev === 'results') return 'config';
        if (prev === 'config') return 'workflow';
        return 'search';
      });
    } else if (key.escape) {
      clearResults();
      setSearchQuery('');
    } else if (key.ctrl && input === 's') {
      // Ctrl+S: Focus search
      setActivePanel('search');
    } else if (key.ctrl && input === 'r') {
      // Ctrl+R: Focus results
      setActivePanel('results');
    } else if (key.ctrl && input === 't') {
      // Ctrl+T: Focus config
      setActivePanel('config');
    } else if (key.ctrl && input === 'w') {
      // Ctrl+W: Focus workflow
      setActivePanel('workflow');
    } else if (key.ctrl && input === 'e') {
      // Ctrl+E: Toggle enhanced search
      setUseEnhancedSearch(prev => !prev);
    }
  });

  const handleSearch = useCallback((query: string, config: SearchConfig) => {
    if (query.trim()) {
      search(query, config);
      setActivePanel('results');
    }
  }, [search]);

  const handleConfigChange = useCallback((newConfig: Partial<SearchConfig>) => {
    setSearchConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const handleWorkflowExecute = useCallback((execution: WorkflowExecution) => {
    // Handle workflow execution completion
    setActivePanel('results');
  }, []);

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="double" borderColor="blue" padding={1}>
        <Text bold color="blue">
          {' '}
          🔍 ExaFlow - Interactive Semantic Search Tool
        </Text>
      </Box>

      {/* Main Content Area */}
      <Box flexGrow={1} flexDirection="row">
        {/* Search Panel */}
        <Box 
          width="30%" 
          borderStyle={activePanel === 'search' ? 'bold' : 'single'}
          borderColor={activePanel === 'search' ? 'green' : 'gray'}
          marginRight={1}
        >
          {useEnhancedSearch ? (
            <EnhancedSearchPanel
              isActive={activePanel === 'search'}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSearch={(query) => handleSearch(query, searchConfig)}
              loading={loading}
              config={searchConfig}
              onConfigChange={handleConfigChange}
            />
          ) : (
            <SearchPanel
              isActive={activePanel === 'search'}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSearch={(query) => handleSearch(query, searchConfig)}
              loading={loading}
              config={searchConfig}
              onConfigChange={handleConfigChange}
            />
          )}
        </Box>

        {/* Results Panel */}
        <Box 
          width="35%" 
          borderStyle={activePanel === 'results' ? 'bold' : 'single'}
          borderColor={activePanel === 'results' ? 'green' : 'gray'}
          marginRight={1}
        >
          <ResultsPanel
            isActive={activePanel === 'results'}
            results={results}
            loading={loading}
            error={error}
            query={searchQuery}
          />
        </Box>

        {/* Configuration Panel */}
        <Box 
          width="20%" 
          borderStyle={activePanel === 'config' ? 'bold' : 'single'}
          borderColor={activePanel === 'config' ? 'green' : 'gray'}
          marginRight={1}
        >
          <ConfigPanel
            isActive={activePanel === 'config'}
            config={searchConfig}
            onConfigChange={handleConfigChange}
          />
        </Box>

        {/* Workflow Panel */}
        <Box 
          width="15%" 
          borderStyle={activePanel === 'workflow' ? 'bold' : 'single'}
          borderColor={activePanel === 'workflow' ? 'green' : 'gray'}
        >
          <WorkflowPanel
            isActive={activePanel === 'workflow'}
            query={searchQuery}
            config={searchConfig}
            onWorkflowExecute={handleWorkflowExecute}
          />
        </Box>
      </Box>

      {/* Status Bar */}
      <StatusBar
        activePanel={activePanel}
        loading={loading}
        resultsCount={results?.length || 0}
        query={searchQuery}
        useEnhancedSearch={useEnhancedSearch}
      />
    </Box>
  );
}
