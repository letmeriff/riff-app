/**
 * Test Mocks Index
 * 
 * This file exports all mock utilities for testing canvas-related components
 */

// Export modern mocks (use these for new tests)
export * as ReactFlowModernMocks from './reactflow.mock';
export * as YjsModernMocks from './yjs.mock';

// Legacy mocks (maintained for backward compatibility)
export * from './reactFlowMock';
export * from './yjsMock'; 