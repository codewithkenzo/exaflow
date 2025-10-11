#!/usr/bin/env node

// Direct test of our Exa Personal Tool's Context client
import { exaContextClient } from "./src/clients/exa-context.js";
import { exaSearchClient } from "./src/clients/exa-search.js";

async function testOurTool() {
  console.log("🚀 Testing OUR Exa Personal Tool (not MCP)...");
  
  try {
    // Test Context API
    console.log("\n📋 Testing Context API...");
    const contextResult = await exaContextClient.query(
      "React hooks examples and best practices",
      { tokens: 1000 }
    );
    
    console.log("✅ Context API Results:");
    console.log(`- Status: ${contextResult.status}`);
    console.log(`- Task ID: ${contextResult.taskId}`);
    console.log(`- Duration: ${contextResult.timing.duration}ms`);
    console.log(`- Citations: ${contextResult.citations.length}`);
    
    if (contextResult.data) {
      console.log(`- Response length: ${contextResult.data.response.length} characters`);
      console.log(`- Query: ${contextResult.data.metadata?.query}`);
      console.log(`- Tokens used: ${contextResult.data.metadata?.tokensNum}`);
      
      if (contextResult.data.response) {
        console.log("\n📝 Response preview:");
        console.log(contextResult.data.response.substring(0, 300) + "...");
      }
    }
    
    // Test Search API
    console.log("\n🔍 Testing Search API...");
    const searchResult = await exaSearchClient.search(
      "machine learning trends 2024",
      { numResults: 3, searchType: "neural" }
    );
    
    console.log("✅ Search API Results:");
    console.log(`- Status: ${searchResult.status}`);
    console.log(`- Task ID: ${searchResult.taskId}`);
    console.log(`- Duration: ${searchResult.timing.duration}ms`);
    console.log(`- Citations: ${searchResult.citations.length}`);
    
    if (searchResult.data) {
      console.log(`- Results count: ${searchResult.data.results.length}`);
      console.log(`- Total results: ${searchResult.data.totalResults}`);
      
      if (searchResult.data.results.length > 0) {
        console.log("\n🔗 First result:");
        const first = searchResult.data.results[0];
        console.log(`- Title: ${first.title}`);
        console.log(`- URL: ${first.url}`);
        console.log(`- Score: ${first.score}`);
      }
    }
    
    console.log("\n🎉 OUR Exa Personal Tool is working perfectly!");
    
  } catch (error) {
    console.error("❌ Error testing OUR tool:", error.message);
    console.error("Stack:", error.stack);
  }
}

testOurTool();
