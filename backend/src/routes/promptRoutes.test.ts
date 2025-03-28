import request from 'supertest';
import express from 'express';
import promptRoutes from '../routes/promptRoutes';
import { supabase } from '../config/supabase';

// Mock Supabase
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(),
        })),
        order: jest.fn(),
      })),
    })),
  },
}));

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }),
}));

// Set up the app with prompt routes
const app = express();
app.use(express.json());
app.use('/api/prompts', promptRoutes);

describe('Prompt Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/prompts', () => {
    it('returns all prompts when no type is specified', async () => {
      const mockPrompts = [
        {
          id: 1,
          name: 'Test Prompt 1',
          description: 'Description 1',
          type: 'framework',
          prompt: 'Content 1',
          created_at: '2023-01-01',
        },
        {
          id: 2,
          name: 'Test Prompt 2',
          description: 'Description 2',
          type: 'template',
          prompt: 'Content 2',
          created_at: '2023-01-02',
        },
      ];

      const mockSupabaseSelect = jest.fn().mockReturnThis();
      const mockSupabaseOrder = jest.fn().mockResolvedValueOnce({
        data: mockPrompts,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: mockSupabaseSelect,
      });

      mockSupabaseSelect.mockReturnValueOnce({
        order: mockSupabaseOrder,
      });

      const response = await request(app).get('/api/prompts');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        prompts: [
          {
            id: 1,
            name: 'Test Prompt 1',
            description: 'Description 1',
            type: 'framework',
            content: 'Content 1',
            created_at: '2023-01-01',
          },
          {
            id: 2,
            name: 'Test Prompt 2',
            description: 'Description 2',
            type: 'template',
            content: 'Content 2',
            created_at: '2023-01-02',
          },
        ],
      });
      expect(supabase.from).toHaveBeenCalledWith('prompts');
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
      expect(mockSupabaseOrder).toHaveBeenCalledWith('name');
    });

    it('filters prompts by type when type parameter is provided', async () => {
      const mockPrompts = [
        {
          id: 1,
          name: 'Test Prompt 1',
          description: 'Description 1',
          type: 'framework',
          prompt: 'Content 1',
          created_at: '2023-01-01',
        },
      ];

      const mockSupabaseSelect = jest.fn().mockReturnThis();
      const mockSupabaseEq = jest.fn().mockReturnThis();
      const mockSupabaseOrder = jest.fn().mockResolvedValueOnce({
        data: mockPrompts,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: mockSupabaseSelect,
      });

      mockSupabaseSelect.mockReturnValueOnce({
        eq: mockSupabaseEq,
      });

      mockSupabaseEq.mockReturnValueOnce({
        order: mockSupabaseOrder,
      });

      const response = await request(app).get('/api/prompts?type=framework');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        prompts: [
          {
            id: 1,
            name: 'Test Prompt 1',
            description: 'Description 1',
            type: 'framework',
            content: 'Content 1',
            created_at: '2023-01-01',
          },
        ],
      });
      expect(supabase.from).toHaveBeenCalledWith('prompts');
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
      expect(mockSupabaseEq).toHaveBeenCalledWith('type', 'framework');
      expect(mockSupabaseOrder).toHaveBeenCalledWith('name');
    });

    it('handles database errors when fetching prompts', async () => {
      const mockSupabaseSelect = jest.fn().mockReturnThis();
      const mockSupabaseOrder = jest.fn().mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: mockSupabaseSelect,
      });

      mockSupabaseSelect.mockReturnValueOnce({
        order: mockSupabaseOrder,
      });

      const response = await request(app).get('/api/prompts');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Database error' });
    });
  });

  describe('GET /api/prompts/:id', () => {
    it('returns a single prompt when found', async () => {
      const mockPrompt = {
        id: 1,
        name: 'Test Prompt',
        description: 'Description',
        type: 'framework',
        prompt: 'Content',
        created_at: '2023-01-01',
      };

      const mockSupabaseSelect = jest.fn().mockReturnThis();
      const mockSupabaseEq = jest.fn().mockReturnThis();
      const mockSupabaseSingle = jest.fn().mockResolvedValueOnce({
        data: mockPrompt,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: mockSupabaseSelect,
      });

      mockSupabaseSelect.mockReturnValueOnce({
        eq: mockSupabaseEq,
      });

      mockSupabaseEq.mockReturnValueOnce({
        single: mockSupabaseSingle,
      });

      const response = await request(app).get('/api/prompts/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        prompt: {
          id: 1,
          name: 'Test Prompt',
          description: 'Description',
          type: 'framework',
          content: 'Content',
          created_at: '2023-01-01',
        },
      });
      expect(supabase.from).toHaveBeenCalledWith('prompts');
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
      expect(mockSupabaseEq).toHaveBeenCalledWith('id', '1');
      expect(mockSupabaseSingle).toHaveBeenCalled();
    });

    it('returns 404 when prompt is not found', async () => {
      const mockSupabaseSelect = jest.fn().mockReturnThis();
      const mockSupabaseEq = jest.fn().mockReturnThis();
      const mockSupabaseSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Prompt not found' },
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: mockSupabaseSelect,
      });

      mockSupabaseSelect.mockReturnValueOnce({
        eq: mockSupabaseEq,
      });

      mockSupabaseEq.mockReturnValueOnce({
        single: mockSupabaseSingle,
      });

      const response = await request(app).get('/api/prompts/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Prompt not found' });
    });

    it('handles database errors when fetching a single prompt', async () => {
      const mockSupabaseSelect = jest.fn().mockReturnThis();
      const mockSupabaseEq = jest.fn().mockReturnThis();
      const mockSupabaseSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'OTHER_ERROR' },
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: mockSupabaseSelect,
      });

      mockSupabaseSelect.mockReturnValueOnce({
        eq: mockSupabaseEq,
      });

      mockSupabaseEq.mockReturnValueOnce({
        single: mockSupabaseSingle,
      });

      const response = await request(app).get('/api/prompts/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch prompt' });
    });
  });
});
