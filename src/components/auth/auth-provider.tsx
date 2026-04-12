"use client";

import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from "firebase/auth";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getClientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { getOrCreateDeviceId } from "@/lib/client/device-id";
import { AppRole } from "@/lib/types/roles";

interface AuthContextValue {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function safeDeviceLogout(user: User | null) {
  if (!user) {
    return;
  }
  const token = await user.getIdToken();
  await fetch("/api/auth/logout-device", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const firebaseReady = isFirebaseClientConfigured() || process.env.NODE_ENV === "production";
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
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
        setLoading(false);
        return;
      }

      try {
        const token = await nextUser.getIdToken();
        const response = await fetch("/api/auth/me", {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          roles?: AppRole[];
          role?: AppRole;
        };
        const nextRoles =
          Array.isArray(data.roles) && data.roles.length > 0
            ? data.roles
            : data.role
              ? [data.role]
              : [];
        setRoles(nextRoles);
      } catch {
        setRoles([]);
      } finally {
        setLoading(false);
      }
    });
  }, [firebaseReady]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
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
    [user, roles, loading, firebaseReady]
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
