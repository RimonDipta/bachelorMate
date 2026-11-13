/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, onAuthLost, refreshSession, setAccessToken } from "../lib/api";
import { disconnectSocket } from "../lib/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  // Restore the session from the httpOnly refresh cookie on load.
  useEffect(() => {
    refreshSession()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    onAuthLost(() => {
      setUser(null);
      disconnectSocket();
    });
  }, []);

  const accept = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setAccessToken(null);
    disconnectSocket();
    setUser(null);
    qc.clear();
  }, [qc]);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      login: async (email, password) => accept(await api.post("/auth/login", { email, password })),
      register: async (body) => accept(await api.post("/auth/register", body)),
      google: async (idToken) => accept(await api.post("/auth/google", { idToken })),
      acceptSession: accept,
      logout,
      refreshUser: async () => setUser((await api.get("/auth/me")).user),
    }),
    [user, loading, accept, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
