"use client";

import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from "firebase/auth";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getClientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { getOrCreateDeviceId, withDeviceHeader } from "@/lib/client/device-id";
import { AppRole } from "@/lib/types/roles";

interface AuthContextValue {
  user: User | null;
  roles: AppRole[];
  name: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeAccountName(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = trimmed.replace(/^welcome\s+to\s+/i, "").trim();
  return cleaned || null;
}

async function safeDeviceLogout(user: User | null) {
  if (!user) {
    return;
  }
  const token = await user.getIdToken();
  await fetch("/api/auth/logout-device", {
    method: "POST",
    headers: {
      ...withDeviceHeader({
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      }),
    },
    body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const firebaseReady = isFirebaseClientConfigured() || process.env.NODE_ENV === "production";
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(firebaseReady);

  useEffect(() => {
    if (!firebaseReady) {
      return;
    }

    let auth;
    try {
      auth = getClientAuth();
    } catch {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setRoles([]);
        setName(null);
        setLoading(false);
        return;
      }

      try {
        const token = await nextUser.getIdToken();
        const response = await fetch("/api/auth/me", {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        });
        if (response.status === 401) {
          await firebaseSignOut(getClientAuth());
          throw new Error("Session expired.");
        }
        const data = (await response.json()) as {
          roles?: AppRole[];
          role?: AppRole;
          name?: string | null;
        };
        const nextRoles =
          Array.isArray(data.roles) && data.roles.length > 0
            ? data.roles
            : data.role
              ? [data.role]
              : [];
        setRoles(nextRoles);
        setName(normalizeAccountName(data.name));
      } catch {
        setRoles([]);
        setName(null);
      } finally {
        setLoading(false);
      }
    });
  }, [firebaseReady]);

  useEffect(() => {
    if (!firebaseReady || !user || !roles.includes("creator")) {
      return;
    }
    let stopped = false;
    const auth = getClientAuth();
    const currentUser = user;
    async function verifyCreatorSession() {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/auth/me", {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        });
        if (response.status === 401 && !stopped) {
          setRoles([]);
          setName(null);
          await firebaseSignOut(auth);
        }
      } catch {}
    }
    const timer = window.setInterval(() => {
      void verifyCreatorSession();
    }, 15000);
    void verifyCreatorSession();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [firebaseReady, roles, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      name,
      loading,
      signOut: async () => {
        if (!firebaseReady) {
          return;
        }
        const auth = getClientAuth();
        await safeDeviceLogout(auth.currentUser);
        await firebaseSignOut(auth);
      },
    }),
    [user, roles, name, loading, firebaseReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
