/**
 * AI Service Mock
 * 
 * This module provides a mock implementation of an AI service
 * for testing AI integrations without requiring real AI APIs.
 */

// Response types
export interface MockAIServiceResponseError {
  code: string;
  message: string;
}

export interface MockAIServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: MockAIServiceResponseError;
}

// Usage statistics
export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Model information
export interface Model {
  id: string;
  name: string;
  type: 'completion' | 'embedding' | 'chat' | 'image';
  maxTokens: number;
  description?: string;
}

// Request types
export interface AICompletionRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  model?: string;
  stop?: string[];
}

export interface AIEmbeddingRequest {
  input: string[];
  model?: string;
}

// Response types
export interface AICompletionResponse {
  text: string;
  model: string;
  usage: AIUsage;
}

export interface AIEmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: AIUsage;
}

export interface AIModelsResponse {
  models: Model[];
}

// Provider options
export interface MockAIServiceOptions {
  delayMs?: number;
  failRate?: number;
  tokenLimit?: number;
  defaultCompletionModel?: string;
  defaultEmbeddingModel?: string;
}

/**
 * Creates a mock AI service for testing
 */
export function createMockAIService(options: MockAIServiceOptions = {}) {
  // Default options
  const defaultOptions: MockAIServiceOptions = {
    delayMs: 500,
    failRate: 0,
    tokenLimit: 4096,
    defaultCompletionModel: 'gpt-3.5-turbo',
    defaultEmbeddingModel: 'text-embedding-ada-002'
  };
  
  // Merge with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Available models
  const availableModels: Model[] = [
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      type: 'completion',
      maxTokens: 4096,
      description: 'Most capable GPT-3.5 model optimized for chat at a lower cost'
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      type: 'completion',
      maxTokens: 8192,
      description: 'Most capable model, optimized for chat'
    },
    {
      id: 'text-embedding-ada-002',
      name: 'Text Embedding Ada 002',
      type: 'embedding',
      maxTokens: 8191,
      description: 'Most capable embedding model for text embeddings'
    },
    {
      id: 'claude-2',
      name: 'Claude 2',
      type: 'completion',
      maxTokens: 100000,
      description: 'Anthropic\'s most capable AI assistant'
    }
  ];
  
  /**
   * Simulates network delay and potential failures
   */
  const simulateNetwork = async <T>(value: T): Promise<T> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < (mergedOptions.failRate || 0)) {
          reject(new Error('Network error: Could not connect to AI service'));
        } else {
          resolve(value);
        }
      }, mergedOptions.delayMs || 0);
    });
  };
  
  /**
   * Creates a success response
   */
  const createSuccessResponse = <T>(data: T): MockAIServiceResponse<T> => {
    return {
      success: true,
      data
    };
  };
  
  /**
   * Creates an error response
   */
  const createErrorResponse = (code: string, message: string): MockAIServiceResponse => {
    return {
      success: false,
      error: {
        code,
        message
      }
    };
  };
  
  /**
   * Estimates token count for text
   * This is a simple approximation (roughly 4 chars per token)
   */
  const estimateTokenCount = (text: string): number => {
    return Math.ceil(text.length / 4);
  };
  
  /**
   * Estimates token count for an array of texts
   */
  const estimateTokenCountForArray = (texts: string[]): number => {
    return texts.reduce((total, text) => total + estimateTokenCount(text), 0);
  };
  
  /**
   * Generates a mock completion based on the prompt
   */
  const generateMockCompletion = (prompt: string): string => {
    // Simple response generation based on keywords in prompt
    if (prompt.toLowerCase().includes('hello') || prompt.toLowerCase().includes('hi')) {
      return "Hello! I'm a mock AI assistant. How can I help you today?";
    }
    
    if (prompt.toLowerCase().includes('weather')) {
      return "I don't have access to real-time weather data, but I can tell you it's a perfect day for testing!";
    }
    
    if (prompt.toLowerCase().includes('help') || prompt.toLowerCase().includes('assist')) {
      return "I'm here to help! However, I'm just a mock implementation for testing purposes.";
    }
    
    if (prompt.toLowerCase().includes('test')) {
      return "This is a test response from the mock AI service. It seems to be working correctly!";
    }
    
    // Default response
    return "I'm a mock AI service response. This text is generated for testing purposes and doesn't use a real AI model.";
  };
  
  /**
   * Generates a mock embedding vector of the specified dimension
   */
  const generateMockEmbedding = (text: string, dimension: number = 1536): number[] => {
    // Create a deterministic but seemingly random vector based on the input text
    const hash = Array.from(text).reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    const seededRandom = (n: number) => {
      return ((Math.sin(n) + 1) / 2);
    };
    
    // Generate vector with values between -1 and 1
    return Array.from({ length: dimension }, (_, i) => {
      return (seededRandom(hash + i) * 2 - 1);
    });
  };
  
  // Create the AI service interface
  return {
    options: mergedOptions,
    
    /**
     * Get a completion from the AI model
     */
    async getCompletion(request: AICompletionRequest): Promise<MockAIServiceResponse<AICompletionResponse>> {
      try {
        await simulateNetwork(null);
        
        // Estimate token count
        const promptTokens = estimateTokenCount(request.prompt);
        const maxTokens = request.maxTokens || 256;
        
        // Check token limit
        if (promptTokens + maxTokens > (mergedOptions.tokenLimit || 4096)) {
          return createErrorResponse(
            'ai/token-limit-exceeded',
            `Token limit exceeded. Prompt tokens (${promptTokens}) + max completion tokens (${maxTokens}) exceeds the limit.`
          );
        }
        
        // Generate mock completion
        const text = generateMockCompletion(request.prompt);
        const completionTokens = estimateTokenCount(text);
        
        // Use specified model or default
        const model = request.model || mergedOptions.defaultCompletionModel || 'gpt-3.5-turbo';
        
        return createSuccessResponse({
          text,
          model,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens
          }
        });
      } catch (error) {
        return createErrorResponse(
          'ai/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Get embeddings for the provided texts
     */
    async getEmbedding(request: AIEmbeddingRequest): Promise<MockAIServiceResponse<AIEmbeddingResponse>> {
      try {
        await simulateNetwork(null);
        
        // Estimate token count
        const totalTokens = estimateTokenCountForArray(request.input);
        
        // Check token limit
        if (totalTokens > (mergedOptions.tokenLimit || 4096)) {
          return createErrorResponse(
            'ai/token-limit-exceeded',
            `Token limit exceeded. Total tokens (${totalTokens}) exceeds the limit.`
          );
        }
        
        // Generate mock embeddings
        const embeddings = request.input.map(text => generateMockEmbedding(text));
        
        // Use specified model or default
        const model = request.model || mergedOptions.defaultEmbeddingModel || 'text-embedding-ada-002';
        
        return createSuccessResponse({
          embeddings,
          model,
          usage: {
            promptTokens: totalTokens,
            completionTokens: 0,
            totalTokens
          }
        });
      } catch (error) {
        return createErrorResponse(
          'ai/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * List available AI models
     */
    async listModels(): Promise<MockAIServiceResponse<AIModelsResponse>> {
      try {
        await simulateNetwork(null);
        
        return createSuccessResponse({
          models: availableModels
        });
      } catch (error) {
        return createErrorResponse(
          'ai/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    }
  };
} 