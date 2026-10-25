import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { authService, RegisterMetadata } from '../services/authService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export type { User, Role };

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, metadata: RegisterMetadata) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<User>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1. Initial session restoration from Supabase or cached storage
    const initSession = async () => {
      try {
        const currentUser = await authService.restoreSession();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initSession();

    // 2. Real-time Supabase Auth state listener
    let authSubscription: { unsubscribe: () => void } | null = null;

    if (isSupabaseConfigured) {
      try {
        const { data: listener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            // Defer async operations to avoid deadlocking GoTrueClient._notifyAllSubscribers
            setTimeout(async () => {
              if (!mounted) return;

              if (event === 'SIGNED_IN' && session?.user) {
                if (authService.isRegistrationInProgress()) {
                  console.log('AUTH: Ignoring SIGNED_IN event during registration');
                  return;
                }
                const profile = await authService.fetchProfile(session.user.id);
                const mapped = authService.mapProfileToUser(profile, session.user);
                setUser(mapped);
                localStorage.setItem('agrilink_user', JSON.stringify(mapped));
                authService.syncToUsersList(mapped);
              } else if (event === 'SIGNED_OUT') {
                setUser(null);
                localStorage.removeItem('agrilink_user');
              } else if (event === 'USER_UPDATED' && session?.user) {
                const profile = await authService.fetchProfile(session.user.id);
                const mapped = authService.mapProfileToUser(profile, session.user);
                setUser(mapped);
                localStorage.setItem('agrilink_user', JSON.stringify(mapped));
                authService.syncToUsersList(mapped);
              } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                // Token refreshed: avoid DB call to prevent recursive token-refresh storm
                setUser((prev) => (prev ? { ...prev, email: session.user.email || prev.email } : null));
              }
            }, 0);
          }
        );
        authSubscription = listener.subscription;
      } catch (e) {
        console.warn('Could not register Supabase auth state listener:', e);
      }
    }

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const loggedInUser = await authService.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (
    email: string,
    password: string,
    metadata: RegisterMetadata
  ): Promise<void> => {
    await authService.register(email, password, metadata);
    setUser(null);
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
  };

  const updateProfile = async (updates: Partial<User>): Promise<User> => {
    const updated = await authService.updateProfile(updates);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
