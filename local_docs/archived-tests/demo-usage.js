#!/usr/bin/env node

/**
 * Exa Personal Tool - Usage Demonstration
 * Shows how the tool would be used with mock data
 */

import { randomUUID } from 'crypto';

// Mock response data that matches the expected schema
const mockResponses = {
  context: {
    status: "success",
    taskId: `ctx-${randomUUID()}`,
    timing: {
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 2000).toISOString(),
      duration: 2000
    },
    citations: [
      {
        url: "https://react.dev/reference/react",
        title: "React Reference Documentation",
        snippet: "React hooks let you use state and other React features in function components.",
        author: "React Team",
        publishedDate: "2024-01-15T00:00:00Z",
        verificationReasoning: "Official React documentation, highly relevant"
      }
    ],
    data: {
      response: "React hooks are functions that let you use state and other React features in function components. The most commonly used hooks include:\n\n1. **useState**: For managing component state\n2. **useEffect**: For side effects and lifecycle events\n3. **useContext**: For consuming React context\n4. **useReducer**: For complex state management\n5. **useMemo** and **useCallback**: For performance optimization\n\nExample usage:\n```jsx\nimport { useState, useEffect } from 'react';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  \n  useEffect(() => {\n    document.title = `Count: ${count}`;\n  }, [count]);\n  \n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Count: {count}\n    </button>\n  );\n}\n```",
      metadata: {
        tokensUsed: 2450,
        model: "context-v1"
      }
    }
  },
  search: {
    status: "success",
    taskId: `search-${randomUUID()}`,
    timing: {
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 1500).toISOString(),
      duration: 1500
    },
    citations: [
      {
        url: "https://arxiv.org/abs/2401.00001",
        title: "Latest Advances in Large Language Models",
        snippet: "Comprehensive survey of LLM developments in 2024",
        author: "AI Research Team",
        publishedDate: "2024-01-01T00:00:00Z"
      },
      {
        url: "https://blog.google/technology/ai/",
        title: "Google AI Blog - Latest Updates",
        snippet: "Recent breakthroughs in artificial intelligence research",
        author: "Google AI Team",
        publishedDate: "2024-01-10T00:00:00Z"
      }
    ],
    data: {
      results: [
        {
          id: "result-1",
          url: "https://arxiv.org/abs/2401.00001",
          title: "Latest Advances in Large Language Models",
          publishedDate: "2024-01-01T00:00:00Z",
          author: "AI Research Team",
          text: "This paper presents a comprehensive survey of the latest developments in large language models...",
          score: 0.95
        },
        {
          id: "result-2",
          url: "https://blog.google/technology/ai/",
          title: "Google AI Blog - Latest Updates",
          publishedDate: "2024-01-10T00:00:00Z",
          author: "Google AI Team",
          text: "Google announces new breakthroughs in AI research including improved reasoning capabilities...",
          score: 0.89
        }
      ],
      totalResults: 2,
      query: "machine learning trends 2024"
    }
  },
  contents: {
    status: "success",
    taskId: `contents-${randomUUID()}`,
    timing: {
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 3000).toISOString(),
      duration: 3000
    },
    citations: [
      {
        url: "https://example.com/article",
        title: "Example Article",
        snippet: "Full content extraction with subpage analysis",
        publishedDate: "2024-01-01T00:00:00Z"
      }
    ],
    data: {
      results: [
        {
          id: "content-1",
          url: "https://example.com/article",
          title: "Example Article",
          text: "This is the full extracted content from the main page. It includes all the text content, properly formatted and structured for analysis...",
          subpages: [
            {
              url: "https://example.com/article/about",
              title: "About the Author",
              text: "Information about the author and their background..."
            },
            {
              url: "https://example.com/article/references",
              title: "References",
              text: "List of references and sources cited in this article..."
            }
          ]
        }
      ]
    }
  },
  research: {
    status: "success",
    taskId: `research-${randomUUID()}`,
    timing: {
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 10000).toISOString(),
      duration: 10000
    },
    citations: [
      {
        url: "https://source1.com",
        title: "Research Source 1",
        snippet: "Primary research source for analysis",
        publishedDate: "2024-01-01T00:00:00Z"
      },
      {
        url: "https://source2.com",
        title: "Research Source 2",
        snippet: "Secondary research source with supporting data",
        publishedDate: "2024-01-02T00:00:00Z"
      }
    ],
    data: {
      taskId: `research-task-${randomUUID()}`,
      status: "completed",
      result: {
        title: "Comprehensive Analysis of AI Trends in 2024",
        summary: "Based on extensive research across multiple sources, AI trends in 2024 are characterized by:\n\n1. **Multimodal Models**: Increased focus on models that can process text, images, and audio\n2. **Efficiency Improvements**: Development of smaller, more efficient models\n3. **Better Reasoning**: Enhanced logical reasoning and problem-solving capabilities\n4. **Enterprise Adoption**: Increased integration of AI tools in business workflows\n5. **Regulation and Safety**: Growing emphasis on AI safety and responsible development\n\nKey findings indicate that while model sizes continue to grow, there's a parallel trend toward optimization and efficiency that's making AI more accessible.",
        keyFindings: [
          "Multimodal capabilities are becoming standard",
          "Efficiency gains are reducing computational requirements",
          "Enterprise adoption is accelerating",
          "Safety and ethics are increasingly prioritized"
        ],
        sources: 12,
        confidenceScore: 0.87
      }
    }
  }
};

