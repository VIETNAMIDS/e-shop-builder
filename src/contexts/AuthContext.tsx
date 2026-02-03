import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface SellerProfile {
  id: string;
  display_name: string;
  is_profile_complete: boolean;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_qr_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  sellerProfile: SellerProfile | null;
  needsSellerSetup: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSellerProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [needsSellerSetup, setNeedsSellerSetup] = useState(false);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('Error in checkAdminRole:', err);
      return false;
    }
  };

  const checkSellerProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('id, display_name, is_profile_complete, bank_name, bank_account_name, bank_account_number, bank_qr_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking seller profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error in checkSellerProfile:', err);
      return null;
    }
  };

  const updateRoleAndSellerState = async (currentUser: User | null) => {
    if (!currentUser) {
      setIsAdmin(false);
      setSellerProfile(null);
      setNeedsSellerSetup(false);
      return;
    }

    const [isAdminResult, profile] = await Promise.all([
      checkAdminRole(currentUser.id),
      checkSellerProfile(currentUser.id)
    ]);

    setIsAdmin(isAdminResult);
    setSellerProfile(profile);
    setNeedsSellerSetup(isAdminResult && (!profile || !profile.is_profile_complete));
  };

  const refreshSellerProfile = async () => {
    if (!user) return;
    const profile = await checkSellerProfile(user.id);
    setSellerProfile(profile);
    setNeedsSellerSetup(isAdmin && (!profile || !profile.is_profile_complete));
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user ?? null;
        setSession(session);
        setUser(currentUser);
        updateRoleAndSellerState(currentUser);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      updateRoleAndSellerState(currentUser);
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
        },
      },
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setSellerProfile(null);
    setNeedsSellerSetup(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isAdmin, 
      isLoading, 
      sellerProfile, 
      needsSellerSetup, 
      signUp, 
      signIn, 
      signOut,
      refreshSellerProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
