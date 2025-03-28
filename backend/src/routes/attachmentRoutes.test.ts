import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { extractTextFromPDF } from '../utils/pdfExtractor';
import { io } from '../index';

// Mock dependencies
jest.mock('../index', () => ({
  io: {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }
}));

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    // Add authenticated user to request
    req.user = { id: 'user-123' };
    next();
  }
}));

jest.mock('../utils/pdfExtractor', () => ({
  extractTextFromPDF: jest.fn().mockResolvedValue('Extracted text from PDF')
}));

jest.mock('../config/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ 
        data: { signedUrl: 'https://signed-url.example.com/file.pdf' }, 
        error: null 
      }),
      remove: jest.fn().mockResolvedValue({ data: {}, error: null })
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { 
        owner_id: 'user-123',
        attachment_id: 1,
        node_id: 123,
        file_path: 'path/to/file.pdf',
        file_name: 'file.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        created_at: '2023-01-01T00:00:00.000Z'
      },
      error: null
    })
  }
}));

// Import the router factory function
import attachmentRouter from '../routes/attachmentRoutes';
import express from 'express';

describe('Attachment Routes', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let router: express.Router;

  beforeEach(() => {
    // Reset the request and response objects
    req = {
      params: {},
      body: {},
      user: { id: 'user-123' }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Create a new router instance
    router = attachmentRouter();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /:nodeId', () => {
    it('should fetch attachments for a node', async () => {
      // Mock supabase response for attachments query
      const mockAttachments = [
        {
          attachment_id: 1,
          node_id: 123,
          file_path: 'path/to/file1.pdf',
          file_name: 'file1.pdf',
          file_type: 'application/pdf',
          file_size: 1024,
          created_at: '2023-01-01T00:00:00.000Z',
          file_url: 'https://existing-url.example.com/file1.pdf'
        },
        {
          attachment_id: 2,
          node_id: 123,
          file_path: 'path/to/file2.jpg',
          file_name: 'file2.jpg',
          file_type: 'image/jpeg',
          file_size: 2048,
          created_at: '2023-01-02T00:00:00.000Z',
          file_url: null
        }
      ];

      // Set up the Supabase mock
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: mockAttachments,
          error: null
        })
      }));

      // Setup path parameter
      req.params = { nodeId: '123' };

      // Call the handler directly
      await router.stack[0].route.stack[1].handle(req as Request, res as Response);

      // Verify Supabase call
      expect(supabase.from).toHaveBeenCalledWith('chat_attachments');
      expect(supabase.storage.from).toHaveBeenCalledWith('chat-attachments');

      // The second attachment needs a signed URL
      expect(supabase.storage.createSignedUrl).toHaveBeenCalledTimes(1);
      expect(supabase.storage.createSignedUrl).toHaveBeenCalledWith(
        'path/to/file2.jpg', 
        60 * 60 * 24 * 365
      );

      // Verify response
      expect(res.json).toHaveBeenCalledWith([
        {
          attachment_id: 1,
          node_id: 123,
          file_path: 'path/to/file1.pdf',
          file_name: 'file1.pdf',
          file_type: 'application/pdf',
          file_size: 1024,
          created_at: '2023-01-01T00:00:00.000Z',
          file_url: 'https://existing-url.example.com/file1.pdf'
        },
        {
          attachment_id: 2,
          node_id: 123,
          file_path: 'path/to/file2.jpg',
          file_name: 'file2.jpg',
          file_type: 'image/jpeg',
          file_size: 2048,
          created_at: '2023-01-02T00:00:00.000Z',
          file_url: 'https://signed-url.example.com/file.pdf'
        }
      ]);
    });

    it('should handle errors when fetching attachments', async () => {
      // Mock supabase error response
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      }));

      // Setup path parameter
      req.params = { nodeId: '123' };

      // Call the handler directly
      await router.stack[0].route.stack[1].handle(req as Request, res as Response);

      // Verify error handling
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error'
      });
    });
  });

  describe('POST /upload', () => {
    it('should upload a file and store its metadata', async () => {
      // Setup request body
      req.body = {
        nodeId: 123,
        fileData: 'base64encodeddata',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024
      };

      // Mock the node ownership check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-123' },
          error: null
        })
      }));

      // Mock the file upload
      (supabase.storage.upload as jest.Mock).mockResolvedValueOnce({
        data: {},
        error: null
      });

      // Mock the signed URL creation
      (supabase.storage.createSignedUrl as jest.Mock).mockResolvedValueOnce({
        data: { signedUrl: 'https://signed-url.example.com/test.pdf' },
        error: null
      });

      // Mock the database insert
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            attachment_id: 1,
            node_id: 123,
            user_id: 'user-123',
            file_path: expect.any(String),
            file_name: 'test.pdf',
            file_type: 'application/pdf',
            file_size: 1024,
            file_url: 'https://signed-url.example.com/test.pdf',
            extracted_content: 'Extracted text from PDF',
            created_at: expect.any(String)
          },
          error: null
        })
      }));

      // Mock node state update queries
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [
            {
              attachment_id: 1,
              node_id: 123,
              file_path: expect.any(String),
              file_name: 'test.pdf',
              file_type: 'application/pdf',
              file_size: 1024,
              file_url: 'https://signed-url.example.com/test.pdf',
              created_at: expect.any(String)
            }
          ],
          error: null
        })
      }));

      // Mock context pulls query
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }));

      // Mock pulled by connections query
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }));

      // Call the handler directly
      await router.stack[1].route.stack[1].handle(req as Request, res as Response);

      // Verify PDF text extraction was called
      expect(extractTextFromPDF).toHaveBeenCalledWith(expect.any(Buffer));

      // Verify Supabase storage upload was called
      expect(supabase.storage.upload).toHaveBeenCalledWith(
        expect.stringContaining('123/'),
        expect.any(Buffer),
        { contentType: 'application/pdf' }
      );

      // Verify signed URL creation
      expect(supabase.storage.createSignedUrl).toHaveBeenCalledWith(
        expect.stringContaining('123/'),
        60 * 60 * 24 * 365
      );

      // Verify database insert
      expect(supabase.from).toHaveBeenCalledWith('chat_attachments');

      // Verify Socket.IO emit was called
      expect(io.to).toHaveBeenCalledWith('node:123');
      expect(io.emit).toHaveBeenCalledWith('attachment-update', expect.any(Object));
      expect(io.emit).toHaveBeenCalledWith('node-state-update', expect.any(Object));

      // Verify response
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        attachment: expect.objectContaining({
          attachment_id: 1,
          node_id: 123,
          file_name: 'test.pdf',
          file_type: 'application/pdf'
        })
      }));
    });

    it('should handle file upload errors', async () => {
      // Setup request body
      req.body = {
        nodeId: 123,
        fileData: 'base64encodeddata',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024
      };

      // Mock the node ownership check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-123' },
          error: null
        })
      }));

      // Mock storage upload failure
      (supabase.storage.upload as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: new Error('Storage upload failed')
      });

      // Call the handler directly
      await router.stack[1].route.stack[1].handle(req as Request, res as Response);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Storage upload failed'
      });
    });

    it('should deny uploads from non-owners', async () => {
      // Setup request body
      req.body = {
        nodeId: 123,
        fileData: 'base64encodeddata',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024
      };

      // Mock the node ownership check to show different owner
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'different-user' },
          error: null
        })
      }));

      // Call the handler directly
      await router.stack[1].route.stack[1].handle(req as Request, res as Response);

      // Verify permission denied response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Only the node owner can upload attachments'
      });

      // Verify storage was not accessed
      expect(supabase.storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:attachmentId', () => {
    it('should delete an attachment', async () => {
      // Setup path parameter
      req.params = { attachmentId: '1' };

      // Mock the attachment query
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            attachment_id: 1,
            node_id: 123,
            user_id: 'user-123',
            file_path: 'path/to/file.pdf',
            file_name: 'file.pdf',
            file_type: 'application/pdf',
            file_size: 1024
          },
          error: null
        })
      }));

      // Mock the node ownership check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-123' },
          error: null
        })
      }));

      // Mock the storage delete
      (supabase.storage.remove as jest.Mock).mockResolvedValueOnce({
        data: {},
        error: null
      });

      // Mock the database delete
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: {},
          error: null
        })
      }));

      // Call the handler (assuming it's the third route in the router)
      await router.stack[2].route.stack[1].handle(req as Request, res as Response);

      // Verify storage remove was called
      expect(supabase.storage.remove).toHaveBeenCalledWith(['path/to/file.pdf']);

      // Verify database delete
      expect(supabase.from).toHaveBeenCalledWith('chat_attachments');

      // Verify response
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should deny deletion from non-owner and non-uploader', async () => {
      // Setup path parameter
      req.params = { attachmentId: '1' };

      // Mock the attachment query
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            attachment_id: 1,
            node_id: 123,
            user_id: 'different-user',
            file_path: 'path/to/file.pdf',
            file_name: 'file.pdf',
            file_type: 'application/pdf',
            file_size: 1024
          },
          error: null
        })
      }));

      // Mock the node ownership check to show different owner
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'different-user' },
          error: null
        })
      }));

      // Call the handler
      await router.stack[2].route.stack[1].handle(req as Request, res as Response);

      // Verify permission denied response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You do not have permission to delete this attachment'
      });

      // Verify storage was not accessed
      expect(supabase.storage.remove).not.toHaveBeenCalled();
    });
  });
}); 