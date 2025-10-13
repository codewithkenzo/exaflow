---
title: "🔒 Medium Security: Path Traversal Vulnerability in File System Validation"
labels: ["security", "medium", "path-traversal", "file-system"]
assignees: []
---

## 🔒 Medium Security Vulnerability: Path Traversal in File System Access

### 🚨 **Severity: Medium**
- **CVSS Score**: 6.5 (Medium)
- **CWE**: CWE-22: Path Traversal
- **File**: `src/util/fs.ts:42-50`
- **Impact: Unauthorized File Access, Information Disclosure, System Compromise**

### 📍 **Location**
```typescript
// File: src/util/fs.ts
// Lines: 42-50
private validatePath(path: string): string {
  const resolvedPath = resolve(path);

  // Check if the path is within allowed boundaries
  for (const allowedPath of this.allowedPaths) {
    if (resolvedPath.startsWith(allowedPath)) {  // ❌ SECURITY ISSUE
      return resolvedPath;
    }
  }

  throw new FileSystemError(
    `Path ${path} is outside allowed workspace boundaries`,
    "PATH_VIOLATION",
    path
  );
}
```

### 🎯 **Impact Assessment**

1. **Path Traversal Bypass**:
   - `startsWith()` check can be bypassed with crafted paths
   - Attackers can access files outside intended directories
   - Potential access to sensitive system files

2. **Information Disclosure**:
   - Unauthorized reading of configuration files
   - Access to logs, temporary files, or backups
   - Potential exposure of credentials or secrets

3. **File System Abuse**:
   - Writing files to unintended locations
   - Overwriting system configuration files
   - Potential for privilege escalation

### 🔍 **Technical Details**

The vulnerability occurs in the `validatePath` method where path validation relies on `startsWith()` which can be bypassed:

**Bypass Scenarios:**
```javascript
// Scenario 1: Symbolic Link Bypass
allowedPath = "/home/user/project"
attackerPath = "/home/user/project/link-to-etc-passwd"
// resolvedPath starts with allowedPath but points outside

// Scenario 2: Case Sensitivity Bypass (on case-insensitive systems)
allowedPath = "/Users/project"
attackerPath = "/users/../etc/passwd"  // Resolves to /etc/passwd on Windows

// Scenario 3: Unicode Normalization Bypass
allowedPath = "/home/user/project"
attackerPath = "/home/user/proje\u030ct/../../etc/passwd"
// Unicode normalization bypass

// Scenario 4: Relative Path Bypass
allowedPath = "/home/user/project"
attackerPath = "/home/user/project/../../../etc/passwd"
// Normalized path starts with allowedPath but resolves outside
```

### 🛠️ **Recommended Remediation**

#### **Immediate Actions:**
1. **Implement robust path validation**:
```typescript
// ✅ Secure approach
import { resolve, relative, normalize } from 'path';
import { lstatSync, readlinkSync } from 'fs';

private validatePath(path: string): string {
  const resolvedPath = resolve(path);
  const normalizedPath = normalize(resolvedPath);

  // Check each allowed path with proper validation
  for (const allowedPath of this.allowedPaths) {
    const relativePath = relative(allowedPath, normalizedPath);

    // Ensure the path is within allowed boundaries
    if (!relativePath.startsWith('..') && !relativePath.startsWith('..\\')) {
      // Additional check: verify no symbolic link traversal
      if (!this.hasSymbolicLinkTraversal(normalizedPath, allowedPath)) {
        return normalizedPath;
      }
    }
  }

  throw new FileSystemError(
    `Path ${path} is outside allowed workspace boundaries`,
    "PATH_VIOLATION",
    path
  );
}

private hasSymbolicLinkTraversal(targetPath: string, basePath: string): boolean {
  try {
    // Check if any component of the path is a symbolic link
    const targetComponents = targetPath.split('/');
    const baseComponents = basePath.split('/');

    let currentPath = '/';

    for (const component of targetComponents) {
      if (!component) continue;

      currentPath = resolve(currentPath, component);

      // Check if current path is a symbolic link
      try {
        const stats = lstatSync(currentPath);
        if (stats.isSymbolicLink()) {
          const linkTarget = readlinkSync(currentPath);
          const resolvedLink = resolve(currentPath, '..', linkTarget);

          // Check if the symlink points outside the base path
          if (!resolvedLink.startsWith(basePath)) {
            return true; // Symbolic link traversal detected
          }
        }
      } catch (error) {
        // Continue if we can't stat the path
        continue;
      }
    }

    return false;
  } catch (error) {
    // On error, assume unsafe
    return true;
  }
}
```

