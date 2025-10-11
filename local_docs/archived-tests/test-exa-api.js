#!/usr/bin/env node

// Simple test using the actual Exa API key from MCP config
import { exa___get_code_context_exa } from "./dist/cli.js";

async function testExaAPI() {
  console.log("🚀 Testing Exa API with real key...");
  
  try {
    // Test the code context API
    const result = await exa___get_code_context_exa({
      query: "React hooks examples and best practices",
      tokensNum: "dynamic"
    });
    
    console.log("✅ Exa API call successful!");
    console.log("📋 Result preview:");
    console.log("- Query:", result.query);
    console.log("- Response length:", result.response?.length || 0);
    console.log("- Citations:", result.citations?.length || 0);
    
    if (result.response) {
      console.log("\n📝 Response snippet:");
      console.log(result.response.substring(0, 200) + "...");
    }
    
    if (result.citations && result.citations.length > 0) {
      console.log("\n🔗 First citation:");
      console.log("- Title:", result.citations[0].title);
      console.log("- URL:", result.citations[0].url);
    }
    
  } catch (error) {
    console.error("❌ Error testing Exa API:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
  }
}

testExaAPI();
