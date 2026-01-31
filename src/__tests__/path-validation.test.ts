import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SandboxedFileSystem, FileSystemError } from '../util/fs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Path Validation Security', () => {
  let testDir: string;
  let fsSandbox: SandboxedFileSystem;

  beforeAll(() => {
    testDir = path.join(__dirname, `test-sandbox-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    fsSandbox = new SandboxedFileSystem([testDir]);
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Path Traversal Prevention', () => {
    it('should allow paths within sandbox', () => {
      // Use paths that resolve to the testDir
      expect(() => fsSandbox.validatePath(testDir)).not.toThrow();
    });

    it('should block simple traversal with ..', () => {
      expect(() => fsSandbox.validatePath('../etc/passwd')).toThrow(FileSystemError);
      expect(() => fsSandbox.validatePath('foo/../../../etc/passwd')).toThrow(FileSystemError);
      expect(() => fsSandbox.validatePath(path.join(testDir, '../outside'))).toThrow(FileSystemError);
    });

    it('should block traversal with tilde ~', () => {
      expect(() => fsSandbox.validatePath('~/config')).toThrow(FileSystemError);
    });

    it('should block absolute paths outside sandbox', () => {
      expect(() => fsSandbox.validatePath('/etc/passwd')).toThrow(FileSystemError);
      expect(() => fsSandbox.validatePath('/home/user/.ssh')).toThrow(FileSystemError);
    });

    it('should block paths that escape after normalization', () => {
      expect(() => fsSandbox.validatePath(path.join(testDir, 'foo/../bar/../../etc/passwd'))).toThrow(FileSystemError);
    });
  });

  describe('URL-Encoded Path Prevention', () => {
    it('should block URL-encoded traversal sequences', () => {
      expect(() => fsSandbox.validatePath('..%2F..%2Fetc%2Fpasswd')).toThrow(FileSystemError);
      expect(() => fsSandbox.validatePath('%2e%2e%2f%2e%2e%2fetc%2fpasswd')).toThrow(FileSystemError);
      expect(() => fsSandbox.validatePath('%2e%2e%2f%2e%2e%2f%2e%2e%2fshadow')).toThrow(FileSystemError);
    });

    it('should block double-encoded traversal', () => {
      expect(() => fsSandbox.validatePath('%252e%252e%252fetc%252fpasswd')).toThrow(FileSystemError);
    });

    it('should decode URL-encoded filenames within sandbox', () => {
      // Create a file with URL-encoded name and test with that path
      const encodedFile = path.join(testDir, 'file%20with%20spaces.txt');
      fs.writeFileSync(encodedFile, 'content');
      expect(() => fsSandbox.validatePath(encodedFile)).not.toThrow();
    });
  });

  describe('Symbolic Link Protection', () => {
    it('should block symlinks pointing outside allowed directory', () => {
      const outsideDir = path.join(__dirname, `outside-${Date.now()}`);
      const symlinkPath = path.join(testDir, 'malicious-link');

      fs.mkdirSync(outsideDir, { recursive: true });
      fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'sensitive data');

      try {
        fs.symlinkSync(path.join(outsideDir, 'secret.txt'), symlinkPath);
        expect(() => fsSandbox.validatePath(symlinkPath)).toThrow(FileSystemError);
      } finally {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('should allow symlinks within allowed directory', () => {
      const targetDir = path.join(testDir, 'links');
      fs.mkdirSync(targetDir, { recursive: true });
      const targetFile = path.join(targetDir, 'target.txt');
      fs.writeFileSync(targetFile, 'original content');

      const symlinkPath = path.join(testDir, 'safe-link');
      fs.symlinkSync(targetFile, symlinkPath);

      expect(() => fsSandbox.validatePath(symlinkPath)).not.toThrow();
    });
  });

  describe('Null Byte and Control Character Prevention', () => {
    it('should block paths with null bytes', () => {
      expect(() => fsSandbox.validatePath('file\x00name.txt')).toThrow(FileSystemError);
    });

    it('should block paths with control characters', () => {
      expect(() => fsSandbox.validatePath('file\nname.txt')).toThrow(FileSystemError);
      expect(() => fsSandbox.validatePath('file\rname.txt')).toThrow(FileSystemError);
    });
  });

  describe('Windows Path Handling', () => {
    it('should block Windows absolute paths', () => {
      expect(() => fsSandbox.validatePath('C:\\Windows\\System32')).toThrow(FileSystemError);
    });

    it('should block Windows-style traversal', () => {
      expect(() => fsSandbox.validatePath('..\\pass\\..\\etcwd')).toThrow(FileSystemError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle consecutive slashes', () => {
      expect(() => fsSandbox.validatePath(testDir + '//file.txt')).not.toThrow();
    });

    it('should handle trailing slashes', () => {
      expect(() => fsSandbox.validatePath(testDir + '/file.txt/')).not.toThrow();
    });

    it('should handle current directory reference', () => {
      expect(() => fsSandbox.validatePath(path.join(testDir, './file.txt'))).not.toThrow();
      expect(() => fsSandbox.validatePath(path.join(testDir, './../etc/passwd'))).toThrow(FileSystemError);
    });
  });
});
