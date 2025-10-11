import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { SearchResult } from '../types/index.js';

interface ResultsPanelProps {
  isActive: boolean;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
}

export function ResultsPanel({ 
  isActive, 
  results, 
  loading, 
  error, 
  query 
}: ResultsPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const selectedResult = results[selectedIndex];

  useInput((input, key) => {
    if (!isActive || results.length === 0) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(results.length - 1, prev + 1));
    } else if (key.return) {
      setShowDetails(!showDetails);
    } else if (key.ctrl && input === 'o') {
      // Open URL in browser (would need to implement browser opening)
      if (selectedResult) {
        console.log(`\nOpening URL: ${selectedResult.url}`);
      }
    } else if (key.ctrl && input === 'c') {
      // Copy URL to clipboard (would need to implement clipboard)
      if (selectedResult) {
        console.log(`\nCopied to clipboard: ${selectedResult.url}`);
      }
    } else if (key.ctrl && input === 'e') {
      // Export results
      console.log(`\nExporting results for query: ${query}`);
    }
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'papers': return 'blue';
      case 'repos': return 'green';
      case 'profiles': return 'cyan';
      case 'blogs': return 'magenta';
      case 'news': return 'yellow';
      case 'knowledge': return 'red';
      default: return 'white';
    }
  };

  const resultsContent = useMemo(() => {
    if (loading) {
      return (
        <Box justifyContent="center" alignItems="center" height="100%">
          <Text color="yellow">⏳ Searching...</Text>
        </Box>
      );
    }

    if (error) {
      return (
        <Box justifyContent="center" alignItems="center" height="100%">
          <Text color="red">❌ {error}</Text>
        </Box>
      );
    }

    if (results.length === 0 && query) {
      return (
        <Box justifyContent="center" alignItems="center" height="100%">
          <Text color="gray">No results found for: {query}</Text>
        </Box>
      );
    }

    if (results.length === 0) {
      return (
        <Box justifyContent="center" alignItems="center" height="100%">
          <Text color="gray">Enter a search query to see results</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" height="100%">
        {/* Results List */}
        <Box flexDirection="column" height={showDetails ? "50%" : "100%"} overflow="hidden">
          {results.map((result, index) => (
            <Box
              key={result.id}
              borderStyle={index === selectedIndex ? 'bold' : 'single'}
              borderColor={index === selectedIndex ? 'green' : 'gray'}
              padding={1}
              marginBottom={1}
            >
              <Box flexDirection="column">
                <Box justifyContent="space-between">
                  <Text bold={index === selectedIndex}>
                    {index + 1}. {result.title}
                  </Text>
                  <Text color={getContentTypeColor(result.contentType)}>
                    [{result.contentType}]
                  </Text>
                </Box>
                {result.snippet && (
                  <Text color="gray" dimColor>
                    {result.snippet.substring(0, 100)}...
                  </Text>
                )}
                <Box justifyContent="space-between">
                  <Text color="blue" dimColor>
                    {result.url}
                  </Text>
                  {result.score && (
                    <Text color="yellow">
                      Score: {result.score.toFixed(2)}
                    </Text>
                  )}
                </Box>
                {result.author && (
                  <Text color="cyan" dimColor>
                    By: {result.author}
                  </Text>
                )}
                {result.publishedDate && (
                  <Text color="magenta" dimColor>
                    {formatDate(result.publishedDate)}
                  </Text>
                )}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Details Panel */}
        {showDetails && selectedResult && (
          <Box height="50%" borderStyle="single" borderColor="blue" padding={1}>
            <Text bold color="blue">📋 Result Details</Text>
            <Box marginTop={1} flexDirection="column">
              <Text bold>Title:</Text>
              <Text>{selectedResult.title}</Text>
              
              <Text bold marginTop={1}>URL:</Text>
              <Text color="blue">{selectedResult.url}</Text>
              
              {selectedResult.snippet && (
                <>
                  <Text bold marginTop={1}>Snippet:</Text>
                  <Text>{selectedResult.snippet}</Text>
                </>
              )}
              
              {selectedResult.author && (
                <>
                  <Text bold marginTop={1}>Author:</Text>
                  <Text color="cyan">{selectedResult.author}</Text>
                </>
              )}
              
              {selectedResult.publishedDate && (
                <>
                  <Text bold marginTop={1}>Published:</Text>
                  <Text color="magenta">{formatDate(selectedResult.publishedDate)}</Text>
                </>
              )}
              
              {selectedResult.score && (
                <>
                  <Text bold marginTop={1}>Score:</Text>
                  <Text color="yellow">{selectedResult.score.toFixed(4)}</Text>
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  }, [results, loading, error, query, selectedIndex, showDetails, selectedResult]);

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📄 Results
        </Text>
        {isActive && <Text color="green"> ●</Text>}
        {results.length > 0 && (
          <Text color="gray"> ({results.length} results)</Text>
        )}
      </Box>

      {resultsContent}

      {/* Navigation Help */}
      {results.length > 0 && !loading && !error && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ↑↓ Navigate • Enter: Details • Ctrl+O: Open • Ctrl+C: Copy • Ctrl+E: Export
          </Text>
        </Box>
      )}
    </Box>
  );
}
