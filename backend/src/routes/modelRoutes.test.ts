import request from 'supertest';
import express from 'express';
import { getUserModels, addUserModel, deleteUserModel } from '../services/modelService';
import { authMiddleware } from '../middleware/auth';
import modelRoutes from '../routes/modelRoutes';

// Mock the modelService functions
jest.mock('../services/modelService', () => ({
  getUserModels: jest.fn(),
  addUserModel: jest.fn(),
  deleteUserModel: jest.fn(),
}));

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }),
}));

// Set up the app with model routes
const app = express();
app.use(express.json());
app.use('/api/models', modelRoutes);

describe('Model Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/models', () => {
    it('returns user models when authenticated', async () => {
      const mockModels = [
        { id: 1, user_id: 'test-user-id', model_name: 'gpt-4', api_key: 'encrypted-key-1', iv: 'iv1' },
        { id: 2, user_id: 'test-user-id', model_name: 'gpt-3.5-turbo', api_key: 'encrypted-key-2', iv: 'iv2' }
      ];
      
      (getUserModels as jest.Mock).mockResolvedValueOnce(mockModels);
      
      const response = await request(app).get('/api/models');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockModels);
      expect(getUserModels).toHaveBeenCalledWith('test-user-id');
    });

    it('handles errors from getUserModels', async () => {
      (getUserModels as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      const response = await request(app).get('/api/models');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch models: Database error' });
    });
    
    it('returns 401 when user is not authenticated', async () => {
      // Override the mock auth middleware just for this test
      (authMiddleware as jest.Mock).mockImplementationOnce((req, res) => {
        return res.status(401).json({ error: 'User not authenticated' });
      });
      
      const response = await request(app).get('/api/models');
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'User not authenticated' });
      expect(getUserModels).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/models', () => {
    it('adds a new model when data is valid', async () => {
      const modelData = {
        model_name: 'gpt-4',
        api_key: 'test-api-key'
      };
      
      const mockNewModel = {
        id: 3,
        user_id: 'test-user-id',
        model_name: 'gpt-4',
        api_key: 'encrypted-key',
        iv: 'iv-value'
      };
      
      (addUserModel as jest.Mock).mockResolvedValueOnce(mockNewModel);
      
      const response = await request(app)
        .post('/api/models')
        .send(modelData);
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockNewModel);
      expect(addUserModel).toHaveBeenCalledWith('test-user-id', 'gpt-4', 'test-api-key');
    });

    it('returns 400 when model_name is missing', async () => {
      const response = await request(app)
        .post('/api/models')
        .send({ api_key: 'test-api-key' });
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Model name and API key are required' });
      expect(addUserModel).not.toHaveBeenCalled();
    });

    it('returns 400 when api_key is missing', async () => {
      const response = await request(app)
        .post('/api/models')
        .send({ model_name: 'gpt-4' });
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Model name and API key are required' });
      expect(addUserModel).not.toHaveBeenCalled();
    });

    it('handles errors from addUserModel', async () => {
      (addUserModel as jest.Mock).mockRejectedValueOnce(new Error('Insertion error'));
      
      const response = await request(app)
        .post('/api/models')
        .send({ model_name: 'gpt-4', api_key: 'test-api-key' });
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to add model: Insertion error' });
    });
    
    it('returns 401 when user is not authenticated', async () => {
      // Override the mock auth middleware just for this test
      (authMiddleware as jest.Mock).mockImplementationOnce((req, res) => {
        return res.status(401).json({ error: 'User not authenticated' });
      });
      
      const response = await request(app)
        .post('/api/models')
        .send({ model_name: 'gpt-4', api_key: 'test-api-key' });
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'User not authenticated' });
      expect(addUserModel).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/models/:id', () => {
    it('deletes a model when ID is valid', async () => {
      (deleteUserModel as jest.Mock).mockResolvedValueOnce(undefined);
      
      const response = await request(app).delete('/api/models/1');
      
      expect(response.status).toBe(204);
      expect(deleteUserModel).toHaveBeenCalledWith(1);
    });

    it('returns 400 when ID is not a number', async () => {
      const response = await request(app).delete('/api/models/invalid-id');
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Model ID must be a number' });
      expect(deleteUserModel).not.toHaveBeenCalled();
    });

    it('handles errors from deleteUserModel', async () => {
      (deleteUserModel as jest.Mock).mockRejectedValueOnce(new Error('Deletion error'));
      
      const response = await request(app).delete('/api/models/1');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to delete model: Deletion error' });
    });
    
    it('returns 401 when user is not authenticated', async () => {
      // Override the mock auth middleware just for this test
      (authMiddleware as jest.Mock).mockImplementationOnce((req, res) => {
        return res.status(401).json({ error: 'User not authenticated' });
      });
      
      const response = await request(app).delete('/api/models/1');
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'User not authenticated' });
      expect(deleteUserModel).not.toHaveBeenCalled();
    });
  });
}); 