import { createContext, useContext, useEffect, useState } from "react";
import { supabase, callFunction } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session?.user) {
      setProfile(null);
      setProfileReady(true);
      return;
    }

    setProfileReady(false);

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setProfile(data);
        setProfileReady(true);
        return;
      }

      if (error) {
        console.error("[AuthContext] Echec chargement profil:", error.message, error.code);
      }

      try {
        await callFunction("ensure-profile", {});
        const { data: retryData, error: retryError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (retryError) {
          console.error("[AuthContext] Echec relecture profil:", retryError.message, retryError.code);
        }
        setProfile(retryData);
      } catch (e) {
        console.error("[AuthContext] ensure-profile a echoue:", e);
      }

      setProfileReady(true);
    }

    loadProfile();
  }, [session?.user?.id]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading: session === undefined || (!!session?.user && !profileReady),
    refreshProfile: async () => {
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setProfile(data);
    },
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
