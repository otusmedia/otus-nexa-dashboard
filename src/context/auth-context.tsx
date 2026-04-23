"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppUser } from "@/types";

const STORAGE_KEY = "rr-auth-user-id";
const CURRENT_USER_KEY = "currentUser";

function readPersistedUserForSession(sessionId: string | null): AppUser | null {
  if (!sessionId) return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    if (parsed && typeof parsed.id === "string" && parsed.id === sessionId) {
      return parsed;
    }
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
  return null;
}

type AuthContextValue = {
  sessionUserId: string | null;
  persistedUser: AppUser | null;
  isReady: boolean;
  login: (user: AppUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [persistedUser, setPersistedUser] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const rawId = localStorage.getItem(STORAGE_KEY);
    const id = rawId && rawId.length > 0 ? rawId : null;
    setSessionUserId(id);
    setPersistedUser(readPersistedUserForSession(id));
    setIsReady(true);
  }, []);

  const login = useCallback((user: AppUser) => {
    setSessionUserId(user.id);
    setPersistedUser(user);
    localStorage.setItem(STORAGE_KEY, user.id);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setSessionUserId(null);
    setPersistedUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessionUserId,
      persistedUser,
      isReady,
      login,
      logout,
    }),
    [sessionUserId, persistedUser, isReady, login, logout],
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
