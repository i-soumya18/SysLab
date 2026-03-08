import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebaseClient';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  errorMessage: string | null;
}

export interface AuthResult {
  user: User | null;
  errorMessage: string | null;
}

function mapFirebaseErrorToMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead or use the password reset option if you forgot your password.';
    case 'auth/invalid-email':
      return 'The email address you entered is not valid. Please check for typos and try again.';
    case 'auth/weak-password':
      return 'Your password is too weak. Use at least 8 characters with a mix of uppercase, lowercase letters and numbers.';
    case 'auth/user-not-found':
      return 'No account found with this email. Check the address or create a new account.';
    case 'auth/wrong-password':
      return 'The password is incorrect. If you cannot remember it, use the password reset option.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in popup was closed before completing. Please try again to finish signing in.';
    case 'auth/network-request-failed':
      return 'Network error while contacting the authentication service. Check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please wait a few minutes before trying again.';
    case 'auth/invalid-action-code':
      return 'This verification link is invalid or has expired. Please request a new one.';
    case 'auth/expired-action-code':
      return 'This verification link has expired. Please request a new verification email.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support for assistance.';
    case 'auth/requires-recent-login':
      return 'For security reasons, please sign out and sign in again before performing this action.';
    default:
      return 'An unexpected error occurred. Please try again, and if it keeps happening contact support with a screenshot.';
  }
}

export async function registerWithEmailAndPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const auth = getFirebaseAuth();

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Send email verification after successful registration
    try {
      await sendEmailVerification(result.user);
      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.warn('Failed to send verification email:', emailError);
      // Don't fail registration if email verification fails
    }

    return {
      user: result.user,
      errorMessage: null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: string }).code);
      return {
        user: null,
        errorMessage: mapFirebaseErrorToMessage(code),
      };
    }

    return {
      user: null,
      errorMessage: 'Registration failed due to an unexpected error. Please try again in a moment.',
    };
  }
}

export async function loginWithEmailAndPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const auth = getFirebaseAuth();

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return {
      user: result.user,
      errorMessage: null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: string }).code);
      return {
        user: null,
        errorMessage: mapFirebaseErrorToMessage(code),
      };
    }

    return {
      user: null,
      errorMessage: 'Login failed because of an unexpected error. Please try again in a moment.',
    };
  }
}

export async function loginWithGoogle(): Promise<AuthResult> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    return {
      user: result.user,
      errorMessage: null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: string }).code);
      return {
        user: null,
        errorMessage: mapFirebaseErrorToMessage(code),
      };
    }

    return {
      user: null,
      errorMessage: 'Google sign-in failed unexpectedly. Please try again or use email sign-in as a fallback.',
    };
  }
}

export async function logout(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export function subscribeToAuthState(
  callback: (user: User | null) => void,
): Unsubscribe {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

/**
 * Send password reset email
 * Implements SRS FR-1.1 password reset functionality
 */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const auth = getFirebaseAuth();

  try {
    await sendPasswordResetEmail(auth, email);
    return {
      user: null,
      errorMessage: null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: string }).code);
      return {
        user: null,
        errorMessage: mapFirebaseErrorToMessage(code),
      };
    }

    return {
      user: null,
      errorMessage: 'Failed to send password reset email. Please try again in a moment.',
    };
  }
}

/**
 * Resend email verification
 * Implements SRS FR-1.1 email verification
 */
export async function resendEmailVerification(user: User): Promise<{ success: boolean; errorMessage: string | null }> {
  try {
    await sendEmailVerification(user);
    return {
      success: true,
      errorMessage: null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: string }).code);
      return {
        success: false,
        errorMessage: mapFirebaseErrorToMessage(code),
      };
    }

    return {
      success: false,
      errorMessage: 'Failed to send verification email. Please try again in a moment.',
    };
  }
}

/**
 * Update user profile (display name, photo URL)
 * Implements SRS FR-1 user profile management
 */
export async function updateUserProfile(
  user: User,
  profile: { displayName?: string; photoURL?: string }
): Promise<{ success: boolean; errorMessage: string | null }> {
  try {
    await updateProfile(user, profile);
    return {
      success: true,
      errorMessage: null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: string }).code);
      return {
        success: false,
        errorMessage: mapFirebaseErrorToMessage(code),
      };
    }

    return {
      success: false,
      errorMessage: 'Failed to update profile. Please try again in a moment.',
    };
  }
}

