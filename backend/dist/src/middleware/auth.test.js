"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./auth");
const supabase_1 = require("../config/supabase");

// Mock Supabase client
jest.mock('../config/supabase');

// Setup mock implementations after importing
supabase_1.supabase.auth = {
    getUser: jest.fn()
};

const mockRequest = (headers = {}) => ({
    headers,
});

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const mockNext = jest.fn();

describe('authMiddleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 if no token is provided', () => __awaiter(void 0, void 0, void 0, function* () {
        const req = mockRequest();
        const res = mockResponse();
        yield (0, auth_1.authMiddleware)(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(mockNext).not.toHaveBeenCalled();
    }));

    it('returns 401 if token is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
        const req = mockRequest({
            authorization: 'Bearer invalid-token',
        });
        const res = mockResponse();
        
        // Setup the mock implementation for this test
        supabase_1.supabase.auth.getUser.mockImplementationOnce(() => 
            Promise.resolve({
                data: { user: null },
                error: 'Invalid token'
            })
        );
        
        yield (0, auth_1.authMiddleware)(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        expect(mockNext).not.toHaveBeenCalled();
    }));

    it('calls next if token is valid', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockUser = { id: 'user-id', email: 'test@example.com' };
        const req = mockRequest({ authorization: 'Bearer valid-token' });
        const res = mockResponse();
        
        // Setup the mock implementation for this test
        supabase_1.supabase.auth.getUser.mockImplementationOnce(() => 
            Promise.resolve({
                data: { user: mockUser },
                error: null
            })
        );
        
        yield (0, auth_1.authMiddleware)(req, res, mockNext);
        expect(req.user).toEqual(mockUser);
        expect(mockNext).toHaveBeenCalled();
    }));

    it('handles errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        const req = mockRequest({ authorization: 'Bearer token' });
        const res = mockResponse();
        
        // Setup the mock implementation for this test
        supabase_1.supabase.auth.getUser.mockImplementationOnce(() => 
            Promise.reject(new Error('Network error'))
        );
        
        yield (0, auth_1.authMiddleware)(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
        expect(mockNext).not.toHaveBeenCalled();
    }));
});
