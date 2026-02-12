/**
 * Admin Hook
 * Checks if current user has admin privileges
 */

import { useEffect, useState } from 'react';
import { useFirebaseAuthContext } from './useFirebaseAuth';

export function useAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user } = useFirebaseAuthContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const email = user.email.toLowerCase();
    const isAdminEmail = email === 'sahoosoumya242004@gmail.com';

    setIsAdmin(isAdminEmail);
    setIsLoading(false);
  }, [user]);

  return { isAdmin, isLoading };
}
