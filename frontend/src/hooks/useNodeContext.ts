import { useState } from 'react';
import { supabase } from '../services/supabase';

type PullMode = 'full' | 'summary';

export const useNodeContext = (nodeId: string | null) => {
  const [selectedPullNode, setSelectedPullNode] = useState<string>('');
  const [pullLoading, setPullLoading] = useState(false);
  const [pullMode, setPullMode] = useState<PullMode>('full');
  const [branchLoading, setBranchLoading] = useState(false);

  const pullContext = async () => {
    if (!nodeId || !selectedPullNode) return;

    setPullLoading(true);
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // For summary mode, first get a summary of the selected node
      if (pullMode === 'summary') {
        const summaryResponse = await fetch(
          `http://localhost:3001/api/summarize/${selectedPullNode}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!summaryResponse.ok) {
          const errorData = await summaryResponse.json();
          throw new Error(errorData.error || 'Failed to generate summary');
        }

        const { summary } = await summaryResponse.json();

        // Add summary message directly
        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            node_id: parseInt(nodeId),
            content: `Summary pulled from Node ${selectedPullNode}:\n\n${summary}`,
            is_user: false,
            timestamp: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      // Always establish the pull relationship
      const pullResponse = await fetch(
        'http://localhost:3001/api/context/pull',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            targetNodeId: parseInt(nodeId),
            originNodeId: parseInt(selectedPullNode),
            mode: pullMode,
          }),
        }
      );

      if (!pullResponse.ok) {
        const errorData = await pullResponse.json();
        throw new Error(errorData.error || 'Failed to pull context');
      }

      // Reset the pull node selection
      setSelectedPullNode('');
    } catch (error) {
      console.error('Error pulling context:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An error occurred while pulling context';
      throw new Error(errorMessage);
    } finally {
      setPullLoading(false);
    }
  };

  const branchNode = async () => {
    if (!nodeId) return;

    setBranchLoading(true);
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      const response = await fetch('http://localhost:3001/api/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ originNodeId: parseInt(nodeId) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to branch node');
      }

      const { newNodeId } = await response.json();

      // Dispatch a custom event to notify other components that node selection should change
      window.dispatchEvent(
        new CustomEvent('select-node', {
          detail: { nodeId: newNodeId.toString() },
        })
      );

      return newNodeId;
    } catch (error) {
      console.error('Error branching node:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An error occurred while branching the node';
      throw new Error(errorMessage);
    } finally {
      setBranchLoading(false);
    }
  };

  return {
    selectedPullNode,
    setSelectedPullNode,
    pullLoading,
    pullMode,
    setPullMode,
    branchLoading,
    pullContext,
    branchNode,
  };
};
