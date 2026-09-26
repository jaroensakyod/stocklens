"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface SessionMember {
  id: string;
  name: string;
  tier: "starter" | "pro";
  paidUntil: string;
  code: string;
}

interface AuthState {
  member: SessionMember | null;
  loading: boolean;
  login: (code: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  /** สิทธิ์: "free" = ไม่ได้ login · "starter" · "pro" */
  tier: "free" | "starter" | "pro";
  /** 🛡️ โหมดแอดมิน (ล็อกอินด้วยรหัส /admin) — ไม่แสดงลายน้ำรายสมาชิก */
  admin: boolean;
  adminLogin: (code: string) => Promise<{ ok: boolean; error?: string }>;
  adminLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  member: null,
  loading: true,
  login: async () => ({ ok: false }),
  logout: async () => {},
  tier: "free",
  admin: false,
  adminLogin: async () => ({ ok: false }),
  adminLogout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<SessionMember | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        setMember(j.member ?? null);
        setAdmin(j.admin === true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const adminLogin = useCallback(async (code: string) => {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (res.ok) {
        setAdmin(true);
        return { ok: true };
      }
      return { ok: false, error: j.error || "รหัสแอดมินไม่ถูกต้อง" };
    } catch {
      return { ok: false, error: "เชื่อมต่อไม่สำเร็จ" };
    }
  }, []);

  const adminLogout = useCallback(async () => {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {});
    setAdmin(false);
  }, []);

  const login = useCallback(async (code: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (res.ok && j.member) {
        setMember(j.member);
        return { ok: true };
      }
      return { ok: false, error: j.error || "เข้าสู่ระบบไม่สำเร็จ" };
    } catch {
      return { ok: false, error: "เชื่อมต่อไม่สำเร็จ" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMember(null);
  }, []);

  return (
    <AuthContext.Provider value={{ member, loading, login, logout, tier: member ? member.tier : "free", admin, adminLogin, adminLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** ตัวช่วยเช็คสิทธิ์ฟีเจอร์ */
export function useCan() {
  const { tier } = useAuth();
  return {
    starter: tier === "starter" || tier === "pro",
    pro: tier === "pro",
    tier,
  };
}
