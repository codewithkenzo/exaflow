import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { SearchConfig } from '../types/index.js';
import { 
  specializedModes, 
  getSpecializedMode, 
  applySpecializedMode, 
  getRecommendedMode, 
  getAllSpecializedModes 
} from '../utils/specialized-modes.js';

interface EnhancedSearchPanelProps {
  isActive: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string, config: SearchConfig) => void;
  loading: boolean;
  config: SearchConfig;
  onConfigChange: (config: Partial<SearchConfig>) => void;
}

export function EnhancedSearchPanel({ 
  isActive, 
  query, 
  onQueryChange, 
  onSearch, 
  loading,
  config,
  onConfigChange 
}: EnhancedSearchPanelProps) {
  const [localQuery, setLocalQuery] = useState(query);
  const [showHelp, setShowHelp] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('auto');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleSubmit = useCallback((value: string) => {
    onQueryChange(value);
    
    // Apply specialized mode if selected
    let finalQuery = value;
    let finalConfig = config;
    
    if (selectedMode !== 'auto') {
      const result = applySpecializedMode(value, config, selectedMode);
      finalQuery = result.enhancedQuery;
      finalConfig = result.enhancedConfig;
    }
    
    onSearch(finalQuery, finalConfig);
  }, [onQueryChange, onSearch, config, selectedMode]);

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
    } else if (key.ctrl && input === 'm') {
      setShowModes(!showModes);
    } else if (key.tab && showModes) {
      // Cycle through specialized modes
      const modes = ['auto', ...getAllSpecializedModes().map(m => m.id)];
      const currentIndex = modes.indexOf(selectedMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setSelectedMode(modes[nextIndex]);
    } else if (key.ctrl && input === 'r') {
      // Apply recommended mode
      const recommended = getRecommendedMode(localQuery);
      setSelectedMode(recommended);
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

  React.useEffect(() => {
    setLocalQuery(query);
    setCursorPosition(query.length);
  }, [query]);

  const getModeColor = (mode: string) => {
    return config.mode === mode ? 'green' : 'gray';
  };

  const getSpecializedModeInfo = () => {
    if (selectedMode === 'auto') {
      return {
        name: 'Auto Mode',
        description: 'Automatic search optimization',
        icon: '🤖',
      };
    }
    
    const mode = getSpecializedMode(selectedMode);
    return mode ? {
      name: mode.name,
      description: mode.description,
      icon: mode.icon,
    } : {
      name: 'Unknown Mode',
      description: 'Invalid specialized mode',
      icon: '❓',
    };
  };

  const modeInfo = getSpecializedModeInfo();

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Enhanced Search
        </Text>
        {isActive && <Text color="green"> ●</Text>}
      </Box>

      {/* Search Input */}
      <Box marginBottom={1}>
        <Text color="gray">Query: </Text>
        <Text 
          color={isActive && !showHelp && !showModes ? 'white' : 'gray'}
          backgroundColor={isActive && !showHelp && !showModes ? 'blue' : undefined}
        >
          {localQuery || 'Enter your search query...'}
          {isActive && !showHelp && !showModes && localQuery.length >= 0 && (
            <Text backgroundColor="white" color="black"> </Text>
          )}
        </Text>
      </Box>

      {/* Specialized Mode Display */}
      <Box marginBottom={1}>
        <Text color="gray">Mode: </Text>
        <Text color="magenta">
          {modeInfo.icon} {modeInfo.name}
        </Text>
        <Text color="gray" dimColor>
          {' '}• {modeInfo.description}
        </Text>
      </Box>

      {/* Search Algorithm */}
      <Box marginBottom={1}>
        <Text color="gray">Algorithm: </Text>
        <Text color={getModeColor('auto')}>[1]Auto</Text>
        <Text> </Text>
        <Text color={getModeColor('keyword')}>[2]Keyword</Text>
        <Text> </Text>
        <Text color={getModeColor('neural')}>[3]Neural</Text>
        <Text> </Text>
        <Text color={getModeColor('fast')}>[4]Fast</Text>
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

      {/* Specialized Modes Panel */}
      {showModes && (
        <Box borderStyle="single" borderColor="gray" padding={1} marginBottom={1}>
          <Text bold color="cyan">Specialized Search Modes</Text>
          {getAllSpecializedModes().map((mode) => (
            <Box key={mode.id} marginTop={1}>
              <Text color={selectedMode === mode.id ? 'green' : 'gray'}>
                {mode.icon} {mode.name}
              </Text>
              <Text color="gray" dimColor>
                {' '}- {mode.description}
              </Text>
              <Text color={selectedMode === mode.id ? 'green' : 'gray'}>
                {' '}({mode.coverageLevel})
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text color="gray">
              Current: {modeInfo.icon} {modeInfo.name}
            </Text>
          </Box>
        </Box>
      )}

      {/* Help Panel */}
      {showHelp && (
        <Box borderStyle="single" borderColor="gray" padding={1}>
          <Text bold color="cyan">Keyboard Shortcuts</Text>
          <Text>• Enter: Search</Text>
          <Text>• Escape: Clear</Text>
          <Text>• Ctrl+H: Toggle help</Text>
          <Text>• Ctrl+M: Toggle modes</Text>
          <Text>• Ctrl+R: Recommended mode</Text>
          <Text>• Tab: Cycle modes (when shown)</Text>
          <Text>• Ctrl+1-4: Change algorithm</Text>
          <Text>• Tab: Switch panels</Text>
          <Text>• Ctrl+C: Exit</Text>
        </Box>
      )}

      {/* Status */}
      {!showHelp && !showModes && !loading && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {localQuery.trim() 
              ? `Press Enter to search • Ctrl+M: modes • Ctrl+H: help`
              : `Type a query and press Enter • Ctrl+M: modes • Ctrl+H: help`
            }
          </Text>
        </Box>
      )}
    </Box>
  );
}
