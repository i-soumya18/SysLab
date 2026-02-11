import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import {
  loginWithEmailAndPassword,
  loginWithGoogle,
  logout,
  registerWithEmailAndPassword,
  subscribeToAuthState,
  type AuthResult,
} from '../services/firebaseAuth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  errorMessage: string | null;
  register: (email: string, password: string) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogleProvider: () => Promise<AuthResult>;
  logoutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((nextUser: User | null) => {
      setUser(nextUser);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRegister = async (email: string, password: string): Promise<AuthResult> => {
    setErrorMessage(null);
    const result = await registerWithEmailAndPassword(email, password);
    if (result.errorMessage) {
      setErrorMessage(result.errorMessage);
    }
    return result;
  };

  const handleLogin = async (email: string, password: string): Promise<AuthResult> => {
    setErrorMessage(null);
    const result = await loginWithEmailAndPassword(email, password);
    if (result.errorMessage) {
      setErrorMessage(result.errorMessage);
    }
    return result;
  };

  const handleGoogleLogin = async (): Promise<AuthResult> => {
    setErrorMessage(null);
    const result = await loginWithGoogle();
    if (result.errorMessage) {
      setErrorMessage(result.errorMessage);
    }
    return result;
  };

  const handleLogout = async (): Promise<void> => {
    setErrorMessage(null);
    await logout();
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    errorMessage,
    register: handleRegister,
    login: handleLogin,
    loginWithGoogleProvider: handleGoogleLogin,
    logoutUser: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useFirebaseAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useFirebaseAuthContext must be used within an AuthProvider');
  }
  return context;
}

