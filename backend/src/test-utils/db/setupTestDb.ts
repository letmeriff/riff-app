/**
 * Database setup and teardown utilities for testing
 */
import { Pool } from 'pg';

// Test database configuration
const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'riff_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
};

// Create a dedicated pool for tests
const testPool = new Pool(testDbConfig);

/**
 * Sets up the test database with required schema and test data
 */
export const setupTestDatabase = async () => {
  try {
    // Create basic schema
    await testPool.query(`
      -- Create tables if they don't exist
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        avatar_url TEXT
      );

      CREATE TABLE IF NOT EXISTS canvases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        canvas_id TEXT REFERENCES canvases(id) ON DELETE CASCADE,
        data JSONB,
        position_x DOUBLE PRECISION,
        position_y DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        canvas_id TEXT REFERENCES canvases(id) ON DELETE CASCADE,
        source TEXT REFERENCES nodes(id) ON DELETE CASCADE,
        target TEXT REFERENCES nodes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Clear existing test data
    await cleanupTestDatabase();

    // Insert sample test data
    await testPool.query(`
      -- Insert test users
      INSERT INTO users (id, email, name, avatar_url)
      VALUES 
        ('test-user-1', 'test1@example.com', 'Test User 1', 'https://example.com/avatar1.png'),
        ('test-user-2', 'test2@example.com', 'Test User 2', 'https://example.com/avatar2.png');

      -- Insert test canvas
      INSERT INTO canvases (id, name, created_by)
      VALUES ('test-canvas-1', 'Test Canvas 1', 'test-user-1');

      -- Insert test nodes
      INSERT INTO nodes (id, canvas_id, data, position_x, position_y)
      VALUES 
        ('test-node-1', 'test-canvas-1', '{"content": "Test Node 1"}', 100, 100),
        ('test-node-2', 'test-canvas-1', '{"content": "Test Node 2"}', 300, 200);

      -- Insert test edge
      INSERT INTO edges (id, canvas_id, source, target)
      VALUES ('test-edge-1', 'test-canvas-1', 'test-node-1', 'test-node-2');
    `);

    console.log('Test database set up successfully');
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
};

/**
 * Cleans up the test database by removing all test data
 */
export const cleanupTestDatabase = async () => {
  try {
    await testPool.query(`
      -- Clean up all test data
      DELETE FROM edges;
      DELETE FROM nodes;
      DELETE FROM canvases;
      DELETE FROM users;
    `);

    console.log('Test database cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
    throw error;
  }
};

/**
 * Closes the test database connection
 */
export const closeTestDatabase = async () => {
  try {
    await testPool.end();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Error closing test database connection:', error);
    throw error;
  }
};

// Export the test pool for use in tests
export { testPool };
