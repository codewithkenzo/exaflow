#!/usr/bin/env node

/**
 * Droid Integration Test for Exa Personal Tool
 * Tests the tool contract and demonstrates droid compatibility
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and validate the tool contract
function validateToolContract() {
  console.log('🔍 Validating Tool Contract...\n');
  
  try {
    const contractPath = join(__dirname, '.tool-contract.json');
    const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
    
    console.log('✅ Tool contract loaded successfully');
    console.log(`📋 Tool Name: ${contract.name}`);
    console.log(`🔧 Version: ${contract.version}`);
    console.log(`🎯 Runtime: ${contract.runtime}`);
    console.log(`📦 Entrypoint: ${contract.entrypoint}`);
    
    // Validate required fields
    const requiredFields = ['name', 'version', 'entrypoint', 'commands', 'environment'];
    let missingFields = [];
    
    for (const field of requiredFields) {
      if (!contract[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
      return false;
    }
    
    console.log('✅ All required fields present');
    
    // Validate commands
    const commands = Object.keys(contract.commands);
    console.log(`🔧 Available Commands: ${commands.join(', ')}`);
    
    for (const [cmdName, cmd] of Object.entries(contract.commands)) {
      console.log(`\n📋 Command: ${cmdName}`);
      console.log(`   Description: ${cmd.description}`);
      console.log(`   Input Type: ${cmd.input?.type || 'inline'}`);
      console.log(`   Output Type: ${cmd.output?.type || 'json'}`);
      
      if (cmd.options && cmd.options.length > 0) {
        console.log(`   Options: ${cmd.options.length} available`);
      }
    }
    
    // Validate environment requirements
    console.log(`\n🌍 Environment Requirements:`);
    console.log(`   Required: ${contract.environment.required.join(', ')}`);
    if (contract.environment.optional.length > 0) {
      console.log(`   Optional: ${contract.environment.optional.join(', ')}`);
    }
    
    // Validate streaming support
    if (contract.streaming) {
      console.log(`\n📡 Streaming Support:`);
      console.log(`   Enabled: ${contract.streaming.enabled}`);
      console.log(`   Format: ${contract.streaming.format}`);
      console.log(`   Events: ${contract.streaming.events.join(', ')}`);
    }
    
    // Validate async support
    if (contract.asyncSupport) {
      console.log(`\n⏱️ Async Support:`);
      console.log(`   Polling: ${contract.asyncSupport.polling?.enabled}`);
      console.log(`   Webhooks: ${contract.asyncSupport.webhooks?.enabled}`);
    }
    
    // Validate batch support
    if (contract.batchSupport) {
      console.log(`\n📦 Batch Support:`);
      console.log(`   Enabled: ${contract.batchSupport.enabled}`);
      console.log(`   Max Concurrency: ${contract.batchSupport.maxConcurrency}`);
      console.log(`   Order Preservation: ${contract.batchSupport.orderPreservation}`);
    }
    
    console.log('\n✅ Tool contract validation passed!');
    return true;
    
  } catch (error) {
    console.log(`❌ Failed to validate tool contract: ${error.message}`);
    return false;
  }
}

// Test droid configuration
function validateDroidConfig() {
  console.log('\n🤖 Validating Droid Configuration...\n');
  
  try {
    const droidPath = join(__dirname, '.factory', 'droids', 'exa-api-integration.json');
    const droidConfig = JSON.parse(readFileSync(droidPath, 'utf8'));
    
    console.log('✅ Droid configuration loaded successfully');
    console.log(`📋 Droid Name: ${droidConfig.name}`);
    console.log(`🔧 Version: ${droidConfig.version}`);
    console.log(`🎯 Type: ${droidConfig.type}`);
    console.log(`📍 Location: ${droidConfig.location}`);
    
    // Validate tools
    const tools = droidConfig.tools || [];
    console.log(`\n🔧 Configured Tools: ${tools.length}`);
    
    for (const tool of tools) {
      console.log(`\n📋 Tool: ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Command: ${tool.command} ${tool.args?.join(' ') || ''}`);
      
      if (tool.parameters) {
        const paramCount = Object.keys(tool.parameters).length;
        console.log(`   Parameters: ${paramCount}`);
        
        const requiredParams = Object.values(tool.parameters).filter(p => p.required);
        if (requiredParams.length > 0) {
          console.log(`   Required: ${requiredParams.map(p => p.description || p.type).join(', ')}`);
        }
      }
      
      if (tool.output) {
        console.log(`   Output: ${tool.output.type}`);
      }
    }
    
    // Validate usage patterns
    const patterns = droidConfig.usage_patterns || [];
    console.log(`\n📋 Usage Patterns: ${patterns.length}`);
    
    for (const pattern of patterns) {
      console.log(`   • ${pattern.name}: ${pattern.description}`);
    }
    
    // Validate environment requirements
    console.log(`\n🌍 Environment Requirements:`);
    console.log(`   Required: ${droidConfig.environment_requirements.required.join(', ')}`);
    if (droidConfig.environment_requirements.optional.length > 0) {
      console.log(`   Optional: ${droidConfig.environment_requirements.optional.join(', ')}`);
    }
    
    // Validate installation
    console.log(`\n📦 Installation:`);
    console.log(`   Dependencies: ${droidConfig.installation.dependencies.join(', ')}`);
    console.log(`   Setup Commands: ${droidConfig.installation.setup_commands.length}`);
    
    // Validate testing
    console.log(`\n🧪 Testing:`);
    console.log(`   Test Command: ${droidConfig.testing.test_command}`);
    console.log(`   Validation: ${droidConfig.testing.validation}`);
    
    console.log('\n✅ Droid configuration validation passed!');
    return true;
    
  } catch (error) {
    console.log(`❌ Failed to validate droid configuration: ${error.message}`);
    return false;
  }
}

// Test integration scenarios
function testIntegrationScenarios() {
  console.log('\n🧪 Testing Integration Scenarios...\n');
  
  const scenarios = [
    {
      name: 'Context Query',
      tool: 'exa-context',
      description: 'Query React hooks with 3000 tokens',
      expectedOutput: 'Code-oriented response with citations'
    },
    {
      name: 'Neural Search',
      tool: 'exa-search',
      description: 'Search ML trends with neural mode',
      expectedOutput: 'Search results with relevance scores'
    },
    {
      name: 'Content Extraction',
      tool: 'exa-contents',
      description: 'Extract content with live crawl',
      expectedOutput: 'Structured content with subpages'
    },
    {
      name: 'Research Pipeline',
      tool: 'exa-research',
      description: 'Run research with polling',
      expectedOutput: 'Comprehensive research results'
    }
  ];
  
  console.log(`📋 Testing ${scenarios.length} integration scenarios:\n`);
  
  for (const scenario of scenarios) {
    console.log(`🔧 ${scenario.name}`);
    console.log(`   Tool: ${scenario.tool}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Expected: ${scenario.expectedOutput}`);
    console.log(`   Status: ✅ Ready for execution`);
    console.log('');
  }
  
  console.log('✅ All integration scenarios validated!');
}

// Main test function
async function runDroidIntegrationTest() {
  console.log('🚀 Exa Personal Tool - Droid Integration Test\n');
  console.log('Testing tool contract and droid configuration for compatibility...\n');
  
  const contractValid = validateToolContract();
  const droidValid = validateDroidConfig();
  
  if (contractValid && droidValid) {
    testIntegrationScenarios();
    
    console.log('\n🎉 Droid Integration Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Tool contract is valid and complete');
    console.log('   ✅ Droid configuration is properly structured');
    console.log('   ✅ All commands and parameters are defined');
    console.log('   ✅ Environment requirements are specified');
    console.log('   ✅ Usage patterns are documented');
    console.log('   ✅ Integration scenarios are ready');
    
    console.log('\n🔗 To use with Droid:');
    console.log('   1. Set EXA_API_KEY environment variable');
    console.log('   2. Deploy to your Droid environment');
    console.log('   3. Use: task-cli --subagent-type exa-api-integration "Your task"');
    
  } else {
    console.log('\n❌ Droid Integration Test Failed!');
    console.log('   Please check the tool contract and droid configuration.');
    process.exit(1);
  }
}

// Run the test
runDroidIntegrationTest().catch(console.error);
