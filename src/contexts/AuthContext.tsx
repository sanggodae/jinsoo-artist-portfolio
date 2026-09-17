import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  subscribeToAuthState,
  getCurrentUser,
  loginAdminWithEmail,
  loginAdminWithGooglePopup,
  loginAdminWithGoogleRedirect,
  handleRedirectResult,
  logoutAdmin,
  checkUserIsAdmin,
  isRunningInIframe,
} from '../services/authService';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  isIframe: boolean;
  isRedirectProcessing: boolean;
  redirectError: string | null;
  clearRedirectError: () => void;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  loginWithGooglePopup: () => Promise<User>;
  loginWithGoogleRedirect: () => Promise<void>;
  loginWithGoogle: () => Promise<void | User>;
  logout: () => Promise<void>;
  refreshAdminStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  isLoading: true,
  isIframe: false,
  isRedirectProcessing: false,
  redirectError: null,
  clearRedirectError: () => {},
  loginWithEmail: async () => { throw new Error('AuthContext not initialized'); },
  loginWithGooglePopup: async () => { throw new Error('AuthContext not initialized'); },
  loginWithGoogleRedirect: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  refreshAdminStatus: async () => false,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isIframe] = useState<boolean>(() => isRunningInIframe());
  const [isRedirectProcessing, setIsRedirectProcessing] = useState<boolean>(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  // Re-check and refresh admin claims for a specific or current user
  const checkAndApplyAdminClaims = useCallback(async (targetUser: User | null): Promise<boolean> => {
    if (!targetUser) {
      setUser(null);
      setIsAdmin(false);
      return false;
    }
    try {
      const adminStatus = await checkUserIsAdmin(targetUser, true);
      setUser(targetUser);
      setIsAdmin(adminStatus);
      return adminStatus;
    } catch (err) {
      console.error('[AuthContext] Failed to verify custom claims:', err);
      setUser(targetUser);
      setIsAdmin(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Immediate check if currentUser is already in memory
    const existingUser = getCurrentUser();
    if (existingUser) {
      checkAndApplyAdminClaims(existingUser).then(() => {
        if (isMounted) setIsLoading(false);
      });
    }

    // 1. Process any pending redirect results from Google OAuth
    setIsRedirectProcessing(true);
    handleRedirectResult()
      .then((res) => {
        if (!isMounted) return;
        if (res.isRedirectResult) {
          if (res.error) {
            setRedirectError(res.error);
          } else if (res.user) {
            setUser(res.user);
            setIsAdmin(res.isAdmin);
            setRedirectError(null);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Redirect result error:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsRedirectProcessing(false);
        }
      });

    // 2. Subscribe to general Firebase Auth state changes
    const unsubscribe = subscribeToAuthState((state) => {
      if (!isMounted) return;
      setUser(state.user);
      setIsAdmin(state.isAdmin);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [checkAndApplyAdminClaims]);

  const refreshAdminStatus = useCallback(async (): Promise<boolean> => {
    const authUser = user || getCurrentUser();
    if (!authUser) {
      setIsAdmin(false);
      return false;
    }
    return await checkAndApplyAdminClaims(authUser);
  }, [user, checkAndApplyAdminClaims]);

  const clearRedirectError = useCallback(() => {
    setRedirectError(null);
  }, []);

  const handleLoginWithEmail = useCallback(async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const loggedUser = await loginAdminWithEmail(email, pass);
      await checkAndApplyAdminClaims(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  }, [checkAndApplyAdminClaims]);

  const handleLoginWithGooglePopup = useCallback(async (): Promise<User> => {
    setIsLoading(true);
    try {
      const loggedUser = await loginAdminWithGooglePopup();
      await checkAndApplyAdminClaims(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  }, [checkAndApplyAdminClaims]);

  // Safe Google login handler that chooses popup in iframes to prevent X-Frame-Options 404/sad page
  const loginWithGoogle = useCallback(async () => {
    if (isRunningInIframe()) {
      return await handleLoginWithGooglePopup();
    } else {
      return await loginAdminWithGoogleRedirect();
    }
  }, [handleLoginWithGooglePopup]);

  const value: AuthContextValue = {
    user,
    isAdmin,
    isLoading,
    isIframe,
    isRedirectProcessing,
    redirectError,
    clearRedirectError,
    loginWithEmail: handleLoginWithEmail,
    loginWithGooglePopup: handleLoginWithGooglePopup,
    loginWithGoogleRedirect: loginAdminWithGoogleRedirect,
    loginWithGoogle,
    logout: logoutAdmin,
    refreshAdminStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}


