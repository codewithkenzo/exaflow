import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  SandboxedFileSystem,
  FileSystemError,
  fs,
} from '../../src/util/fs';

describe('SandboxedFileSystem', () => {
  let sandbox: SandboxedFileSystem;
  let testDir: string;
  let testFilePath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), 'exaflow-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    testFilePath = join(testDir, 'test.txt');
    sandbox = new SandboxedFileSystem([testDir], 1024 * 1024);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with provided allowed paths', () => {
      const paths = sandbox.getAllowedPaths();
      expect(paths).toContain(testDir);
    });

    it('should initialize with default max file size', () => {
      const defaultSandbox = new SandboxedFileSystem();
      expect(defaultSandbox.getMaxFileSize()).toBe(10 * 1024 * 1024);
    });
  });

  describe('path validation', () => {
    it('should allow access within allowed directory', async () => {
      writeFileSync(testFilePath, 'test content');
      const content = await sandbox.readFile(testFilePath);
      expect(content).toBe('test content');
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        sandbox.readFile(testDir + '/../secret.txt')
      ).rejects.toThrow(FileSystemError);
    });

    it('should reject double dot path traversal', async () => {
      await expect(
        sandbox.readFile(testDir + '/subdir/../../etc/passwd')
      ).rejects.toThrow(FileSystemError);
    });

    it('should reject tilde paths', async () => {
      await expect(
        sandbox.readFile(testDir + '/~/config')
      ).rejects.toThrow(FileSystemError);
    });

    it('should reject null bytes in path', async () => {
      await expect(
        sandbox.readFile(testDir + '/file\x00name')
      ).rejects.toThrow(FileSystemError);
    });

    it('should reject control characters in path', async () => {
      await expect(
        sandbox.readFile(testDir + '/file\x01name')
      ).rejects.toThrow(FileSystemError);
    });

    it('should reject paths outside allowed boundaries', async () => {
      await expect(
        sandbox.readFile('/etc/passwd')
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      writeFileSync(testFilePath, 'Hello, World!');
      const content = await sandbox.readFile(testFilePath);
      expect(content).toBe('Hello, World!');
    });

    it('should reject files exceeding max size', async () => {
      const largeContent = 'x'.repeat(2000);
      writeFileSync(testFilePath, largeContent);
      await expect(sandbox.readFile(testFilePath)).rejects.toThrow(FileSystemError);
    });

    it('should reject reading directories', async () => {
      await expect(sandbox.readFile(testDir)).rejects.toThrow(FileSystemError);
    });
  });

  describe('writeFile', () => {
    it('should write file content', async () => {
      await sandbox.writeFile(testFilePath, 'New content');
      const content = readFileSync(testFilePath, 'utf8');
      expect(content).toBe('New content');
    });

    it('should create parent directories', async () => {
      const nestedPath = join(testDir, 'nested', 'deep', 'file.txt');
      await sandbox.writeFile(nestedPath, 'content');
      const content = readFileSync(nestedPath, 'utf8');
      expect(content).toBe('content');
    });

    it('should reject files exceeding max size', async () => {
      const largeContent = 'x'.repeat(2000);
      await expect(sandbox.writeFile(testFilePath, largeContent)).rejects.toThrow(FileSystemError);
    });
  });

  describe('getFileInfo', () => {
    it('should return file information', async () => {
      writeFileSync(testFilePath, 'test');
      const info = await sandbox.getFileInfo(testFilePath);
      expect(info.path).toBe(testFilePath);
      expect(info.size).toBe(4);
      expect(info.isDirectory).toBe(false);
    });

    it('should identify directories', async () => {
      const info = await sandbox.getFileInfo(testDir);
      expect(info.isDirectory).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      writeFileSync(testFilePath, 'test');
      const exists = await sandbox.exists(testFilePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      const exists = await sandbox.exists(join(testDir, 'nonexistent.txt'));
      expect(exists).toBe(false);
    });
  });

  describe('readJson', () => {
    it('should parse valid JSON', async () => {
      writeFileSync(testFilePath, '{"key": "value"}');
      const result = await sandbox.readJson(testFilePath);
      expect(result).toEqual({ key: 'value' });
    });

    it('should reject JSON with prototype pollution', async () => {
      writeFileSync(testFilePath, '{"__proto__": {"admin": true}}');
      await expect(sandbox.readJson(testFilePath)).rejects.toThrow(FileSystemError);
    });
  });

  describe('FileSystemError', () => {
    it('should have correct properties', () => {
      const error = new FileSystemError('Test error', 'TEST_CODE', '/path');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.path).toBe('/path');
      expect(error.name).toBe('FileSystemError');
    });
  });
});

describe('Global fs instance', () => {
  it('should be an instance of SandboxedFileSystem', () => {
    expect(fs).toBeInstanceOf(SandboxedFileSystem);
  });
});
