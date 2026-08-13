import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Auth getSession:", error.message);
      }
      setSession((prev) => (prev === undefined ? (data?.session ?? null) : prev));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    setProfile(data);
    return data;
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    refreshProfile();
  }, [session?.user?.id, refreshProfile]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading: session === undefined,
    refreshProfile,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
