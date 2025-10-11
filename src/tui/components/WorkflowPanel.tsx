import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { workflowAutomation, Workflow, WorkflowExecution } from '../utils/workflow-automation.js';
import { SearchConfig } from '../types/index.js';

interface WorkflowPanelProps {
  isActive: boolean;
  query: string;
  config: SearchConfig;
  onWorkflowExecute?: (execution: WorkflowExecution) => void;
}

export function WorkflowPanel({ 
  isActive, 
  query, 
  config,
  onWorkflowExecute 
}: WorkflowPanelProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<number>(0);
  const [showDetails, setShowDetails] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    setWorkflows(workflowAutomation.getAllWorkflows());
    setExecutions(workflowAutomation.getAllExecutions());
  }, []);

  const executeWorkflow = useCallback(async (workflow: Workflow) => {
    if (!query.trim()) {
      return;
    }

    setIsExecuting(true);
    
    try {
      const execution = await workflowAutomation.executeWorkflow(
        workflow.id,
        query,
        (step, total, message) => {
          // Progress callback - could be displayed in UI
          console.log(`Progress: ${step}/${total} - ${message}`);
        },
        (step, results) => {
          // Step completion callback
          console.log(`Completed step: ${step.name}`);
        }
      );

      setExecutions(prev => [...prev, execution]);
      onWorkflowExecute?.(execution);
      
    } catch (error) {
      console.error('Workflow execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [query, onWorkflowExecute]);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.upArrow) {
      setSelectedWorkflow(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedWorkflow(prev => Math.min(workflows.length - 1, prev + 1));
    } else if (key.return && workflows[selectedWorkflow]) {
      executeWorkflow(workflows[selectedWorkflow]);
    } else if (key.tab) {
      setShowDetails(!showDetails);
    } else if (key.ctrl && input === 'r') {
      // Refresh workflows and executions
      setWorkflows(workflowAutomation.getAllWorkflows());
      setExecutions(workflowAutomation.getAllExecutions());
    } else if (key.ctrl && input === 'e') {
      // Show execution history
      setShowDetails(false);
    } else if (key.ctrl && input === 'w') {
      // Show workflows
      setShowDetails(true);
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'running': return 'yellow';
      case 'failed': return 'red';
      case 'cancelled': return 'gray';
      default: return 'white';
    }
  };

  const getRecommendations = () => {
    if (!query.trim()) return [];
    return workflowAutomation.getWorkflowRecommendations(query);
  };

  const selectedWorkflowData = workflows[selectedWorkflow];
  const recommendations = getRecommendations();
  const recentExecutions = executions.slice(-5).reverse();

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⚡ Workflow Automation
        </Text>
        {isActive && <Text color="green"> ●</Text>}
      </Box>

      {!showDetails && (
        <>
          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Box marginBottom={1}>
              <Text bold color="yellow">Recommended Workflows</Text>
              {recommendations.slice(0, 2).map((workflow, index) => (
                <Box key={workflow.id} marginTop={1}>
                  <Text color="green">
                    {index + 1}. {workflow.name}
                  </Text>
                  <Text color="gray" dimColor>
                    {' '}- {workflow.description}
                  </Text>
                </Box>
              ))}
            </Box>
          )}

          {/* Available Workflows */}
          <Box marginBottom={1}>
            <Text bold color="yellow">Available Workflows</Text>
            {workflows.length === 0 ? (
              <Text color="gray">No workflows available</Text>
            ) : (
              workflows.map((workflow, index) => (
                <Box 
                  key={workflow.id} 
                  marginTop={1}
                  borderStyle={index === selectedWorkflow ? 'bold' : 'single'}
                  borderColor={index === selectedWorkflow ? 'green' : 'gray'}
                  paddingX={1}
                >
                  <Box justifyContent="space-between">
                    <Text 
                      bold={index === selectedWorkflow}
                      color={workflow.enabled ? 'white' : 'gray'}
                    >
                      {index + 1}. {workflow.name}
                    </Text>
                    {!workflow.enabled && <Text color="red">[Disabled]</Text>}
                  </Box>
                  <Text color="gray" dimColor>
                    {workflow.description}
                  </Text>
                  <Text color="blue" dimColor>
                    {workflow.steps.length} steps
                  </Text>
                </Box>
              ))
            )}
          </Box>

          {/* Execution Status */}
          {isExecuting && (
            <Box marginBottom={1}>
              <Text color="yellow">⏳ Executing workflow...</Text>
            </Box>
          )}

          {/* Selected Workflow Details */}
          {selectedWorkflowData && (
            <Box marginBottom={1}>
              <Text bold color="cyan">Selected: {selectedWorkflowData.name}</Text>
              <Text color="gray" dimColor>
                Steps: {selectedWorkflowData.steps.map(s => s.name).join(' → ')}
              </Text>
            </Box>
          )}
        </>
      )}

      {showDetails && (
        <>
          {/* Recent Executions */}
          <Box marginBottom={1}>
            <Text bold color="yellow">Recent Executions</Text>
            {recentExecutions.length === 0 ? (
              <Text color="gray">No executions yet</Text>
            ) : (
              recentExecutions.map((execution) => (
                <Box key={execution.id} marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                  <Box justifyContent="space-between">
                    <Text color="white">
                      {new Date(execution.startedAt).toLocaleTimeString()}
                    </Text>
                    <Text color={getStatusColor(execution.status)}>
                      {execution.status}
                    </Text>
                  </Box>
                  <Text color="gray" dimColor>
                    {execution.currentStep}/{workflowAutomation.getWorkflow(execution.workflowId)?.steps.length || 0} steps
                  </Text>
                  {execution.error && (
                    <Text color="red" dimColor>
                      Error: {execution.error}
                    </Text>
                  )}
                </Box>
              ))
            )}
          </Box>
        </>
      )}

      {/* Controls Help */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {!showDetails 
            ? '↑↓ Navigate • Enter: Execute • Tab: Details • Ctrl+R: Refresh'
            : 'Tab: Workflows • Ctrl+R: Refresh • Ctrl+W: Workflows • Ctrl+E: Executions'
          }
        </Text>
      </Box>

      {/* Query Status */}
      {query.trim() ? (
        <Box marginTop={1}>
          <Text color="green">
            Ready: "{query.substring(0, 50)}{query.length > 50 ? '...' : ''}"
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Enter a search query to enable workflow execution
          </Text>
        </Box>
      )}
    </Box>
  );
}
