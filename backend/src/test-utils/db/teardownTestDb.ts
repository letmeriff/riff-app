/**
 * Teardown script for the test database after integration tests
 */
import { closeTestDatabase } from './setupTestDb';

module.exports = async (): Promise<void> => {
  try {
    await closeTestDatabase();
    console.log('Test database connection closed after integration tests');
  } catch (error) {
    console.error('Error closing test database connection:', error);
    throw error;
  }
}; 