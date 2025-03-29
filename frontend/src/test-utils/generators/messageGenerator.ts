/**
 * Generator functions for chat messages for testing
 */

interface MessageGenOptions {
  nodeId?: string;
  messageCount?: number;
  startTime?: number;
}

export const generateChatMessages = (options: MessageGenOptions = {}) => {
  const {
    nodeId = 'node-1',
    messageCount = 10,
    startTime = Date.now() - messageCount * 60000,
  } = options;

  return {
    nodeId,
    messages: Array(messageCount)
      .fill(null)
      .map((_, i) => ({
        id: `msg-${i + 1}`,
        content: i % 2 === 0 ? generateUserMessage(i) : generateAIResponse(i),
        sender: i % 2 === 0 ? 'user' : 'ai',
        timestamp: new Date(startTime + i * 60000).toISOString(),
      })),
  };
};

const generateUserMessage = (index: number) => {
  const questions = [
    'Can you help me with this idea?',
    'What do you think about this approach?',
    'How would you improve this concept?',
    'Do you have any suggestions?',
    'What are the alternatives to this solution?',
  ];

  return questions[index % questions.length];
};

const generateAIResponse = (index: number) => {
  const responses = [
    "That's an interesting question. Let me think about it...",
    'There are several ways to approach this problem. First...',
    'I think your idea has merit, but have you considered...',
    'Based on my analysis, I would recommend...',
    'This concept could be extended by incorporating...',
  ];

  return responses[index % responses.length];
};
