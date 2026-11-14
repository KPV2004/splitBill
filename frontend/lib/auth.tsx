"use client";

/**
 * Session state for the whole app. The session itself is an HttpOnly cookie
 * the browser sends on every `/api/*` request; this provider only remembers
 * who that cookie belongs to (from `GET /auth/me`) so screens can redirect
 * and greet the user.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as api from "./api";
import type { Credentials, SessionUser } from "./api";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: SessionUser }
  | { status: "error"; error: unknown };

interface AuthValue {
  state: AuthState;
  login: (credentials: Credentials) => Promise<void>;
  register: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-check the session, e.g. after a request came back 401 or the server was down. */
  refresh: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchSession()
      .then((user) => {
        if (cancelled) return;
        setState(user ? { status: "signed-in", user } : { status: "signed-out" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [checkCount]);

  const login = useCallback(async (credentials: Credentials) => {
    const user = await api.login(credentials);
    setState({ status: "signed-in", user });
  }, []);

  const register = useCallback(async (credentials: Credentials) => {
    const user = await api.register(credentials);
    setState({ status: "signed-in", user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // Even if the request failed, stop treating this tab as signed in.
      setState({ status: "signed-out" });
    }
  }, []);

  const refresh = useCallback(() => {
    setState({ status: "loading" });
    setCheckCount((count) => count + 1);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ state, login, register, logout, refresh }),
    [state, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** Client-side checks that mirror the backend's registration rules. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
export const MIN_PASSWORD_LENGTH = 8;
