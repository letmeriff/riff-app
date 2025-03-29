/**
 * File Storage Mock
 * 
 * This module provides a mock implementation of a file storage service
 * for testing file operations without requiring real storage services.
 */

import { v4 as uuidv4 } from 'uuid';

// Response types
export interface MockFileStorageResponseError {
  code: string;
  message: string;
}

export interface MockFileStorageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: MockFileStorageResponseError;
}

// File metadata
export interface FileMetadata {
  name: string;
  type: string;
  path: string;
  metadata?: Record<string, unknown>;
}

// Stored file
export interface StoredFile {
  id: string;
  name: string;
  type: string;
  path: string;
  size: number;
  createdAt: Date;
  content?: Buffer;
  metadata?: Record<string, unknown>;
}

// Provider options
export interface MockFileStorageOptions {
  existingFiles?: StoredFile[];
  delayMs?: number;
  failRate?: number;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  baseUrl?: string;
}

// Internal state
interface InternalState {
  files: StoredFile[];
}

/**
 * Creates a mock file storage provider for testing
 */
export function createMockFileStorage(options: MockFileStorageOptions = {}) {
  // Default options
  const defaultOptions: MockFileStorageOptions = {
    existingFiles: [],
    delayMs: 100,
    failRate: 0,
    allowedFileTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/json',
      'application/xml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    baseUrl: 'https://test-storage.example.com/'
  };
  
  // Merge with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Internal state
  const state: InternalState = {
    files: [...(mergedOptions.existingFiles || [])]
  };
  
  /**
   * Simulates network delay and potential failures
   */
  const simulateNetwork = async <T>(value: T): Promise<T> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < (mergedOptions.failRate || 0)) {
          reject(new Error('Network error: Could not connect to storage service'));
        } else {
          resolve(value);
        }
      }, mergedOptions.delayMs || 0);
    });
  };
  
  /**
   * Creates a success response
   */
  const createSuccessResponse = <T>(data: T): MockFileStorageResponse<T> => {
    return {
      success: true,
      data
    };
  };
  
  /**
   * Creates an error response
   */
  const createErrorResponse = <T = unknown>(code: string, message: string): MockFileStorageResponse<T> => {
    return {
      success: false,
      error: {
        code,
        message
      }
    };
  };
  
  /**
   * Finds a file by ID
   */
  const findFileById = (id: string): StoredFile | undefined => {
    return state.files.find(file => file.id === id);
  };
  
  /**
   * Finds files by directory path
   */
  const findFilesByDirectory = (directoryPath: string): StoredFile[] => {
    return state.files.filter(file => {
      return file.path.startsWith(directoryPath);
    });
  };
  
  // Create the file storage provider interface
  return {
    options: mergedOptions,
    
    /**
     * Upload a file to storage
     */
    async uploadFile(
      fileBuffer: Buffer, 
      metadata: FileMetadata
    ): Promise<MockFileStorageResponse<StoredFile>> {
      try {
        await simulateNetwork(null);
        
        // Validate file type
        if (
          mergedOptions.allowedFileTypes && 
          mergedOptions.allowedFileTypes.length > 0 && 
          !mergedOptions.allowedFileTypes.includes(metadata.type)
        ) {
          return createErrorResponse<StoredFile>(
            'storage/invalid-file-type',
            'File type not allowed'
          );
        }
        
        // Validate file size
        if (mergedOptions.maxFileSize && fileBuffer.length > mergedOptions.maxFileSize) {
          return createErrorResponse<StoredFile>(
            'storage/file-too-large',
            `File size exceeds the maximum allowed size of ${mergedOptions.maxFileSize} bytes`
          );
        }
        
        // Create file entry
        const newFile: StoredFile = {
          id: uuidv4(),
          name: metadata.name,
          type: metadata.type,
          path: metadata.path,
          size: fileBuffer.length,
          createdAt: new Date(),
          content: Buffer.from(fileBuffer),
          metadata: metadata.metadata
        };
        
        // Add to files list
        state.files.push(newFile);
        
        // Return file metadata (without content)
        const fileMetadata = { ...newFile };
        // Remove content from the returned metadata
        delete fileMetadata.content;
        return createSuccessResponse(fileMetadata);
      } catch (error) {
        return createErrorResponse<StoredFile>(
          'storage/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Get a file by ID
     */
    async getFile(fileId: string): Promise<MockFileStorageResponse<{ file: StoredFile, content: Buffer }>> {
      try {
        await simulateNetwork(null);
        
        const file = findFileById(fileId);
        
        if (!file) {
          return createErrorResponse<{ file: StoredFile, content: Buffer }>(
            'storage/file-not-found', 
            'File not found'
          );
        }
        
        // Return file metadata and content
        return createSuccessResponse({
          file: { ...file, content: undefined },
          content: file.content || Buffer.from([])
        });
      } catch (error) {
        return createErrorResponse<{ file: StoredFile, content: Buffer }>(
          'storage/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Delete a file by ID
     */
    async deleteFile(fileId: string): Promise<MockFileStorageResponse<{ success: boolean }>> {
      try {
        await simulateNetwork(null);
        
        const fileIndex = state.files.findIndex(file => file.id === fileId);
        
        if (fileIndex !== -1) {
          state.files.splice(fileIndex, 1);
        }
        
        // Always return success, even if file did not exist
        return createSuccessResponse({ success: true });
      } catch (error) {
        return createErrorResponse<{ success: boolean }>(
          'storage/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * List files in a directory
     */
    async listFiles(directoryPath: string): Promise<MockFileStorageResponse<{ files: StoredFile[] }>> {
      try {
        await simulateNetwork(null);
        
        const files = findFilesByDirectory(directoryPath);
        
        // Return file metadata (without content)
        const filesWithoutContent = files.map(file => {
          const fileWithoutContent = { ...file };
          delete fileWithoutContent.content;
          return fileWithoutContent;
        });
        
        return createSuccessResponse({ files: filesWithoutContent });
      } catch (error) {
        return createErrorResponse<{ files: StoredFile[] }>(
          'storage/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Get a signed URL for a file
     */
    async getFileUrl(
      fileId: string, 
      expiresIn: number = 3600
    ): Promise<MockFileStorageResponse<{ url: string, expiresAt: number }>> {
      try {
        await simulateNetwork(null);
        
        const file = findFileById(fileId);
        
        if (!file) {
          return createErrorResponse<{ url: string, expiresAt: number }>(
            'storage/file-not-found', 
            'File not found'
          );
        }
        
        // Generate mock signed URL
        const urlSafeFileName = encodeURIComponent(file.name);
        const randomSignature = Math.random().toString(36).substring(2, 10);
        const url = `${mergedOptions.baseUrl}${file.path}?signature=${randomSignature}&fileName=${urlSafeFileName}`;
        
        // Calculate expiration time
        const expiresAt = Date.now() + (expiresIn * 1000);
        
        return createSuccessResponse({
          url,
          expiresAt
        });
      } catch (error) {
        return createErrorResponse<{ url: string, expiresAt: number }>(
          'storage/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    }
  };
} 