2. **Use proper path normalization and validation**:
```typescript
// ✅ Enhanced security approach
import { resolve, normalize, sep } from 'path';

export class SecureFileSystemValidator {
  private readonly allowedPaths: Set<string>;

  constructor(allowedPaths: string[]) {
    this.allowedPaths = new Set(
      allowedPaths.map(path => normalize(resolve(path)))
    );
  }

  validatePath(path: string): string {
    if (!path || typeof path !== 'string') {
      throw new FileSystemError(
        'Invalid path provided',
        'INVALID_PATH',
        path
      );
    }

    // Normalize and resolve the input path
    const normalizedPath = normalize(path);
    const resolvedPath = resolve(normalizedPath);

    // Reject absolute paths that don't start with allowed paths
    const isAllowed = Array.from(this.allowedPaths).some(allowedPath => {
      // Get relative path from allowed path
      const relativePath = this.getRelativePath(allowedPath, resolvedPath);

      // Path is safe if it doesn't go up the directory tree
      return !this.containsDirectoryTraversal(relativePath);
    });

    if (!isAllowed) {
      throw new FileSystemError(
        `Path ${path} is outside allowed workspace boundaries`,
        "PATH_VIOLATION",
        path
      );
    }

    // Final security check
    this.validatePathComponents(resolvedPath);

    return resolvedPath;
  }

  private getRelativePath(from: string, to: string): string {
    const path = require('path');
    return path.relative(from, to);
  }

  private containsDirectoryTraversal(path: string): boolean {
    return path.includes('..') || path.includes('../') || path.includes('..\\');
  }

  private validatePathComponents(path: string): void {
    const components = path.split('/');

    for (const component of components) {
      // Reject suspicious components
      if (this.isSuspiciousComponent(component)) {
        throw new FileSystemError(
          `Path contains suspicious component: ${component}`,
          "SUSPICIOUS_PATH_COMPONENT",
          path
        );
      }
    }
  }

  private isSuspiciousComponent(component: string): boolean {
    const suspiciousPatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Invalid characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Reserved names (Windows)
    ];

    return suspiciousPatterns.some(pattern => pattern.test(component));
  }
}
```

3. **Implement file type and permission validation**:
```typescript
// ✅ Comprehensive file system security
import { statSync, constants } from 'fs';

export class SecureFileAccess {
  private readonly validator: SecureFileSystemValidator;
  private readonly allowedFileTypes: Set<string>;
  private readonly maxFileSize: number;

  constructor(
    allowedPaths: string[],
    allowedFileTypes: string[] = ['.json', '.txt', '.md'],
    maxFileSize: number = 10 * 1024 * 1024 // 10MB
  ) {
    this.validator = new SecureFileSystemValidator(allowedPaths);
    this.allowedFileTypes = new Set(allowedFileTypes);
    this.maxFileSize = maxFileSize;
  }

  async safeReadFile(path: string): Promise<string> {
    // Validate path
    const validatedPath = this.validator.validatePath(path);

    // Additional security checks
    await this.validateFileAccess(validatedPath);

    try {
      // Read file with additional safety checks
      const stats = statSync(validatedPath);

      if (!stats.isFile()) {
        throw new FileSystemError(
          'Path is not a file',
          'NOT_A_FILE',
          path
        );
      }

      if (stats.size > this.maxFileSize) {
        throw new FileSystemError(
          `File size exceeds maximum allowed size`,
          'FILE_TOO_LARGE',
          path
        );
      }

      // Check file extension
      const extension = require('path').extname(validatedPath).toLowerCase();
      if (!this.allowedFileTypes.has(extension)) {
        throw new FileSystemError(
          `File type ${extension} is not allowed`,
          'INVALID_FILE_TYPE',
          path
        );
      }

      // Safe file read
      return require('fs').readFileSync(validatedPath, 'utf8');
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }

      throw new FileSystemError(
        `Failed to read file: ${error.message}`,
        'READ_ERROR',
        path
      );
    }
  }

  private async validateFileAccess(path: string): Promise<void> {
    try {
      const stats = statSync(path);

      // Check file permissions
      if ((stats.mode & constants.S_IRGRP) || (stats.mode & constants.S_IROTH)) {
        // Log suspicious file access attempt
        securityLogger.logSecurityEvent('SUSPICIOUS_FILE_ACCESS', {
          path,
          permissions: stats.mode.toString(8),
          timestamp: new Date().toISOString()
        });
      }

      // Check if file is in sensitive locations
      const suspiciousPaths = [
        '/etc/passwd',
        '/etc/shadow',
        '/etc/hosts',
        process.env.HOME + '/.ssh',
        process.env.HOME + '/.aws'
      ];

      const normalizedPath = normalize(path);
      if (suspiciousPaths.some(suspicious => normalizedPath.includes(suspicious))) {
        securityLogger.logSecurityEvent('SENSITIVE_FILE_ACCESS', {
          path: normalizedPath,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      // If we can't stat the file, it's probably unsafe
      throw new FileSystemError(
        `Cannot validate file access: ${error.message}`,
        'ACCESS_VALIDATION_FAILED',
        path
      );
    }
  }
}
```

