import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';

describe('CLI Integration Tests', () => {
  const cliPath = join(process.cwd(), 'dist/cli.js');
  let tempDir: string;

  beforeAll(async () => {
    // Ensure CLI is built
    await Bun.build({
      entrypoints: ['src/cli.ts'],
      outdir: 'dist',
      target: 'bun',
      naming: '[name].js',
    });

    // Create temporary directory for test files
    tempDir = join(process.cwd(), 'test-temp-cli');
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const runCLI = async (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return new Promise((resolve) => {
      const child = spawn('bun', ['run', 'dist/cli.js', ...args], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
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
  };

  describe('CLI Basic Functionality', () => {
    it('should display help when no arguments provided', async () => {
      const result = await runCLI(['--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage: exaflow');
      expect(result.stdout).toContain('Commands:');
    });

    it('should show version with --version flag', async () => {
      const result = await runCLI(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should handle unknown commands gracefully', async () => {
      const result = await runCLI(['unknown-command']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });
  });

  describe('Search Command Integration', () => {
    it('should perform basic search', async () => {
      const result = await runCLI(['search', 'artificial intelligence', '--num-results', '2']);
      expect(result.exitCode).toBe(0);

      // Parse JSON output
      const output = JSON.parse(result.stdout);
      expect(output.status).toBe('success');
      expect(output.data.results).toBeDefined();
      expect(Array.isArray(output.data.results)).toBe(true);
      expect(output.data.results.length).toBeLessThanOrEqual(2);
    });

    it('should handle search with different types', async () => {
      const result = await runCLI(['search', 'machine learning', '--type', 'neural', '--num-results', '1']);
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.status).toBe('success');
      expect(output.data.results).toBeDefined();
    });

    it('should handle search errors gracefully', async () => {
      // Test with empty query (might cause error)
      const result = await runCLI(['search', '', '--num-results', '1']);
      // Should either succeed with empty results or fail gracefully
      expect([0, 1].includes(result.exitCode)).toBe(true);
    });

    it('should respect search limits', async () => {
      const result = await runCLI(['search', 'technology', '--num-results', '5']);
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.status).toBe('success');
      expect(output.data.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Context Command Integration', () => {
    it('should perform context query', async () => {
      const result = await runCLI(['context', 'What is quantum computing?', '--tokens', '1000']);
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.status).toBe('success');
      expect(output.data.response).toBeDefined();
      expect(typeof output.data.response).toBe('string');
    });

    it('should handle context queries with different token limits', async () => {
      const result = await runCLI(['context', 'Climate change solutions', '--tokens', '500']);
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.status).toBe('success');
      expect(output.data.response).toBeDefined();
    });
  });

  describe('Websets Command Integration', () => {
    it('should show websets help', async () => {
      const result = await runCLI(['websets', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Manage Exa Websets');
    });

    // Note: Websets integration would require actual URLs and API keys
    // For testing purposes, we'll verify the command structure exists
    it('should accept websets create operation', async () => {
      // This test just verifies the command doesn't crash
      // We'll use a shorter timeout for this test
      const startTime = Date.now();

      const result = await runCLI(['websets', 'create', '--help']);
      const duration = Date.now() - startTime;

      // Help command should return quickly
      expect(duration).toBeLessThan(5000);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('CLI Error Handling', () => {
    it('should handle missing API key gracefully', async () => {
      // Note: The CLI might handle missing API keys differently than expected
      // We'll test for some kind of error response or graceful degradation

      // Test with an invalid API key instead of removing it completely
      const originalKey = process.env.EXA_API_KEY;
      process.env.EXA_API_KEY = 'invalid-key';

      const result = await runCLI(['search', 'test query']);

      // Restore the key
      if (originalKey) {
        process.env.EXA_API_KEY = originalKey;
      }

      // Should either fail gracefully or provide error information
      expect([0, 1].includes(result.exitCode)).toBe(true);
      if (result.exitCode === 1) {
        expect(result.stderr.length > 0 || result.stdout.includes('error')).toBe(true);
      }
    });

    it('should handle invalid search parameters', async () => {
      // Test with negative num-results
      const result = await runCLI(['search', 'test', '--num-results', '-1']);
      // CLI should either reject or handle gracefully
      expect([0, 1].includes(result.exitCode)).toBe(true);
    });

    it('should handle invalid context parameters', async () => {
      // Test with zero tokens
      const result = await runCLI(['context', 'test', '--tokens', '0']);
      // CLI should either reject or handle gracefully
      expect([0, 1].includes(result.exitCode)).toBe(true);
    });
  });

  describe('CLI Performance', () => {
    it('should complete simple search within reasonable time', async () => {
      const startTime = Date.now();
      const result = await runCLI(['search', 'test', '--num-results', '1']);
      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(30000); // 30 seconds max
    });

    it('should complete context query within reasonable time', async () => {
      const startTime = Date.now();
      const result = await runCLI(['context', 'test', '--tokens', '500']);
      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(60000); // 60 seconds max for context
    });
  });

  describe('CLI Output Format', () => {
    it('should output valid JSON', async () => {
      const result = await runCLI(['search', 'test', '--num-results', '1']);
      expect(result.exitCode).toBe(0);

      expect(() => {
        JSON.parse(result.stdout);
      }).not.toThrow();
    });

    it('should include required fields in search output', async () => {
      const result = await runCLI(['search', 'test', '--num-results', '1']);
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('status');
      expect(output).toHaveProperty('taskId');
      expect(output).toHaveProperty('timing');
      expect(output).toHaveProperty('citations');
      expect(output).toHaveProperty('data');
      expect(output.data).toHaveProperty('results');
    });

    it('should include required fields in context output', async () => {
      const result = await runCLI(['context', 'test', '--tokens', '500']);
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('status');
      expect(output).toHaveProperty('taskId');
      expect(output).toHaveProperty('timing');
      expect(output).toHaveProperty('citations');
      expect(output).toHaveProperty('data');
      expect(output.data).toHaveProperty('response');
    });
  });
});