import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';
import { useAuth } from '../contexts/AuthContext';

// Mock the auth context
jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('Login Component', () => {
  // Mock the auth functions
  const mockSignIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock implementation for useAuth
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
    });
  });

  test('renders login form correctly', () => {
    render(<Login />);

    // Check if form elements are rendered
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByLabelText('Email:')).toBeInTheDocument();
    expect(screen.getByLabelText('Password:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  test('updates input fields when typing', async () => {
    render(<Login />);

    // Get input fields
    const emailInput = screen.getByLabelText('Email:');
    const passwordInput = screen.getByLabelText('Password:');

    // Type in email
    await userEvent.type(emailInput, 'test@example.com');
    expect(emailInput).toHaveValue('test@example.com');

    // Type in password
    await userEvent.type(passwordInput, 'password123');
    expect(passwordInput).toHaveValue('password123');
  });

  test('calls signIn with correct credentials on form submission', async () => {
    // Mock successful sign in
    mockSignIn.mockResolvedValue({});

    render(<Login />);

    // Fill in the form
    await userEvent.type(screen.getByLabelText('Email:'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password:'), 'password123');

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    // Verify signIn was called with correct arguments
    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  test('displays loading state during authentication', async () => {
    // Create a promise that won't resolve immediately
    let resolveSignIn: () => void;
    const signInPromise = new Promise<void>((resolve) => {
      resolveSignIn = resolve;
    });

    mockSignIn.mockReturnValue(signInPromise);

    render(<Login />);

    // Fill in the form
    await userEvent.type(screen.getByLabelText('Email:'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password:'), 'password123');

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    // Check for loading state
    expect(
      screen.getByRole('button', { name: 'Logging in...' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();

    // Inputs should be disabled during loading
    expect(screen.getByLabelText('Email:')).toBeDisabled();
    expect(screen.getByLabelText('Password:')).toBeDisabled();

    // Resolve the promise to complete the test
    resolveSignIn!();
  });

  test('displays error message when authentication fails', async () => {
    // Mock failed sign in
    mockSignIn.mockRejectedValue(new Error('Invalid credentials'));

    render(<Login />);

    // Fill in the form
    await userEvent.type(screen.getByLabelText('Email:'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password:'), 'wrong-password');

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    // Check for error message
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    // Button should be enabled again after error
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  test('handles non-Error objects thrown during sign in', async () => {
    // Mock failed sign in with a string
    mockSignIn.mockRejectedValue('Server error');

    render(<Login />);

    // Fill in the form
    await userEvent.type(screen.getByLabelText('Email:'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password:'), 'password123');

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    // Check for generic error message
    await waitFor(() => {
      expect(screen.getByText('Failed to sign in')).toBeInTheDocument();
    });
  });

  test('form validation requires email and password', async () => {
    render(<Login />);

    // Try to submit with empty fields
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    // signIn should not be called
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  test('trims whitespace from inputs before submission', async () => {
    mockSignIn.mockResolvedValue({});

    render(<Login />);

    // Fill in the form with extra whitespace
    await userEvent.type(screen.getByLabelText('Email:'), ' test@example.com ');
    await userEvent.type(screen.getByLabelText('Password:'), ' password123 ');

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    // Verify signIn was called with trimmed values
    expect(mockSignIn).toHaveBeenCalledWith(
      'test@example.com',
      ' password123 '
    );
  });
});
