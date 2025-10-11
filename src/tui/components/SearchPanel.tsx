import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { SearchConfig } from '../types/index.js';

interface SearchPanelProps {
  isActive: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  loading: boolean;
  config: SearchConfig;
  onConfigChange: (config: Partial<SearchConfig>) => void;
}

export function SearchPanel({ 
  isActive, 
  query, 
  onQueryChange, 
  onSearch, 
  loading,
  config,
  onConfigChange 
}: SearchPanelProps) {
  const [localQuery, setLocalQuery] = useState(query);
  const [showHelp, setShowHelp] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleSubmit = useCallback((value: string) => {
    onQueryChange(value);
    onSearch(value);
  }, [onQueryChange, onSearch]);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.return && localQuery.trim()) {
      handleSubmit(localQuery);
    } else if (key.escape) {
      setLocalQuery('');
      setCursorPosition(0);
      onQueryChange('');
    } else if (key.ctrl && input === 'h') {
      setShowHelp(!showHelp);
    } else if (key.ctrl && input === '1') {
      onConfigChange({ mode: 'auto' });
    } else if (key.ctrl && input === '2') {
      onConfigChange({ mode: 'keyword' });
    } else if (key.ctrl && input === '3') {
      onConfigChange({ mode: 'neural' });
    } else if (key.ctrl && input === '4') {
      onConfigChange({ mode: 'fast' });
    } else if (key.backspace) {
      if (cursorPosition > 0) {
        const newQuery = localQuery.slice(0, cursorPosition - 1) + localQuery.slice(cursorPosition);
        setLocalQuery(newQuery);
        setCursorPosition(cursorPosition - 1);
        onQueryChange(newQuery);
      }
    } else if (key.delete) {
      if (cursorPosition < localQuery.length) {
        const newQuery = localQuery.slice(0, cursorPosition) + localQuery.slice(cursorPosition + 1);
        setLocalQuery(newQuery);
        onQueryChange(newQuery);
      }
    } else if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
    } else if (key.rightArrow) {
      setCursorPosition(Math.min(localQuery.length, cursorPosition + 1));
    } else if (key.ctrl && input === 'a') {
      setCursorPosition(0);
    } else if (key.ctrl && input === 'e') {
      setCursorPosition(localQuery.length);
    } else if (input && !key.ctrl && !key.meta) {
      const newQuery = localQuery.slice(0, cursorPosition) + input + localQuery.slice(cursorPosition);
      setLocalQuery(newQuery);
      setCursorPosition(cursorPosition + 1);
      onQueryChange(newQuery);
    }
  });

  useEffect(() => {
    setLocalQuery(query);
    setCursorPosition(query.length);
  }, [query]);

  const getModeColor = (mode: string) => {
    return config.mode === mode ? 'green' : 'gray';
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Search
        </Text>
        {isActive && <Text color="green"> ●</Text>}
      </Box>

      {/* Search Input */}
      <Box marginBottom={1}>
        <Text color="gray">Query: </Text>
        <Text 
          color={isActive && !showHelp ? 'white' : 'gray'}
          backgroundColor={isActive && !showHelp ? 'blue' : undefined}
        >
          {localQuery || 'Enter your search query...'}
          {isActive && !showHelp && localQuery.length >= 0 && (
            <Text backgroundColor="white" color="black"> </Text>
          )}
        </Text>
      </Box>

      {/* Search Mode */}
      <Box marginBottom={1}>
        <Text color="gray">Mode: </Text>
        <Text color={getModeColor('auto')}>[1]Auto</Text>
        <Text> </Text>
        <Text color={getModeColor('keyword')}>[2]Keyword</Text>
        <Text> </Text>
        <Text color={getModeColor('neural')}>[3]Neural</Text>
        <Text> </Text>
        <Text color={getModeColor('fast')}>[4]Fast</Text>
      </Box>

      {/* Content Type */}
      <Box marginBottom={1}>
        <Text color="gray">Type: </Text>
        <Text color="blue">{config.contentType}</Text>
      </Box>

      {/* Results Count */}
      <Box marginBottom={1}>
        <Text color="gray">Results: </Text>
        <Text color="yellow">{config.numResults}</Text>
      </Box>

      {/* Loading Indicator */}
      {loading && (
        <Box marginBottom={1}>
          <Text color="yellow">⏳ Searching...</Text>
        </Box>
      )}

      {/* Help Panel */}
      {showHelp && (
        <Box borderStyle="single" borderColor="gray" padding={1}>
          <Text bold color="cyan">Keyboard Shortcuts</Text>
          <Text>• Enter: Search</Text>
          <Text>• Escape: Clear</Text>
          <Text>• Ctrl+H: Toggle help</Text>
          <Text>• Ctrl+1-4: Change mode</Text>
          <Text>• Tab: Switch panels</Text>
          <Text>• Ctrl+C: Exit</Text>
        </Box>
      )}

      {/* Status */}
      {!showHelp && !loading && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {localQuery.trim() 
              ? `Press Enter to search or Ctrl+H for help`
              : `Type a query and press Enter (Ctrl+H for help)`
            }
          </Text>
        </Box>
      )}
    </Box>
  );
}
