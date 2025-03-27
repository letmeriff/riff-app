import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from './SettingsModal';
import { supabase } from '../services/supabase';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the Supabase client
jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

describe('SettingsModal Component', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  // Set up before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the auth session for all tests
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
        },
      },
      error: null,
    });
  });

  test('renders correctly when open', async () => {
    // Mock successful API response for models
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, model_name: 'openai/gpt-4', api_key: 'sk-123' },
        {
          id: 2,
          model_name: 'anthropic/claude-3-sonnet-20240229',
          api_key: 'sk-456',
        },
      ],
    });

    render(<SettingsModal {...mockProps} />);

    // Check if the modal title is shown
    expect(screen.getByText('API Key Management')).toBeInTheDocument();

    // Check form elements
    expect(screen.getByLabelText('Model:')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key:')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Model' })
    ).toBeInTheDocument();

    // Wait for the models to load
    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByText('anthropic/claude-3-sonnet-20240229')
      ).toBeInTheDocument();
    });

    // Verify API was called with the correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/models',
      {
        headers: {
          Authorization: 'Bearer test-token',
        },
      }
    );
  });

  test("doesn't render when not open", () => {
    render(<SettingsModal isOpen={false} onClose={mockProps.onClose} />);

    // Modal should not be in the document
    expect(screen.queryByText('API Key Management')).not.toBeInTheDocument();
  });

  test('handles error when fetching models', async () => {
    // Mock failed API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });

    render(<SettingsModal {...mockProps} />);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch models')).toBeInTheDocument();
    });
  });

  test('displays empty state when no models', async () => {
    // Mock empty response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<SettingsModal {...mockProps} />);

    // Wait for the models to load (empty state)
    await waitFor(() => {
      expect(
        screen.getByText(
          'No models added yet. Add a model above to get started.'
        )
      ).toBeInTheDocument();
    });
  });

  test('handles adding a new model successfully', async () => {
    // Mock initial fetch (empty list)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    // Mock the add model API call
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 1,
        model_name: 'openai/gpt-4',
        api_key: 'sk-123',
      }),
    });

    render(<SettingsModal {...mockProps} />);

    // Wait for initial load to complete
    await waitFor(() => {
      expect(
        screen.getByText(
          'No models added yet. Add a model above to get started.'
        )
      ).toBeInTheDocument();
    });

    // Fill out the form
    await userEvent.selectOptions(
      screen.getByLabelText('Model:'),
      'openai/gpt-4'
    );
    await userEvent.type(screen.getByLabelText('API Key:'), 'sk-123');

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: 'Add Model' }));

    // Check for success message and newly added model
    await waitFor(() => {
      expect(screen.getByText('Model added successfully!')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument();
    });

    // Verify API call
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/models',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({ model_name: 'openai/gpt-4', api_key: 'sk-123' }),
      })
    );
  });

  test('handles error when adding a model', async () => {
    // Mock initial fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    // Mock failed API response for adding model
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid API key' }),
    });

    render(<SettingsModal {...mockProps} />);

    // Wait for initial load to complete
    await waitFor(() => {
      expect(
        screen.getByText(
          'No models added yet. Add a model above to get started.'
        )
      ).toBeInTheDocument();
    });

    // Fill out the form
    await userEvent.selectOptions(
      screen.getByLabelText('Model:'),
      'openai/gpt-4'
    );
    await userEvent.type(screen.getByLabelText('API Key:'), 'invalid-key');

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: 'Add Model' }));

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });
  });

  test('handles deleting a model successfully', async () => {
    // Mock initial fetch with models
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, model_name: 'openai/gpt-4', api_key: 'sk-123' },
      ],
    });

    // Mock successful delete response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(<SettingsModal {...mockProps} />);

    // Wait for models to load
    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument();
    });

    // Click delete button
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Check for success message and model removal
    await waitFor(() => {
      expect(
        screen.getByText('Model deleted successfully!')
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByText('openai/gpt-4')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'No models added yet. Add a model above to get started.'
        )
      ).toBeInTheDocument();
    });

    // Verify API call
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/models/1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  test('handles error when deleting a model', async () => {
    // Mock initial fetch with models
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, model_name: 'openai/gpt-4', api_key: 'sk-123' },
      ],
    });

    // Mock failed delete response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Model in use' }),
    });

    render(<SettingsModal {...mockProps} />);

    // Wait for models to load
    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument();
    });

    // Click delete button
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Model in use')).toBeInTheDocument();
    });
  });

  test('handles authentication error', async () => {
    // Mock auth session with no token
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<SettingsModal {...mockProps} />);

    // Should show auth error
    await waitFor(() => {
      expect(
        screen.getByText('Authentication token not found')
      ).toBeInTheDocument();
    });
  });

  test('form validation requires model selection and API key', async () => {
    // Mock initial fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<SettingsModal {...mockProps} />);

    // Try to submit the form without selecting model or entering API key
    await userEvent.click(screen.getByRole('button', { name: 'Add Model' }));

    // Form should not be submitted due to validation
    expect(global.fetch).toHaveBeenCalledTimes(1); // Only the initial fetch, not the form submission
  });
});
