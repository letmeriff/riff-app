import {
  createMockFileStorage,
  MockFileStorageOptions,
  MockFileStorageResponse,
  FileMetadata,
  StoredFile
} from './fileStorageMock';

describe('File Storage Mocks', () => {
  describe('createMockFileStorage', () => {
    test('should create a mock file storage provider with default options', () => {
      const storage = createMockFileStorage();
      
      expect(storage).toBeDefined();
      expect(storage.uploadFile).toBeDefined();
      expect(storage.getFile).toBeDefined();
      expect(storage.deleteFile).toBeDefined();
      expect(storage.listFiles).toBeDefined();
      expect(storage.getFileUrl).toBeDefined();
    });
    
    test('should create a mock file storage with custom options', () => {
      const options: MockFileStorageOptions = {
        delayMs: 200,
        failRate: 0.5,
        existingFiles: [
          { 
            id: 'file-1', 
            name: 'test.txt', 
            path: 'test-folder/test.txt',
            size: 100,
            type: 'text/plain',
            createdAt: new Date()
          }
        ]
      };
      
      const storage = createMockFileStorage(options);
      
      expect(storage.options).toEqual(options);
    });
  });
  
  describe('uploadFile functionality', () => {
    test('should upload a file and return metadata', async () => {
      const storage = createMockFileStorage({
        delayMs: 0
      });
      
      const fileBuffer = Buffer.from('Test file content');
      const fileMetadata: FileMetadata = {
        name: 'test.txt',
        type: 'text/plain',
        path: 'test-folder/test.txt'
      };
      
      const response = await storage.uploadFile(fileBuffer, fileMetadata);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.id).toBeDefined();
      expect(response.data?.name).toBe('test.txt');
      expect(response.data?.path).toBe('test-folder/test.txt');
      expect(response.data?.size).toBe(fileBuffer.length);
      expect(response.data?.type).toBe('text/plain');
    });
    
    test('should handle upload failure due to network error', async () => {
      const storage = createMockFileStorage({
        failRate: 1, // Always fail
        delayMs: 0
      });
      
      const fileBuffer = Buffer.from('Test file content');
      const fileMetadata: FileMetadata = {
        name: 'test.txt',
        type: 'text/plain',
        path: 'test-folder/test.txt'
      };
      
      const response = await storage.uploadFile(fileBuffer, fileMetadata);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Network error');
    });
    
    test('should reject upload for invalid file type', async () => {
      const storage = createMockFileStorage({
        delayMs: 0
      });
      
      const fileBuffer = Buffer.from('Test file content');
      const fileMetadata: FileMetadata = {
        name: 'test.exe',
        type: 'application/x-msdownload',
        path: 'test-folder/test.exe'
      };
      
      const response = await storage.uploadFile(fileBuffer, fileMetadata);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('File type not allowed');
    });
  });
  
  describe('getFile functionality', () => {
    test('should retrieve an existing file', async () => {
      const existingFile: StoredFile = {
        id: 'file-1',
        name: 'test.txt',
        path: 'test-folder/test.txt',
        size: 100,
        type: 'text/plain',
        createdAt: new Date(),
        content: Buffer.from('Test file content')
      };
      
      const storage = createMockFileStorage({
        existingFiles: [existingFile],
        delayMs: 0
      });
      
      const response = await storage.getFile('file-1');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.file.id).toBe('file-1');
      expect(response.data?.file.name).toBe('test.txt');
      expect(response.data?.content).toEqual(Buffer.from('Test file content'));
    });
    
    test('should return error for non-existent file', async () => {
      const storage = createMockFileStorage({
        delayMs: 0
      });
      
      const response = await storage.getFile('non-existent-file');
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('File not found');
    });
  });
  
  describe('deleteFile functionality', () => {
    test('should delete an existing file', async () => {
      const existingFile: StoredFile = {
        id: 'file-to-delete',
        name: 'delete-me.txt',
        path: 'test-folder/delete-me.txt',
        size: 100,
        type: 'text/plain',
        createdAt: new Date(),
        content: Buffer.from('Delete this file')
      };
      
      const storage = createMockFileStorage({
        existingFiles: [existingFile],
        delayMs: 0
      });
      
      // First verify file exists
      const beforeDelete = await storage.getFile('file-to-delete');
      expect(beforeDelete.success).toBe(true);
      
      // Delete file
      const response = await storage.deleteFile('file-to-delete');
      expect(response.success).toBe(true);
      
      // Verify file no longer exists
      const afterDelete = await storage.getFile('file-to-delete');
      expect(afterDelete.success).toBe(false);
    });
    
    test('should still return success when deleting non-existent file', async () => {
      const storage = createMockFileStorage({
        delayMs: 0
      });
      
      const response = await storage.deleteFile('non-existent-file');
      
      expect(response.success).toBe(true);
    });
  });
  
  describe('listFiles functionality', () => {
    test('should list files in a directory', async () => {
      const files: StoredFile[] = [
        {
          id: 'file-1',
          name: 'test1.txt',
          path: 'test-folder/test1.txt',
          size: 100,
          type: 'text/plain',
          createdAt: new Date(),
          content: Buffer.from('Test file 1')
        },
        {
          id: 'file-2',
          name: 'test2.txt',
          path: 'test-folder/test2.txt',
          size: 200,
          type: 'text/plain',
          createdAt: new Date(),
          content: Buffer.from('Test file 2')
        },
        {
          id: 'file-3',
          name: 'other.txt',
          path: 'other-folder/other.txt',
          size: 300,
          type: 'text/plain',
          createdAt: new Date(),
          content: Buffer.from('Other file')
        }
      ];
      
      const storage = createMockFileStorage({
        existingFiles: files,
        delayMs: 0
      });
      
      const response = await storage.listFiles('test-folder');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.files.length).toBe(2);
      expect(response.data?.files[0].path).toContain('test-folder');
      expect(response.data?.files[1].path).toContain('test-folder');
    });
    
    test('should return empty array for directory with no files', async () => {
      const storage = createMockFileStorage({
        delayMs: 0
      });
      
      const response = await storage.listFiles('empty-folder');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.files.length).toBe(0);
    });
  });
  
  describe('getFileUrl functionality', () => {
    test('should generate a URL for an existing file', async () => {
      const existingFile: StoredFile = {
        id: 'file-1',
        name: 'test.txt',
        path: 'test-folder/test.txt',
        size: 100,
        type: 'text/plain',
        createdAt: new Date(),
        content: Buffer.from('Test file content')
      };
      
      const storage = createMockFileStorage({
        existingFiles: [existingFile],
        delayMs: 0
      });
      
      const response = await storage.getFileUrl('file-1');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.url).toBeDefined();
      expect(response.data?.url).toContain('test.txt');
      expect(response.data?.expiresAt).toBeDefined();
    });
    
    test('should return error for non-existent file', async () => {
      const storage = createMockFileStorage({
        delayMs: 0
      });
      
      const response = await storage.getFileUrl('non-existent-file');
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('File not found');
    });
    
    test('should generate URL with custom expiration time', async () => {
      const existingFile: StoredFile = {
        id: 'file-1',
        name: 'test.txt',
        path: 'test-folder/test.txt',
        size: 100,
        type: 'text/plain',
        createdAt: new Date(),
        content: Buffer.from('Test file content')
      };
      
      const storage = createMockFileStorage({
        existingFiles: [existingFile],
        delayMs: 0
      });
      
      const expiresIn = 60 * 60; // 1 hour
      const response = await storage.getFileUrl('file-1', expiresIn);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.expiresAt).toBeGreaterThan(Date.now() + (expiresIn * 1000) - 1000);
    });
  });
}); 