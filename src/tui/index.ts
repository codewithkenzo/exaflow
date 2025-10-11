#!/usr/bin/env bun

import React from 'react';
import { render } from 'ink';
import { App } from './components/App.tsx';
import { loadEnv } from '../env.js';

// Load environment
loadEnv();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the TUI application
const { waitUntilExit } = render(React.createElement(App));

waitUntilExit().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Application error:', error);
  process.exit(1);
});
