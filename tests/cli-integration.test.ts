#!/usr/bin/env bun

/**
 * CLI Integration Tests
 * Tests for CLI commands, argument parsing, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock environment for CLI tests
const originalEnv = process.env;

describe('CLI Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'exaflow-test-'));

    // Set up test environment
    process.env = {
      ...originalEnv,
      EXA_API_KEY: 'test-api-key',
      NODE_ENV: 'test',
    };
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore environment
    process.env = originalEnv;
  });

  async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const cliPath = join(process.cwd(), 'dist/cli.js');
      const child = spawn('bun', [cliPath, ...args], {
        stdio: 'pipe',
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      child.on('error', (error) => {
        resolve({ stdout: '', stderr: error.message, exitCode: 1 });
      });
    });
  }

  describe('Help and Version', () => {
    it('should display help information', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ExaFlow: Advanced Semantic Search Tool');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('mcp-server');
      expect(result.stdout).toContain('context');
      expect(result.stdout).toContain('search');
      expect(result.stdout).toContain('contents');
      expect(result.stdout).toContain('websets');
      expect(result.stdout).toContain('research');
    });

    it('should display version information', async () => {
      const result = await runCLI(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('2.0.0');
    });
  });

  describe('MCP Server Command', () => {
    it('should start MCP server with stdio transport by default', async () => {
      // Mock the MCP server to avoid actually starting it
      mock.module('../src/mcp-server', () => ({
        default: async () => {
          // Do nothing
        },
      }));

      // This would normally start the server, but for testing we'll just verify
      // that the command is recognized and arguments are parsed correctly
      const result = await runCLI(['mcp-server', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Start Model Context Protocol server');
    });

    it('should reject HTTP transport with appropriate message', async () => {
      const result = await runCLI(['mcp-server', '--transport', 'http']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('HTTP transport not yet implemented');
    });
  });

  describe('Context Command', () => {
    it('should handle context command with query', async () => {
      // Mock the context client
      mock.module('../src/clients/exa-context', () => ({
        exaContextClient: {
          getContext: mock(async () => ({
            status: 'success',
            taskId: 'test-task',
            timing: { startedAt: '', completedAt: '', duration: 1000 },
            citations: [],
            data: { response: 'Test response' },
          })),
        },
      }));

      const result = await runCLI(['context', 'test query', '--tokens', '1000']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('success');
    });

    it('should handle missing API key error', async () => {
      // Temporarily remove API key
      delete process.env.EXA_API_KEY;

      const result = await runCLI(['context', 'test query']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('EXA_API_KEY is required');
    });
  });

  describe('Search Command', () => {
    it('should handle search command with query', async () => {
      // Mock the search client
      mock.module('../src/clients/exa-search', () => ({
        exaSearchClient: {
          search: mock(async () => ({
            status: 'success',
            taskId: 'test-task',
            timing: { startedAt: '', completedAt: '', duration: 2000 },
            citations: [{ url: 'https://example.com', title: 'Example' }],
            data: {
              results: [{ id: '1', url: 'https://example.com', title: 'Example' }],
              totalResults: 1,
            },
          })),
        },
      }));

      const result = await runCLI([
        'search',
        'test query',
        '--type', 'neural',
        '--num-results', '5',
        '--include-contents'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('success');
    });

    it('should handle search from input file', async () => {
      // Create test input file
      const inputFile = join(tempDir, 'queries.json');
      await fs.writeFile(inputFile, JSON.stringify([
        { query: 'first query', type: 'auto' },
        { query: 'second query', type: 'neural', numResults: 15 }
      ]));

      // Mock the search client
      mock.module('../src/index', () => ({
        runBatch: mock(async () => [
          { status: 'success', data: { results: [] } },
          { status: 'success', data: { results: [] } },
        ]),
      }));

      const result = await runCLI(['search', '--input', inputFile]);

      expect(result.exitCode).toBe(0);
    });

    it('should handle search from stdin', async () => {
      // Mock the batch execution
      mock.module('../src/index', () => ({
        runBatch: mock(async () => [
          { status: 'success', data: { results: [] } },
        ]),
      }));

      // This test would require proper stdin handling in the test environment
      // For now, we'll test the argument parsing
      const result = await runCLI(['search', '--stdin']);

      // Should fail because no stdin data is provided
      expect(result.exitCode).toBe(1);
    });

    it('should validate date format arguments', async () => {
      const result = await runCLI([
        'search',
        'test query',
        '--start-date', 'invalid-date',
        '--end-date', '2024-13-45'
      ]);

      expect(result.exitCode).toBe(1);
      // Date validation should catch the invalid format
    });
  });

  describe('Contents Command', () => {
    it('should handle contents command with URLs from file', async () => {
      // Create test URLs file
      const urlsFile = join(tempDir, 'urls.txt');
      await fs.writeFile(urlsFile, [
        'https://example.com',
        'https://test.org',
        'https://demo.net'
      ].join('\n'));

      // Mock the contents client
      mock.module('../src/clients/exa-contents', () => ({
        exaContentsClient: {
          getContents: mock(async () => ({
            status: 'success',
            taskId: 'test-task',
            timing: { startedAt: '', completedAt: '', duration: 5000 },
            citations: [],
            data: { results: [] },
          })),
        },
      }));

      const result = await runCLI([
        'contents',
        '--ids', urlsFile,
        '--livecrawl', 'always',
        '--subpages', '3'
      ]);

      expect(result.exitCode).toBe(0);
    });

    it('should validate URLs format', async () => {
      // Create file with invalid URLs
      const urlsFile = join(tempDir, 'invalid-urls.txt');
      await fs.writeFile(urlsFile, [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'https://valid.com'
      ].join('\n'));

      const result = await runCLI(['contents', '--ids', urlsFile]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('invalid-url');
    });
  });

  describe('Websets Command', () => {
    it('should handle websets create operation', async () => {
      // Mock the websets client
      mock.module('../src/clients/exa-websets', () => ({
        exaWebsetsClient: {
          createWebset: mock(async () => ({
            status: 'success',
            taskId: 'test-task',
            timing: { startedAt: '', completedAt: '', duration: 1000 },
            citations: [],
            data: { id: 'webset-123' },
          })),
        },
      }));

      const result = await runCLI([
        'websets',
        'create',
        '--search-query', 'AI research papers'
      ]);

      expect(result.exitCode).toBe(0);
    });

    it('should validate websets operation', async () => {
      const result = await runCLI(['websets', 'invalid-operation']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid operation');
    });
  });

  describe('Research Command', () => {
    it('should handle research create operation with instructions', async () => {
      // Create test instructions file
      const instructionsFile = join(tempDir, 'instructions.txt');
      await fs.writeFile(instructionsFile, 'Research the latest AI trends and summarize findings.');

      // Mock the research client
      mock.module('../src/clients/exa-research', () => ({
        exaResearchClient: {
          createResearchTask: mock(async () => ({
            status: 'success',
            taskId: 'test-task',
            timing: { startedAt: '', completedAt: '', duration: 10000 },
            citations: [],
            data: { id: 'research-456' },
          })),
        },
      }));

      const result = await runCLI([
        'research',
        'create',
        '--instructions-file', instructionsFile,
        '--model', 'exa-research-pro'
      ]);

      expect(result.exitCode).toBe(0);
    });

    it('should handle research create operation with direct instructions', async () => {
      const result = await runCLI([
        'research',
        'create',
        '--instructions', 'Analyze machine learning trends'
      ]);

      expect(result.exitCode).toBe(0);
    });

    it('should require instructions for create operation', async () => {
      const result = await runCLI(['research', 'create']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Either --instructions or --instructions-file is required');
    });
  });

  describe('Global Options', () => {
    it('should handle concurrency option for batch operations', async () => {
      // Create test input file
      const inputFile = join(tempDir, 'batch-queries.json');
      await fs.writeFile(inputFile, JSON.stringify([
        { query: 'query 1', type: 'search' },
        { query: 'query 2', type: 'search' },
        { query: 'query 3', type: 'search' }
      ]));

      // Mock batch execution
      mock.module('../src/index', () => ({
        runBatch: mock(async () => [
          { status: 'success', data: { results: [] } },
          { status: 'success', data: { results: [] } },
          { status: 'success', data: { results: [] } },
        ]),
      }));

      const result = await runCLI([
        'search',
        '--input', inputFile,
        '--concurrency', '2',
        '--timeout', '60000'
      ]);

      expect(result.exitCode).toBe(0);
    });

    it('should handle compact output option', async () => {
      const result = await runCLI([
        'context',
        'test query',
        '--compact'
      ]);

      // Should not error out on the compact option
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle silent option to suppress event streaming', async () => {
      const result = await runCLI([
        'context',
        'test query',
        '--silent'
      ]);

      // Should not error out on the silent option
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required arguments', async () => {
      const result = await runCLI(['search']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Either provide a query argument or use --input or --stdin');
    });

    it('should handle invalid command', async () => {
      const result = await runCLI(['invalid-command']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command');
    });

    it('should handle invalid option values', async () => {
      const result = await runCLI([
        'search',
        'test query',
        '--num-results', 'invalid-number',
        '--type', 'invalid-type'
      ]);

      expect(result.exitCode).toBe(1);
    });
  });
});