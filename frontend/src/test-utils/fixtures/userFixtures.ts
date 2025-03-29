/**
 * Test fixtures for user data
 */
export const sampleUsers = [
  {
    id: 'user-1',
    email: 'user1@example.com',
    name: 'Test User 1',
    avatarUrl: 'https://example.com/avatar1.png',
  },
  {
    id: 'user-2',
    email: 'user2@example.com',
    name: 'Test User 2',
    avatarUrl: 'https://example.com/avatar2.png',
  },
  {
    id: 'user-3',
    email: 'user3@example.com',
    name: 'Test User 3',
    avatarUrl: 'https://example.com/avatar3.png',
  },
];

export const userWithoutAvatar = {
  id: 'user-4',
  email: 'user4@example.com',
  name: 'Test User 4',
  avatarUrl: null,
};

export const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  avatarUrl: 'https://example.com/admin.png',
  role: 'admin',
};
