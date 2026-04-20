"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppUser } from "@/types";

const STORAGE_KEY = "rr-auth-user-id";

type AuthContextValue = {
  sessionUserId: string | null;
  isReady: boolean;
  login: (user: AppUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    setSessionUserId(raw && raw.length > 0 ? raw : null);
    setIsReady(true);
  }, []);

  const login = useCallback((user: AppUser) => {
    setSessionUserId(user.id);
    localStorage.setItem(STORAGE_KEY, user.id);
  }, []);

  const logout = useCallback(() => {
    setSessionUserId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessionUserId,
      isReady,
      login,
      logout,
    }),
    [sessionUserId, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
