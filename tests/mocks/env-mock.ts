// Environment variable mocking utilities

export interface MockEnv {
  EXA_API_KEY?: string;
  NODE_ENV?: string;
  [key: string]: string | undefined;
}

export class EnvMock {
  private originalEnv: Record<string, string | undefined> = {};

  constructor() {
    // Store original environment variables
    this.originalEnv = { ...process.env };
  }

  setEnv(env: Partial<MockEnv>): void {
    // Clear any existing test environment variables
    this.clearTestEnv();

    // Set new environment variables
    Object.entries(env).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      }
    });
  }

  getEnv(key: string): string | undefined {
    return process.env[key];
  }

  clearTestEnv(): void {
    // Clear only test-specific environment variables
    const testKeys = ['EXA_API_KEY', 'NODE_ENV'];
    testKeys.forEach(key => {
      delete process.env[key];
    });
  }

  restore(): void {
    // Restore original environment variables
    // Clear current environment
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });

    // Restore original values
    Object.entries(this.originalEnv).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      }
    });
  }
}

// Pre-configured test environments
export const testEnvironments = {
  default: {
    EXA_API_KEY: 'test-api-key',
    NODE_ENV: 'test',
  },

  production: {
    EXA_API_KEY: 'prod-api-key',
    NODE_ENV: 'production',
  },

  missingKey: {
    NODE_ENV: 'test',
    // EXA_API_KEY intentionally missing
  },

  invalidKey: {
    EXA_API_KEY: 'invalid-key',
    NODE_ENV: 'test',
  },
};

// Factory function to create environment mock
export function createEnvMock(env: Partial<MockEnv> = testEnvironments.default): EnvMock {
  const envMock = new EnvMock();
  envMock.setEnv(env);
  return envMock;
}

// Test helper to run with specific environment
export async function withEnv<T>(env: Partial<MockEnv>, fn: () => T | Promise<T>): Promise<T> {
  const envMock = createEnvMock(env);
  try {
    return await fn();
  } finally {
    envMock.restore();
  }
}