// Simulate CLI command execution with mock data
function simulateCommand(command, args) {
  console.log(`\n🔧 Executing: exa-tool ${command} ${args.join(' ')}`);
  
  return new Promise((resolve) => {
    // Simulate processing time
    setTimeout(() => {
      const mockData = mockResponses[command];
      if (mockData) {
        console.log(`✅ Command completed successfully`);
        console.log(`📊 Task ID: ${mockData.taskId}`);
        console.log(`⏱️  Duration: ${mockData.timing.duration}ms`);
        console.log(`📚 Citations: ${mockData.citations.length}`);
        console.log(`\n📄 Results Preview:`);
        console.log(JSON.stringify(mockData, null, 2).substring(0, 1000) + '...');
      } else {
        console.log(`❌ Mock data not available for command: ${command}`);
      }
      resolve(mockData);
    }, Math.random() * 2000 + 1000);
  });
}

// Demo usage scenarios
async function runDemo() {
  console.log('🚀 Exa Personal Tool - Usage Demonstration\n');
  console.log('This demo shows how the tool would work with a real Exa API key.\n');

  const scenarios = [
    {
      name: "Context Query",
      command: "context",
      args: ["React hooks examples", "--tokens", "3000"],
      description: "Get code-oriented context for React hooks"
    },
    {
      name: "Semantic Search",
      command: "search",
      args: ["machine learning trends 2024", "--type", "neural", "--num-results", "5"],
      description: "Search for latest ML trends using neural search"
    },
    {
      name: "Content Extraction",
      command: "contents",
      args: ["--livecrawl", "always", "--subpages", "2"],
      description: "Extract content with live crawl and subpages"
    },
    {
      name: "Research Task",
      command: "research",
      args: ["--instructions", "Research latest AI trends and summarize key findings", "--poll"],
      description: "Run comprehensive research with polling"
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n📋 ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);
    
    await simulateCommand(scenario.command, scenario.args);
    
    console.log('\n' + '='.repeat(60));
  }

  console.log('\n🎉 Demo completed!');
  console.log('\n📋 To use the real tool:');
  console.log('1. Set your EXA_API_KEY environment variable');
  console.log('2. Run: bun dist/cli.js <command> [options]');
  console.log('3. Use the droid configuration: exa-api-integration');
  console.log('\n🔗 Available commands:');
  console.log('  • context    - Get code-oriented responses');
  console.log('  • search     - Semantic and keyword search');
  console.log('  • contents   - Extract content from URLs');
  console.log('  • websets    - Manage async search containers');
  console.log('  • research   - Run multi-step research tasks');
}

// Run the demo
runDemo().catch(console.error);
