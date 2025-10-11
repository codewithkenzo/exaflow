import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { SearchConfig, ContentType, SearchMode } from '../types/index.js';

interface ConfigPanelProps {
  isActive: boolean;
  config: SearchConfig;
  onConfigChange: (config: Partial<SearchConfig>) => void;
}

const contentTypes: ContentType[] = [
  'all', 'papers', 'blogs', 'repos', 'profiles', 'news', 'knowledge'
];

const searchModes: SearchMode[] = [
  'auto', 'keyword', 'neural', 'fast'
];

const resultCounts = [5, 10, 20, 50];

export function ConfigPanel({ 
  isActive, 
  config, 
  onConfigChange 
}: ConfigPanelProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.escape) {
      setEditingField(null);
    } else if (key.tab) {
      // Cycle through editable fields
      const fields = ['contentType', 'mode', 'numResults', 'includeContents'];
      const currentIndex = editingField ? fields.indexOf(editingField) : -1;
      const nextIndex = (currentIndex + 1) % fields.length;
      setEditingField(fields[nextIndex]);
    } else if (key.return && editingField) {
      setEditingField(null);
    } else if (key.ctrl && input === 'a') {
      setShowAdvanced(!showAdvanced);
    } else if (editingField) {
      handleFieldInput(input, key);
    }
  });

  const handleFieldInput = (input: string, key: any) => {
    switch (editingField) {
      case 'contentType':
        if (key.upArrow || key.downArrow) {
          const currentIndex = contentTypes.indexOf(config.contentType);
          const nextIndex = key.upArrow 
            ? Math.max(0, currentIndex - 1)
            : Math.min(contentTypes.length - 1, currentIndex + 1);
          onConfigChange({ contentType: contentTypes[nextIndex] });
        }
        break;
        
      case 'mode':
        if (key.upArrow || key.downArrow) {
          const currentIndex = searchModes.indexOf(config.mode);
          const nextIndex = key.upArrow 
            ? Math.max(0, currentIndex - 1)
            : Math.min(searchModes.length - 1, currentIndex + 1);
          onConfigChange({ mode: searchModes[nextIndex] });
        }
        break;
        
      case 'numResults':
        if (key.upArrow || key.downArrow) {
          const currentIndex = resultCounts.indexOf(config.numResults);
          const nextIndex = key.upArrow 
            ? Math.max(0, currentIndex - 1)
            : Math.min(resultCounts.length - 1, currentIndex + 1);
          onConfigChange({ numResults: resultCounts[nextIndex] });
        }
        break;
        
      case 'includeContents':
        if (input === ' ') {
          onConfigChange({ includeContents: !config.includeContents });
        }
        break;
    }
  };

  const getContentTypeColor = (type: ContentType) => {
    switch (type) {
      case 'all': return 'white';
      case 'papers': return 'blue';
      case 'blogs': return 'magenta';
      case 'repos': return 'green';
      case 'profiles': return 'cyan';
      case 'news': return 'yellow';
      case 'knowledge': return 'red';
    }
  };

  const getModeColor = (mode: SearchMode) => {
    switch (mode) {
      case 'auto': return 'white';
      case 'keyword': return 'yellow';
      case 'neural': return 'blue';
      case 'fast': return 'green';
    }
  };

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⚙️ Configuration
        </Text>
        {isActive && <Text color="green"> ●</Text>}
      </Box>

      {/* Basic Configuration */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">Basic Settings</Text>
        
        <Box marginTop={1}>
          <Text color="gray">Content Type: </Text>
          <Text 
            color={getContentTypeColor(config.contentType)}
            bold={editingField === 'contentType'}
          >
            {config.contentType}
          </Text>
          {editingField === 'contentType' && <Text color="green"> ↑↓</Text>}
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Search Mode: </Text>
          <Text 
            color={getModeColor(config.mode)}
            bold={editingField === 'mode'}
          >
            {config.mode}
          </Text>
          {editingField === 'mode' && <Text color="green"> ↑↓</Text>}
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Results: </Text>
          <Text 
            color="yellow"
            bold={editingField === 'numResults'}
          >
            {config.numResults}
          </Text>
          {editingField === 'numResults' && <Text color="green"> ↑↓</Text>}
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Include Contents: </Text>
          <Text 
            color={config.includeContents ? 'green' : 'red'}
            bold={editingField === 'includeContents'}
          >
            {config.includeContents ? 'Yes' : 'No'}
          </Text>
          {editingField === 'includeContents' && <Text color="green"> Space</Text>}
        </Box>
      </Box>

      {/* Advanced Configuration */}
      <Box flexDirection="column">
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="yellow">
            Advanced {showAdvanced ? '▼' : '▶'}
          </Text>
          <Text color="gray" dimColor>
            Ctrl+A
          </Text>
        </Box>

        {showAdvanced && (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text color="gray">Language: </Text>
              <Text color="cyan">{config.language}</Text>
            </Box>

            {config.startDate && (
              <Box marginTop={1}>
                <Text color="gray">Start Date: </Text>
                <Text color="magenta">{config.startDate}</Text>
              </Box>
            )}

            {config.endDate && (
              <Box marginTop={1}>
                <Text color="gray">End Date: </Text>
                <Text color="magenta">{config.endDate}</Text>
              </Box>
            )}

            {config.userLocation && (
              <Box marginTop={1}>
                <Text color="gray">Location: </Text>
                <Text color="green">{config.userLocation}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Help */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Tab: Edit fields • Ctrl+A: Advanced • Escape: Stop editing
        </Text>
      </Box>

      {/* Configuration Summary */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Text bold color="cyan">Current Config</Text>
        <Text color="gray">{config.mode} • {config.contentType}</Text>
        <Text color="gray">{config.numResults} results</Text>
        {config.includeContents && <Text color="green">• Full content</Text>}
      </Box>
    </Box>
  );
}
