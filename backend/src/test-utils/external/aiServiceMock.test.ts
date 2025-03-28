import {
  createMockAIService,
  MockAIServiceOptions,
  AICompletionRequest,
  AIEmbeddingRequest,
} from './aiServiceMock';

describe('AI Service Mocks', () => {
  describe('createMockAIService', () => {
    test('should create a mock AI service with default options', () => {
      const aiService = createMockAIService();
      
      expect(aiService).toBeDefined();
      expect(aiService.getCompletion).toBeDefined();
      expect(aiService.getEmbedding).toBeDefined();
      expect(aiService.listModels).toBeDefined();
    });
    
    test('should create a mock AI service with custom options', () => {
      const options: MockAIServiceOptions = {
        delayMs: 200,
        failRate: 0.5,
        tokenLimit: 1000,
        defaultCompletionModel: 'custom-model',
        defaultEmbeddingModel: 'custom-embedding-model'
      };
      
      const aiService = createMockAIService(options);
      
      expect(aiService.options).toEqual(options);
    });
  });
  
  describe('getCompletion functionality', () => {
    test('should generate a completion response', async () => {
      const aiService = createMockAIService({
        delayMs: 0
      });
      
      const request: AICompletionRequest = {
        prompt: 'Hello, how are you?',
        maxTokens: 100
      };
      
      const response = await aiService.getCompletion(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.text).toBeDefined();
      expect(response.data?.text.length).toBeGreaterThan(0);
      expect(response.data?.model).toBeDefined();
      expect(response.data?.usage).toBeDefined();
      expect(response.data?.usage.promptTokens).toBeGreaterThan(0);
      expect(response.data?.usage.completionTokens).toBeGreaterThan(0);
      expect(response.data?.usage.totalTokens).toBe(
        response.data?.usage.promptTokens + response.data?.usage.completionTokens
      );
    });
    
    test('should handle network failures', async () => {
      const aiService = createMockAIService({
        failRate: 1, // Always fail
        delayMs: 0
      });
      
      const request: AICompletionRequest = {
        prompt: 'Hello, how are you?',
        maxTokens: 100
      };
      
      const response = await aiService.getCompletion(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Network error');
    });
    
    test('should respect token limit', async () => {
      const aiService = createMockAIService({
        tokenLimit: 10,
        delayMs: 0
      });
      
      const request: AICompletionRequest = {
        prompt: 'This is a very long prompt that should exceed the token limit for this test',
        maxTokens: 100
      };
      
      const response = await aiService.getCompletion(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Token limit exceeded');
    });
    
    test('should respect custom model', async () => {
      const aiService = createMockAIService({
        delayMs: 0
      });
      
      const request: AICompletionRequest = {
        prompt: 'Hello, how are you?',
        maxTokens: 100,
        model: 'custom-model'
      };
      
      const response = await aiService.getCompletion(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.model).toBe('custom-model');
    });
  });
  
  describe('getEmbedding functionality', () => {
    test('should generate embedding vectors', async () => {
      const aiService = createMockAIService({
        delayMs: 0
      });
      
      const request: AIEmbeddingRequest = {
        input: ['Hello, how are you?', 'Another text for embedding']
      };
      
      const response = await aiService.getEmbedding(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.embeddings).toBeDefined();
      expect(response.data?.embeddings.length).toBe(2);
      expect(response.data?.embeddings[0].length).toBeGreaterThan(0);
      expect(response.data?.embeddings[1].length).toBeGreaterThan(0);
      expect(response.data?.model).toBeDefined();
      expect(response.data?.usage).toBeDefined();
      expect(response.data?.usage.totalTokens).toBeGreaterThan(0);
    });
    
    test('should handle network failures', async () => {
      const aiService = createMockAIService({
        failRate: 1, // Always fail
        delayMs: 0
      });
      
      const request: AIEmbeddingRequest = {
        input: ['Hello, how are you?']
      };
      
      const response = await aiService.getEmbedding(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Network error');
    });
    
    test('should respect token limit', async () => {
      const aiService = createMockAIService({
        tokenLimit: 5,
        delayMs: 0
      });
      
      const request: AIEmbeddingRequest = {
        input: ['This is a very long text that should exceed the token limit for this test']
      };
      
      const response = await aiService.getEmbedding(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Token limit exceeded');
    });
    
    test('should respect custom model', async () => {
      const aiService = createMockAIService({
        delayMs: 0
      });
      
      const request: AIEmbeddingRequest = {
        input: ['Hello, how are you?'],
        model: 'custom-embedding-model'
      };
      
      const response = await aiService.getEmbedding(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.model).toBe('custom-embedding-model');
    });
  });
  
  describe('listModels functionality', () => {
    test('should return a list of available models', async () => {
      const aiService = createMockAIService({
        delayMs: 0
      });
      
      const response = await aiService.listModels();
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.models).toBeDefined();
      expect(response.data?.models.length).toBeGreaterThan(0);
      
      // Check each model has the required properties
      response.data?.models.forEach(model => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.type).toBeDefined();
        expect(model.maxTokens).toBeDefined();
      });
    });
    
    test('should handle network failures', async () => {
      const aiService = createMockAIService({
        failRate: 1, // Always fail
        delayMs: 0
      });
      
      const response = await aiService.listModels();
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Network error');
    });
  });
}); 