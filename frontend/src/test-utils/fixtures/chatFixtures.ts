/**
 * Test fixtures for chat data
 */
export const sampleChatHistory = {
  nodeId: 'node-1',
  messages: [
    {
      id: 'msg-1',
      content: 'Hello, can you help me with a project idea?',
      sender: 'user',
      timestamp: '2023-09-10T14:30:00Z',
    },
    {
      id: 'msg-2',
      content:
        "Of course! I'd be happy to help brainstorm project ideas. What area are you interested in?",
      sender: 'ai',
      timestamp: '2023-09-10T14:30:10Z',
    },
    {
      id: 'msg-3',
      content: "I'm thinking about creating a collaborative note-taking app.",
      sender: 'user',
      timestamp: '2023-09-10T14:31:00Z',
    },
  ],
};

export const longChatHistory = {
  nodeId: 'node-2',
  messages: Array(50)
    .fill(null)
    .map((_, i) => ({
      id: `msg-${i + 1}`,
      content:
        i % 2 === 0
          ? `User message ${Math.floor(i / 2) + 1}`
          : `AI response ${Math.floor(i / 2) + 1}`,
      sender: i % 2 === 0 ? 'user' : 'ai',
      timestamp: new Date(Date.now() - (50 - i) * 60000).toISOString(),
    })),
};
