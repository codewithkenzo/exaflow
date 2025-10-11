import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  activePanel: 'search' | 'results' | 'config' | 'workflow';
  loading: boolean;
  resultsCount: number;
  query: string;
  useEnhancedSearch?: boolean;
}

export function StatusBar({ 
  activePanel, 
  loading, 
  resultsCount, 
  query,
  useEnhancedSearch = false
}: StatusBarProps) {
  const getPanelIndicator = (panel: typeof activePanel) => {
    const isActive = activePanel === panel;
    const color = isActive ? 'green' : 'gray';
    const symbol = isActive ? '●' : '○';
    
    switch (panel) {
      case 'search':
        return <Text color={color}>{symbol} Search</Text>;
      case 'results':
        return <Text color={color}>{symbol} Results</Text>;
      case 'config':
        return <Text color={color}>{symbol} Config</Text>;
      case 'workflow':
        return <Text color={color}>{symbol} Workflow</Text>;
    }
  };

  const getStatusText = () => {
    if (loading) return 'Searching...';
    if (query && resultsCount > 0) return `Found ${resultsCount} results`;
    if (query) return 'No results found';
    return 'Ready';
  };

  const getStatusColor = () => {
    if (loading) return 'yellow';
    if (query && resultsCount > 0) return 'green';
    if (query) return 'red';
    return 'gray';
  };

  return (
    <Box 
      borderStyle="single" 
      borderColor="blue" 
      padding={1}
      justifyContent="space-between"
    >
      <Box>
        {getPanelIndicator('search')}
        <Text> </Text>
        {getPanelIndicator('results')}
        <Text> </Text>
        {getPanelIndicator('config')}
        <Text> </Text>
        {getPanelIndicator('workflow')}
        {useEnhancedSearch && <Text color="magenta"> ⚡</Text>}
      </Box>

      <Box>
        <Text color={getStatusColor()}>
          {getStatusText()}
        </Text>
      </Box>

      <Box>
        <Text color="gray">
          Tab: Panels • Ctrl+S/R/T/W: Focus • Ctrl+E: Enhanced • Ctrl+H: Help • Ctrl+C: Exit
        </Text>
      </Box>
    </Box>
  );
}
