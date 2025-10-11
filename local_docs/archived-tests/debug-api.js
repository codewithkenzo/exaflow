#!/usr/bin/env node

// Debug version to see exactly what's being sent to the API
import { loadEnv, getEnv } from "./src/env.js";

// Manually set the API key for testing
process.env.EXA_API_KEY = "your_api_key_here";
await loadEnv();

async function debugExaAPI() {
  console.log("🔍 Debugging Exa API call...");
  
  const env = getEnv();
  console.log("📋 Environment:");
  console.log(`- EXA_API_KEY: ${env.EXA_API_KEY ? "SET" : "NOT SET"}`);
  console.log(`- API Key (first 8 chars): ${env.EXA_API_KEY?.substring(0, 8)}...`);
  
  const requestData = {
    query: "React hooks examples",
    tokensNum: 1000,
  };
  
  console.log("\n📤 Request Data:");
  console.log(JSON.stringify(requestData, null, 2));
  
  try {
    console.log("\n🌐 Making API call...");
    
    const response = await fetch("https://api.exa.ai/context", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.EXA_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "exa-personal-tool/1.0.0",
      },
      body: JSON.stringify(requestData),
    });
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response Length: ${responseText.length} characters`);
    
    if (response.ok) {
      console.log("✅ API call successful!");
      try {
        const data = JSON.parse(responseText);
        console.log(`- Response length: ${data.response?.length || 0} characters`);
        console.log(`- Query: ${data.metadata?.query}`);
        console.log(`- Tokens: ${data.metadata?.tokensNum}`);
        if (data.response) {
          console.log("\n📝 Response preview:");
          console.log(data.response.substring(0, 200) + "...");
        }
      } catch (parseError) {
        console.log("❌ Failed to parse JSON response");
        console.log("Raw response:", responseText.substring(0, 500));
      }
    } else {
      console.log("❌ API call failed!");
      console.log("Error response:", responseText);
    }
    
  } catch (error) {
    console.error("❌ Network error:", error.message);
    console.error("Stack:", error.stack);
  }
}

debugExaAPI();
