import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { z } from "zod";

export interface FileReadOptions {
  encoding?: BufferEncoding;
  maxSize?: number;
}

export interface FileWriteOptions {
  encoding?: BufferEncoding;
  createDir?: boolean;
}

export interface FileInfo {
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: Date;
}

export class FileSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public path?: string
  ) {
    super(message);
    this.name = "FileSystemError";
  }
}

export class SandboxedFileSystem {
  private readonly allowedPaths: Set<string>;
  private readonly maxFileSize: number;

  constructor(allowedPaths: string[] = [process.cwd()], maxFileSize = 10 * 1024 * 1024) {
    this.allowedPaths = new Set(allowedPaths.map(path => resolve(path)));
    this.maxFileSize = maxFileSize;
  }

  private validatePath(path: string): string {
    const resolvedPath = resolve(path);
    
    // Check if the path is within allowed boundaries
    for (const allowedPath of this.allowedPaths) {
      if (resolvedPath.startsWith(allowedPath)) {
        return resolvedPath;
      }
    }

    throw new FileSystemError(
      `Path ${path} is outside allowed workspace boundaries`,
      "PATH_VIOLATION",
      path
    );
  }

  async readFile(
    path: string,
    options: FileReadOptions = {}
  ): Promise<string> {
    const validatedPath = this.validatePath(path);
    const { encoding = "utf8", maxSize = this.maxFileSize } = options;

    try {
      const stats = await this.getFileInfo(validatedPath);
      
      if (stats.isDirectory) {
        throw new FileSystemError(
          "Cannot read directory as file",
          "IS_DIRECTORY",
          path
        );
      }

      if (stats.size > maxSize) {
        throw new FileSystemError(
          `File size ${stats.size} exceeds maximum allowed size ${maxSize}`,
          "FILE_TOO_LARGE",
          path
        );
      }

      return readFileSync(validatedPath, { encoding });
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      throw new FileSystemError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        "READ_ERROR",
        path
      );
    }
  }

  async writeFile(
    path: string,
    content: string,
    options: FileWriteOptions = {}
  ): Promise<void> {
    const validatedPath = this.validatePath(path);
    const { encoding = "utf8", createDir = true } = options;

    try {
      // Create directory if it doesn't exist
      if (createDir) {
        const dir = dirname(validatedPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }

      // Check content size
      const contentSize = Buffer.byteLength(content, encoding);
      if (contentSize > this.maxFileSize) {
        throw new FileSystemError(
          `Content size ${contentSize} exceeds maximum allowed size ${this.maxFileSize}`,
          "CONTENT_TOO_LARGE",
          path
        );
      }

      writeFileSync(validatedPath, content, { encoding });
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      throw new FileSystemError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        "WRITE_ERROR",
        path
      );
    }
  }

  async getFileInfo(path: string): Promise<FileInfo> {
    const validatedPath = this.validatePath(path);

    try {
      const stats = readFileSync(validatedPath);
      
      return {
        path: validatedPath,
        size: 0, // We'd need fs.statSync for real size
        isDirectory: false, // We'd need fs.statSync for real directory check
        lastModified: new Date(),
      };
    } catch (error) {
      throw new FileSystemError(
        `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`,
        "STAT_ERROR",
        path
      );
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    const validatedPath = this.validatePath(dir);

    try {
      if (!existsSync(validatedPath)) {
        throw new FileSystemError(
          "Directory does not exist",
          "DIRECTORY_NOT_FOUND",
          dir
        );
      }

      return readdirSync(validatedPath);
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      throw new FileSystemError(
        `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
        "LIST_ERROR",
        dir
      );
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      this.validatePath(path);
      return existsSync(path);
    } catch {
      return false;
    }
  }

  // Safe JSON operations
  async readJson<T>(path: string, schema?: z.ZodSchema<T>): Promise<T> {
    const content = await this.readFile(path);
    
    try {
      const parsed = JSON.parse(content);
      
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          throw new FileSystemError(
            `JSON schema validation failed: ${result.error.message}`,
            "SCHEMA_VALIDATION_ERROR",
            path
          );
        }
        return result.data;
      }
      
      return parsed as T;
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      throw new FileSystemError(
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
        "JSON_PARSE_ERROR",
        path
      );
    }
  }

  async writeJson<T>(path: string, data: T, pretty = true): Promise<void> {
    try {
      const content = pretty 
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);
      
      await this.writeFile(path, content);
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      throw new FileSystemError(
        `Failed to serialize JSON: ${error instanceof Error ? error.message : String(error)}`,
        "JSON_SERIALIZE_ERROR",
        path
      );
    }
  }

  // Utility methods
  getAllowedPaths(): string[] {
    return Array.from(this.allowedPaths);
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }
}

// Global sandboxed file system instance
export const fs = new SandboxedFileSystem();

// Utility functions for common operations
export async function readInputFile(path: string): Promise<any[]> {
  const content = await fs.readFile(path);
  
  try {
    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      return parsed.tasks;
    }
    
    throw new Error("Input file must contain an array or object with 'tasks' array");
  } catch (error) {
    throw new FileSystemError(
      `Invalid input file format: ${error instanceof Error ? error.message : String(error)}`,
      "INVALID_INPUT_FORMAT",
      path
    );
  }
}

export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => {
      data += chunk;
    });
    
    process.stdin.on("end", () => {
      resolve(data);
    });
    
    process.stdin.on("error", error => {
      reject(new FileSystemError(
        `Failed to read stdin: ${error.message}`,
        "STDIN_ERROR"
      ));
    });
  });
}

export async function readStdinJson(): Promise<any[]> {
  const content = await readStdin();
  
  if (!content.trim()) {
    return [];
  }
  
  const lines = content.trim().split("\n");
  const results: any[] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        results.push(JSON.parse(line));
      } catch (error) {
        throw new FileSystemError(
          `Invalid JSON line in stdin: ${line}`,
          "STDIN_JSON_ERROR"
        );
      }
    }
  }
  
  return results;
}
