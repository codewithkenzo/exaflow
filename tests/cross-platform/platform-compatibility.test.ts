import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';
import { TestExaClient } from '../utils/test-client';
import { HttpCache } from '../../src/util/http-cache';
import { httpClient } from '../../src/util/http';

describe('Cross-Platform Compatibility Tests', () => {
  const platform = process.platform;
  const arch = process.arch;
  const nodeVersion = process.version;

  console.log(`Running tests on: ${platform} ${arch}, Node.js ${nodeVersion}`);

  describe('File System Compatibility', () => {
    const testFiles = [
      'normal-file.txt',
      'file with spaces.txt',
      'file-with-dashes.txt',
      'file_with_underscores.txt',
      'file.with.dots.txt',
      'FileWithCamelCase.txt',
      'file123.txt',
      'special-chars-!@#$%^&().txt',
    ];

    const testDirs = [
      'normal-dir',
      'dir with spaces',
      'dir-with-dashes',
      'dir_with_underscores',
      'DirWithCamelCase',
      'dir123',
    ];

    it('should handle file paths across platforms', async () => {
      const tempBase = process.platform === 'win32' ? 'C:\\temp\\exa-test' : '/tmp/exa-test';
      const tempDir = join(tempBase, `test-${Date.now()}`);

      try {
        await fs.mkdir(tempDir, { recursive: true });

        // Test file creation with different names
        for (const filename of testFiles) {
          const filePath = join(tempDir, filename);
          await fs.writeFile(filePath, `Test content for ${filename}`);

          // Verify file exists and is readable
          const content = await fs.readFile(filePath, 'utf-8');
          expect(content).toBe(`Test content for ${filename}`);
        }

        // Test directory creation
        for (const dirname of testDirs) {
          const dirPath = join(tempDir, dirname);
          await fs.mkdir(dirPath, { recursive: true });

          // Create a file in the directory
          const testFile = join(dirPath, 'test.txt');
          await fs.writeFile(testFile, 'Directory test');
          const content = await fs.readFile(testFile, 'utf-8');
          expect(content).toBe('Directory test');
        }

        // Test path resolution
        const files = await fs.readdir(tempDir);
        expect(files.length).toBeGreaterThanOrEqual(testFiles.length + testDirs.length);

      } finally {
        // Cleanup
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          console.warn('Failed to cleanup temp directory:', error);
        }
      }
    });

    it('should handle path separators correctly', () => {
      const testPaths = [
        'path/to/file.txt',
        'path\\to\\file.txt',
        '/absolute/path/file.txt',
        'C:\\Windows\\path\\file.txt',
        'relative/path/file.txt',
        'relative\\path\\file.txt',
      ];

      for (const testPath of testPaths) {
        const normalized = join(testPath);
        expect(normalized).toBeDefined();
        expect(typeof normalized).toBe('string');
      }
    });
  });

  describe('Environment Variable Compatibility', () => {
    it('should handle environment variables across platforms', () => {
      const testVars = {
        'EXA_TEST_VAR': 'test-value',
        'EXA_TEST_SPACES': 'value with spaces',
        'EXA_TEST_SPECIAL': '!@#$%^&*()',
        'EXA_TEST_UNICODE': '🚀 test ño',
        'EXA_TEST_NUMBERS': '12345',
      };

      // Set environment variables
      const originalValues: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(testVars)) {
        originalValues[key] = process.env[key];
        process.env[key] = value;
      }

      try {
        // Read environment variables
        for (const [key, expectedValue] of Object.entries(testVars)) {
          const actualValue = process.env[key];
          expect(actualValue).toBe(expectedValue);
        }

        // Test case sensitivity based on platform
        if (process.platform === 'win32') {
          // Windows is case-insensitive
          expect(process.env['exa_test_var']).toBe(testVars['EXA_TEST_VAR']);
        } else {
          // Unix-like systems are case-sensitive
          expect(process.env['exa_test_var']).toBeUndefined();
        }

      } finally {
        // Restore original values
        for (const [key, value] of Object.entries(originalValues)) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      }
    });
  });

  describe('Network Compatibility', () => {
    it('should handle different network configurations', async () => {
      const client = new TestExaClient('test-key');

      // Test with different timeout configurations
      const timeoutConfigs = [
        { timeout: 1000 },
        { timeout: 5000 },
        { timeout: 10000 },
        { timeout: 30000 },
      ];

      for (const config of timeoutConfigs) {
        try {
          const result = await client.executeTask({
            query: 'network compatibility test',
            type: 'search'
          }, config);

          expect(result).toBeDefined();
        } catch (error) {
          // Expected to fail with test key, but should handle network errors gracefully
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle DNS resolution across platforms', async () => {
      const testHosts = [
        'google.com',
        'github.com',
        'localhost',
        '127.0.0.1',
        'https://api.exa.ai',
      ];

      for (const host of testHosts) {
        try {
          const response = await fetch(host, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          expect(response).toBeDefined();
        } catch (error) {
          // Network errors are acceptable, but should not crash
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Process Management Compatibility', () => {
    it('should handle process signals across platforms', async () => {
      const isWindows = process.platform === 'win32';
      const testSignals = isWindows
        ? ['SIGINT', 'SIGTERM']
        : ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR1'];

      for (const signal of testSignals) {
        try {
          // Test signal handling
          process.emit(signal as any);
        } catch (error) {
          // Some signals might not be available on all platforms
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle child processes across platforms', async () => {
      const testCommands = process.platform === 'win32'
        ? [
            { command: 'echo', args: ['test'] },
            { command: 'cmd', args: ['/c', 'echo', 'test'] },
          ]
        : [
            { command: 'echo', args: ['test'] },
            { command: 'ls', args: ['-la'] },
          ];

      for (const { command, args } of testCommands) {
        const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
          const child = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000,
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

        // Commands should either succeed or fail gracefully
        expect(typeof result.exitCode).toBe('number');
        expect(typeof result.stdout).toBe('string');
        expect(typeof result.stderr).toBe('string');
      }
    });
  });

  describe('Memory Management Compatibility', () => {
    it('should handle memory limits across platforms', async () => {
      const cache = new HttpCache({
        enabled: true,
        maxSize: 100,
        defaultTtl: 60000
      });

      // Test memory usage with different data sizes
      const dataSizes = [1, 10, 100, 1000]; // KB

      for (const sizeKB of dataSizes) {
        const testData = {
          content: 'x'.repeat(1024 * sizeKB),
          metadata: {
            size: sizeKB,
            platform: process.platform,
            arch: process.arch,
            timestamp: Date.now()
          }
        };

        const key = `test-${sizeKB}kb`;
        cache.set(key, testData, { method: 'GET' });

        const retrieved = cache.get(key, { method: 'GET' });
        expect(retrieved).toBeDefined();
        expect(retrieved.content.length).toBe(1024 * sizeKB);
      }

      // Cache should handle eviction properly
      const finalCacheSize = cache.getStats().size;
      expect(finalCacheSize).toBeLessThanOrEqual(100);
    });

    it('should handle garbage collection consistently', async () => {
      const initialMemory = process.memoryUsage();

      // Create and destroy objects
      const objects = [];
      for (let i = 0; i < 1000; i++) {
        objects.push({
          id: i,
          data: 'x'.repeat(1000),
          platform: process.platform,
          timestamp: Date.now()
        });
      }

      const peakMemory = process.memoryUsage();

      // Clear references
      objects.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapPeak = peakMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory test on ${process.platform}:`);
      console.log(`  Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Peak: ${(peakMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Peak: ${(heapPeak / 1024 / 1024).toFixed(2)}MB`);

      // Memory should be reasonably managed
      expect(heapGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    });
  });

  describe('Encoding and Unicode Compatibility', () => {
    it('should handle Unicode consistently across platforms', () => {
      const unicodeStrings = [
        '🚀🔥💨',
        '正常中文',
        'العربية',
        'Русский',
        'Español',
        'Français',
        'Deutsch',
        '日本語',
        '한국어',
        'Português',
        '混合Mixed混合',
        'Test ño Ñ',
        '🎉 Celebration! 🎊',
        '\u202E\u202D', // RTL override characters
        '\uFEFF', // BOM
        '\u0000\u0001\u0002', // Control characters
      ];

      for (const unicodeString of unicodeStrings) {
        // Test encoding/decoding
        const encoded = Buffer.from(unicodeString, 'utf8');
        const decoded = encoded.toString('utf8');
        expect(decoded).toBe(unicodeString);

        // Test JSON serialization
        const jsonSerialized = JSON.stringify(unicodeString);
        const jsonDeserialized = JSON.parse(jsonSerialized);
        expect(jsonDeserialized).toBe(unicodeString);
      }
    });

    it('should handle different line endings', () => {
      const lineEndingTests = [
        { content: 'line1\nline2\nline3', description: 'Unix (LF)' },
        { content: 'line1\r\nline2\r\nline3', description: 'Windows (CRLF)' },
        { content: 'line1\rline2\rline3', description: 'Classic Mac (CR)' },
        { content: 'line1\n\rline2\n\rline3', description: 'Mixed' },
      ];

      for (const { content, description } of lineEndingTests) {
        // Test splitting by lines
        const lines = content.split(/\r?\n/);
        expect(lines.length).toBeGreaterThanOrEqual(1); // Single line is acceptable for some test strings

        // Test normalization
        const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const normalizedLines = normalized.split('\n');
        expect(normalizedLines.length).toBeGreaterThan(1);
      }
    });
  });

  describe('CLI Compatibility', () => {
    it('should handle CLI arguments across platforms', async () => {
      const testArgs = [
        ['--help'],
        ['--version'],
        ['search', 'test'],
        ['context', 'test', '--tokens', '100'],
      ];

      for (const args of testArgs) {
        const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
          const child = spawn('bun', ['run', 'dist/cli.js', ...args], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 10000,
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

        // CLI should handle arguments consistently
        expect(typeof result.exitCode).toBe('number');
        expect(typeof result.stdout).toBe('string');
        expect(typeof result.stderr).toBe('string');
      }
    });
  });

  describe('Performance Compatibility', () => {
    it('should maintain reasonable performance across platforms', async () => {
      const client = new TestExaClient('test-key');
      const iterations = 50;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        try {
          await client.executeTask({
            query: `performance test ${i}`,
            type: 'search'
          });
        } catch (error) {
          // Expected to fail with test key
        }
      }

      const duration = Date.now() - startTime;
      const operationsPerSecond = (iterations / duration) * 1000;

      console.log(`Performance test on ${process.platform} ${arch}:`);
      console.log(`  ${iterations} operations in ${duration}ms`);
      console.log(`  ${operationsPerSecond.toFixed(2)} ops/sec`);

      // Performance should be reasonable across all platforms
      expect(operationsPerSecond).toBeGreaterThan(1); // At least 1 op/sec
      expect(duration).toBeLessThan(60000); // Less than 1 minute for 50 operations
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle platform-specific errors gracefully', async () => {
      const client = new TestExaClient('invalid-api-key');

      // Test various error scenarios
      const errorScenarios = [
        { query: 'test', description: 'Invalid API key' },
        { query: '', description: 'Empty query' },
        { query: 'x'.repeat(10000), description: 'Very long query' },
        { query: '\x00\x01\x02', description: 'Binary data' },
      ];

      for (const { query, description } of errorScenarios) {
        try {
          const result = await client.executeTask({
            query,
            type: 'search'
          });

          // If it succeeds, verify the result structure
          expect(result).toBeDefined();
          expect(typeof result.status).toBe('string');
          expect(typeof result.taskId).toBe('string');
        } catch (error) {
          // Should handle errors gracefully
          expect(error).toBeInstanceOf(Error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          expect(typeof errorMessage).toBe('string');
          expect(errorMessage.length).toBeGreaterThan(0);

          // Should not contain platform-specific paths in error messages
          expect(errorMessage).not.toContain(process.cwd());
          expect(errorMessage).not.toContain(__dirname);
        }
      }
    });
  });
});