/// <reference types="bun-types" />

import type { BunPlugin } from "bun";

const config = {
  // Test configuration
  test: {
    // Global test setup
    preload: ["tests/setup.ts"],

    // Test environment
    environment: "node",

    // Coverage configuration
    coverage: {
      enabled: true,
      reporter: ["text", "html", "json"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/*.d.ts",
        "src/**/*.config.ts",
        "dist/**",
        "tests/**"
      ],
      // Set coverage threshold
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // Test timeout (in milliseconds)
    timeout: 30000, // Increased for performance tests

    // Parallel test execution
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },

    // Performance test configuration
    performance: {
      // Use node environment for performance tests to access memory APIs
      env: "node",
      // Increased timeout for performance tests
      timeout: 60000,
    },
  },

  // Build configuration
  target: "bun",
  minify: false,

  // Plugins (if needed)
  plugins: [] as BunPlugin[],
};

export default config;