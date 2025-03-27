import request from 'supertest';
import express from 'express';
import chatRoutes from '../routes/chatRoutes';
import { supabase } from '../config/supabase';
import { getUserModels } from '../services/modelService';
import { ChatService } from '../services/chatService';

// Mock dependencies
jest.mock('../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }),
}));

jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          in: jest.fn(),
        })),
      })),
      insert: jest.fn(),
    })),
  },
}));

jest.mock('../services/modelService', () => ({
  getUserModels: jest.fn(),
}));

jest.mock('../services/chatService', () => {
  return {
    ChatService: jest.fn().mockImplementation(() => {
      return {
        processMessage: jest.fn(),
      };
    }),
  };
});

// Set up the app with chat routes
const app = express();
app.use(express.json());
app.use('/api/chat', chatRoutes);

describe('Chat Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/chat/:nodeId', () => {
    it('successfully processes a chat message and returns AI response', async () => {
      // Mock node data
      const mockNode = {
        owner_id: 'test-user-id',
        model: 'openai/gpt-4',
        flavor: 'default',
      };

      // Mock user models
      const mockUserModels = [
        {
          model_name: 'openai/gpt-4',
          api_key: 'test-api-key',
        },
      ];

      // Mock AI response
      const mockAiResponse = {
        content: 'This is the AI response',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      // Setup mocks
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'chat_nodes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValueOnce({
              data: mockNode,
              error: null,
            }),
          };
        } else if (table === 'chat_messages') {
          return {
            insert: jest.fn().mockResolvedValueOnce({
              data: { id: 1 },
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
        };
      });

      (getUserModels as jest.Mock).mockResolvedValueOnce(mockUserModels);

      const processMessageMock = jest
        .fn()
        .mockResolvedValueOnce(mockAiResponse);
      (ChatService as jest.Mock).mockImplementationOnce(() => ({
        processMessage: processMessageMock,
      }));

      // Send request
      const response = await request(app)
        .post('/api/chat/123')
        .send({ message: 'Test message' });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        response: mockAiResponse,
      });

      // Verify mocks were called correctly
      expect(supabase.from).toHaveBeenCalledWith('chat_nodes');
      expect(supabase.from).toHaveBeenCalledWith('chat_messages');
      expect(getUserModels).toHaveBeenCalledWith('test-user-id');
      expect(ChatService).toHaveBeenCalledWith(
        123,
        'test-user-id',
        'openai/gpt-4',
        'test-api-key',
        'default',
        []
      );
      expect(processMessageMock).toHaveBeenCalledWith('Test message');
    });

    it('returns 400 for invalid node ID', async () => {
      const response = await request(app)
        .post('/api/chat/invalid')
        .send({ message: 'Test message' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid node ID' });
    });

    it('returns 400 when message is missing', async () => {
      const response = await request(app).post('/api/chat/123').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Message is required' });
    });

    it('returns 404 when chat node is not found', async () => {
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Node not found' },
        }),
      }));

      const response = await request(app)
        .post('/api/chat/123')
        .send({ message: 'Test message' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Chat node not found' });
    });

    it('returns 403 when user is not the node owner', async () => {
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            owner_id: 'different-user-id',
            model: 'openai/gpt-4',
          },
          error: null,
        }),
      }));

      const response = await request(app)
        .post('/api/chat/123')
        .send({ message: 'Test message' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Only the node owner can send messages',
      });
    });

    it('returns 400 for invalid model configuration', async () => {
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            owner_id: 'test-user-id',
            model: '', // Invalid model
          },
          error: null,
        }),
      }));

      const response = await request(app)
        .post('/api/chat/123')
        .send({ message: 'Test message' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid model configuration' });
    });

    it('returns 404 when model is not found in user account', async () => {
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            owner_id: 'test-user-id',
            model: 'openai/gpt-4',
          },
          error: null,
        }),
      }));

      (getUserModels as jest.Mock).mockResolvedValueOnce([]); // No models found

      const response = await request(app)
        .post('/api/chat/123')
        .send({ message: 'Test message' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error:
          'Model "openai/gpt-4" not found in your account. Please add it in Settings.',
      });
    });

    it('handles attachments correctly', async () => {
      // Mock node data
      const mockNode = {
        owner_id: 'test-user-id',
        model: 'openai/gpt-4',
        flavor: 'default',
      };

      // Mock user models
      const mockUserModels = [
        {
          model_name: 'openai/gpt-4',
          api_key: 'test-api-key',
        },
      ];

      // Mock attachments
      const mockAttachments = [
        {
          attachment_id: 1,
          file_type: 'pdf',
          file_name: 'test.pdf',
        },
      ];

      // Mock AI response
      const mockAiResponse = {
        content: 'This is the AI response',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      // Setup mocks for chat_nodes
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'chat_nodes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValueOnce({
              data: mockNode,
              error: null,
            }),
          };
        } else if (table === 'chat_messages') {
          return {
            insert: jest.fn().mockResolvedValueOnce({
              data: { id: 1 },
              error: null,
            }),
          };
        } else if (table === 'chat_attachments') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValueOnce({
              data: mockAttachments,
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
        };
      });

      (getUserModels as jest.Mock).mockResolvedValueOnce(mockUserModels);

      const processMessageMock = jest
        .fn()
        .mockResolvedValueOnce(mockAiResponse);
      (ChatService as jest.Mock).mockImplementationOnce(() => ({
        processMessage: processMessageMock,
      }));

      // Send request with attachments
      const response = await request(app)
        .post('/api/chat/123')
        .send({
          message: 'Test message',
          attachments: [{ attachment_id: 1 }],
        });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        response: mockAiResponse,
      });

      // Verify ChatService was instantiated with attachments
      expect(ChatService).toHaveBeenCalledWith(
        123,
        'test-user-id',
        'openai/gpt-4',
        'test-api-key',
        'default',
        mockAttachments
      );
    });

    it('handles error when saving message fails', async () => {
      // Mock node data
      const mockNode = {
        owner_id: 'test-user-id',
        model: 'openai/gpt-4',
        flavor: 'default',
      };

      // Mock user models
      const mockUserModels = [
        {
          model_name: 'openai/gpt-4',
          api_key: 'test-api-key',
        },
      ];

      // Setup mocks
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'chat_nodes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValueOnce({
              data: mockNode,
              error: null,
            }),
          };
        } else if (table === 'chat_messages') {
          return {
            insert: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Database error' },
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
        };
      });

      (getUserModels as jest.Mock).mockResolvedValueOnce(mockUserModels);

      // Send request
      const response = await request(app)
        .post('/api/chat/123')
        .send({ message: 'Test message' });

      // Assertions
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to save user message' });
    });
  });
});
