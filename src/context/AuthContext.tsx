import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  /** True while the session is being restored. */
  loading: boolean;
  /** Result of the is_admin() RPC for the current user (false when logged out). */
  isAdmin: boolean;
  /** True while is_admin() is being checked for the current session. */
  adminLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Which user id the isAdmin value belongs to; avoids showing a stale result after a user switch.
  const [adminFor, setAdminFor] = useState<{ userId: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase.rpc("is_admin").then(({ data, error }) => {
      if (!active) return;
      setAdminFor({ userId, isAdmin: !error && data === true });
    });
    return () => { active = false; };
  }, [userId]);

  const isAdmin = !!userId && adminFor?.userId === userId && adminFor.isAdmin;
  const adminLoading = !!userId && adminFor?.userId !== userId;

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? error.message : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin, adminLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- co-locating the hook with its provider is intentional
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
