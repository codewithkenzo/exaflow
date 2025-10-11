#!/usr/bin/env node

/**
 * Demo test script for Exa Personal Tool
 * This demonstrates the CLI structure and capabilities without requiring a real API key
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, 'dist', 'cli.js');

// Test helper function
async function runCommand(args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 Running: bun ${CLI_PATH} ${args.join(' ')}`);
    
    const child = spawn('bun', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout,
        stderr,
        success: code === 0
      });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Command timed out'));
    }, 30000);
  });
}

// Test suite
async function runTests() {
  console.log('🚀 Exa Personal Tool - CLI Structure Test\n');
  console.log('Testing CLI functionality and structure...\n');

  const tests = [
    {
      name: 'Help Command',
      args: ['--help'],
      expectSuccess: true
    },
    {
      name: 'Version Command',
      args: ['--version'],
      expectSuccess: true
    },
    {
      name: 'Context Help',
      args: ['context', '--help'],
      expectSuccess: true
    },
    {
      name: 'Search Help',
      args: ['search', '--help'],
      expectSuccess: true
    },
    {
      name: 'Contents Help',
      args: ['contents', '--help'],
      expectSuccess: true
    },
    {
      name: 'Websets Help',
      args: ['websets', '--help'],
      expectSuccess: true
    },
    {
      name: 'Research Help',
      args: ['research', '--help'],
      expectSuccess: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await runCommand(test.args);
      
      if (result.success === test.expectSuccess) {
        console.log(`✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - FAILED (expected ${test.expectSuccess}, got ${result.success})`);
        if (result.stderr) {
          console.log(`   Error: ${result.stderr.slice(0, 200)}...`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total:  ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All CLI structure tests passed!');
    console.log('\n📋 CLI Commands Available:');
    console.log('   • context    - Query Exa Context API for code-oriented responses');
    console.log('   • search     - Search using Exa Search API with semantic and keyword modes');
    console.log('   • contents   - Extract content from URLs with live crawl and subpages support');
    console.log('   • websets    - Manage Exa Websets for async search and enrichment');
    console.log('   • research   - Run research tasks with Exa Research API');
    console.log('\n🔧 To use with real API calls, set EXA_API_KEY in your environment.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the implementation.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);