#### **Long-term Improvements:**
1. **Implement a sandboxed file system interface**:
```typescript
// File: src/util/sandboxed-fs.ts
export class SandboxedFileSystem {
  private readonly allowedPaths: Set<string>;
  private readonly fileAccessValidator: SecureFileAccess;

  constructor(allowedPaths: string[], options: SecureFSOptions = {}) {
    this.allowedPaths = new Set(allowedPaths.map(p => normalize(resolve(p))));
    this.fileAccessValidator = new SecureFileAccess(allowedPaths, options);
  }

  // Safe file operations with comprehensive validation
  async readFile(path: string, options: ReadOptions = {}): Promise<string> {
    return this.fileAccessValidator.safeReadFile(path);
  }

  async writeFile(path: string, content: string, options: WriteOptions = {}): Promise<void> {
    const validatedPath = this.fileAccessValidator.validatePath(path);

    // Additional write validation
    await this.validateWriteOperation(validatedPath, content);

    // Perform safe write operation
    require('fs').writeFileSync(validatedPath, content, 'utf8');
  }

  private async validateWriteOperation(path: string, content: string): Promise<void> {
    // Check content size
    if (content.length > this.maxFileSize) {
      throw new FileSystemError(
        'Content too large',
        'CONTENT_TOO_LARGE',
        path
      );
    }

    // Check for suspicious content
    if (this.containsSuspiciousContent(content)) {
      securityLogger.logSecurityEvent('SUSPICIOUS_CONTENT_WRITE', {
        path,
        contentHash: this.hashContent(content),
        timestamp: new Date().toISOString()
      });
    }
  }

  private containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /import.*os/i,
      /require.*fs/i,
      /eval\(/i,
      /exec\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  private hashContent(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

2. **Add comprehensive logging and monitoring**:
```typescript
// File: src/util/fs-monitor.ts
export class FileSystemMonitor {
  static logFileAccess(path: string, operation: 'read' | 'write', success: boolean): void {
    const logData = {
      path: this.sanitizePath(path),
      operation,
      success,
      timestamp: new Date().toISOString(),
      processId: process.pid,
      userId: process.getuid()
    };

    if (!success) {
      securityLogger.logSecurityEvent('FILE_ACCESS_FAILED', logData);
    } else {
      auditLogger.info('FILE_ACCESS', logData);
    }
  }

  private static sanitizePath(path: string): string {
    // Remove sensitive parts of path for logging
    return path
      .replace(/\/home\/[^\/]+/g, '/home/[USER]')
      .replace(/\/Users\/[^\/]+/g, '/Users/[USER]')
      .replace(/\/tmp\/[^\/]+/g, '/tmp/[TEMP]');
  }
}
```

### ✅ **Verification Steps**

1. **Test path traversal attempts**:
```bash
# Test with various traversal attempts
# Test symbolic links
# Test case sensitivity bypasses
# Test Unicode normalization bypasses
```

2. **Security testing**:
```bash
# Attempt to access system files
# Test with malicious path constructs
# Verify all bypass attempts are blocked
```

3. **Functional testing**:
```bash
# Ensure legitimate file access still works
# Test with normal file operations
# Verify performance is not significantly impacted
```

### 📋 **Related Resources**
- [OWASP A05:2021 - Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [Path Traversal Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Inclusion_Cheat_Sheet.html)
- [Node.js Path Module Security](https://nodejs.org/api/path.html)

### 🚨 **Timeline**
- **Immediate**: Fix path validation logic (0-1 day)
- **Short-term**: Add comprehensive validation (1-3 days)
- **Long-term**: Implement sandboxed file system (1-2 weeks)

---

**🔒 Security Team Notes**: This vulnerability could allow attackers to bypass intended file access restrictions. The current validation is insufficient and must be replaced with robust path checking mechanisms.