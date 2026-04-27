"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import type { AppUser, ModuleKey, Role, UserCompany } from "@/types";
import { ALL_MODULE_KEYS } from "@/lib/modules";
import { supabase } from "@/lib/supabase";

type AppUserDbRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  company: string | null;
  modules: string[] | null;
  password_hash: string | null;
};

const LOGIN_SEED: Array<{
  name: string;
  email: string;
  company: UserCompany;
  role: Role;
  modules: ModuleKey[];
}> = [
  {
    name: "Matheus Canci",
    email: "matheuscancci@gmail.com",
    company: "nexa",
    role: "admin",
    modules: [...ALL_MODULE_KEYS],
  },
  {
    name: "David Martins",
    email: "david@nexamedia.com",
    company: "nexa",
    role: "admin",
    modules: [...ALL_MODULE_KEYS],
  },
  {
    name: "Matheus Foletto",
    email: "foletto@otusmedia.com",
    company: "otus",
    role: "admin",
    modules: [...ALL_MODULE_KEYS],
  },
  {
    name: "Joe Maiochi",
    email: "joe.maionchi@rocketride.ai",
    company: "rocketride",
    role: "admin",
    modules: ["dashboard", "projects", "financial", "files", "contracts"],
  },
  {
    name: "Karla Kachuba",
    email: "karla@nexamedia.com",
    company: "nexa",
    role: "manager",
    modules: ["projects", "updates", "marketing", "publishing", "files"],
  },
  {
    name: "Luca",
    email: "luca@otusmedia.com",
    company: "otus",
    role: "manager",
    modules: ["projects", "updates", "marketing", "publishing", "files"],
  },
  {
    name: "Aaron Jimenez",
    email: "aaron.jimenez@rocketride.ai",
    company: "rocketride",
    role: "manager",
    modules: ["projects", "files", "contracts"],
  },
];

const inputClassName =
  "w-full rounded-[6px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-3 text-[0.9rem] font-light text-white placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgba(255,69,0,0.5)] focus:outline-none";

function hashPassword(password: string): string {
  return btoa(unescape(encodeURIComponent(password)));
}

function normalizeUserCompany(value: unknown): UserCompany {
  const s = String(value ?? "").toLowerCase();
  if (s === "nexa") return "nexa";
  if (s === "otus") return "otus";
  if (s === "rocketride") return "rocketride";
  return "";
}

function normalizeUserRole(value: unknown): Role {
  return value === "admin" || value === "manager" ? value : "manager";
}

function normalizeUserModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((m): m is ModuleKey => ALL_MODULE_KEYS.includes(m as ModuleKey));
}

function rowToAppUser(row: AppUserDbRow): AppUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeUserRole(row.role),
    company: normalizeUserCompany(row.company),
    modules: normalizeUserModules(row.modules),
  };
}

function mapRecordToRow(r: Record<string, unknown>): AppUserDbRow {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    email: r.email != null && String(r.email) !== "" ? String(r.email) : null,
    role: String(r.role ?? "manager"),
    company: r.company != null ? String(r.company) : null,
    modules: Array.isArray(r.modules) ? r.modules.map(String) : null,
    password_hash: r.password_hash != null && String(r.password_hash) !== "" ? String(r.password_hash) : null,
  };
}

async function ensureAppUsersSeeded(): Promise<void> {
  const { count, error: countError } = await supabase.from("app_users").select("*", { count: "exact", head: true });
  if (countError) {
    console.error("[login] app_users count failed:", countError.message);
    return;
  }
  if (count != null && count === 0) {
    const { error: seedError } = await supabase.from("app_users").insert(
      LOGIN_SEED.map((u) => ({
        name: u.name,
        email: u.email,
        company: u.company,
        role: u.role,
        modules: u.modules,
      })),
    );
    if (seedError) {
      console.error("[login] app_users seed failed:", seedError.message);
    }
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { isReady, sessionUserId, login, logout } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstAccessUser, setFirstAccessUser] = useState<AppUserDbRow | null>(null);
  const [inlineError, setInlineError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureAppUsersSeeded();
      if (!cancelled) setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !sessionUserId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("app_users").select("*").eq("id", sessionUserId).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        logout();
        return;
      }
      const appUser = rowToAppUser(mapRecordToRow(data as Record<string, unknown>));
      login(appUser);
      const path = appUser.role === "admin" ? "/dashboard" : "/projects";
      setTimeout(() => router.push(path), 100);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, sessionUserId, router, login, logout]);

  const finishLogin = (user: AppUser) => {
    console.log("Login success, setting user:", user);
    console.log("Redirecting to:", user.company === "rocketride" ? "/projects" : "/dashboard");
    const path = user.role === "admin" ? "/dashboard" : "/projects";
    console.log("Actual path (role):", path);
    login(user);
    setTimeout(() => router.push(path), 100);
  };

  const resetFirstAccess = () => {
    setFirstAccessUser(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSignInSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setInlineError("");
    const trimmed = identifier.trim();
    if (!trimmed) {
      setInlineError("No account found with this email");
      return;
    }

    setBusy(true);
    const { data: byEmail, error: emailErr } = await supabase.from("app_users").select("*").ilike("email", trimmed);
    if (emailErr) {
      console.error("[login] app_users email lookup failed:", emailErr.message);
      setInlineError("No account found with this email");
      setBusy(false);
      return;
    }
    const emailList = (byEmail as Array<Record<string, unknown>> | null) ?? [];
    let user: Record<string, unknown> | undefined = emailList[0];
    if (!user) {
      const { data: byName, error: nameErr } = await supabase.from("app_users").select("*").ilike("name", trimmed);
      if (nameErr) {
        console.error("[login] app_users name lookup failed:", nameErr.message);
        setInlineError("No account found with this email");
        setBusy(false);
        return;
      }
      const nameList = (byName as Array<Record<string, unknown>> | null) ?? [];
      user = nameList[0];
    }
    if (!user) {
      setInlineError("No account found with this email");
      setBusy(false);
      return;
    }

    const row = mapRecordToRow(user);

    if (!row.password_hash) {
      setFirstAccessUser(row);
      setBusy(false);
      return;
    }

    if (!password.trim()) {
      setInlineError("Incorrect password");
      setBusy(false);
      return;
    }

    const storedHash = String(row.password_hash ?? "").trim();
    const hash = hashPassword(password);
    console.log("Stored hash:", storedHash);
    console.log("Entered hash:", hash);
    console.log("Match:", hash === storedHash);
    if (hash !== storedHash) {
      setInlineError("Incorrect password");
      setBusy(false);
      return;
    }

    finishLogin(rowToAppUser(row));
    setBusy(false);
  };

  const handleFirstAccessSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firstAccessUser) return;
    setInlineError("");
    if (newPassword !== confirmPassword) {
      setInlineError("Passwords do not match");
      return;
    }
    setBusy(true);
    const hash = hashPassword(newPassword);
    const { data, error } = await supabase.from("app_users").update({ password_hash: hash }).eq("id", firstAccessUser.id).select("*").single();
    if (error) {
      console.error("[login] app_users password set failed:", error.message);
      setInlineError("Could not save password.");
      setBusy(false);
      return;
    }
    const r = (data as Record<string, unknown>) ?? {};
    const updated: AppUserDbRow = {
      id: String(r.id ?? firstAccessUser.id),
      name: String(r.name ?? firstAccessUser.name),
      email: r.email != null ? String(r.email) : firstAccessUser.email,
      role: String(r.role ?? firstAccessUser.role),
      company: r.company != null ? String(r.company) : firstAccessUser.company,
      modules: Array.isArray(r.modules) ? r.modules.map(String) : firstAccessUser.modules,
      password_hash: r.password_hash != null ? String(r.password_hash) : hash,
    };
    resetFirstAccess();
    finishLogin(rowToAppUser(updated));
    setBusy(false);
  };

  if (!isReady || !bootstrapped) {
    return null;
  }

  return (
    <div className="relative flex h-[100vh] w-[100vw] items-center justify-center overflow-hidden p-4 text-[var(--text)]">
      <img
        src="/Biotecc%20-%202026-159.jpg"
        alt=""
        decoding="async"
        className="pointer-events-none absolute left-0 top-0 z-0 h-[100vh] w-[100vw] object-cover object-center"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-[400px] rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.6)] p-6 shadow-lg backdrop-blur-[12px]">
        <div className="mb-[24px] flex justify-center">
          <div className="flex h-[36.8px] items-center justify-center">
            <img
              src="/frame-1.svg"
              alt="RocketRide logo"
              className="h-[36.8px] w-auto max-w-[93.15px] object-contain object-left"
            />
          </div>
        </div>
        <h1 className="text-center text-[1.2rem] font-light text-white">Welcome back</h1>
        <p className="mb-6 mt-1 text-center text-[0.8rem] text-[rgba(255,255,255,0.4)]">Sign in to your account</p>

        <form onSubmit={firstAccessUser ? handleFirstAccessSubmit : handleSignInSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-center text-[0.75rem] font-light text-[rgba(255,255,255,0.5)]">
              Email or Username
            </label>
            <input
              type="text"
              name="identifier"
              autoComplete="username"
              placeholder="email@example.com or your name"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={!!firstAccessUser}
              className={inputClassName}
              required
            />
          </div>

          {!firstAccessUser ? (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClassName} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[rgba(255,255,255,0.45)] hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
              </button>
            </div>
          ) : null}

          {firstAccessUser ? (
            <div className="space-y-3 border-t border-[rgba(255,255,255,0.08)] pt-4">
              <p className="text-center text-[0.8rem] text-[#fbbf24]">First access — set your password</p>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClassName}
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClassName}
                required
              />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary mt-1 flex w-full items-center justify-center gap-2 rounded-[6px] py-3 text-[0.9rem] font-medium disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
            {firstAccessUser ? "Continue" : "Sign In"}
          </button>
        </form>

        {inlineError ? (
          <p className="mt-3 text-center text-[0.8rem] text-[rgba(239,68,68,0.9)]">{inlineError}</p>
        ) : null}

        {!firstAccessUser ? (
          <div className="mt-4 text-center">
            <span className="text-[0.75rem] text-[rgba(255,255,255,0.4)]">Forgot your password?</span>
          </div>
        ) : (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                resetFirstAccess();
                setInlineError("");
                setPassword("");
              }}
              className="text-[0.75rem] text-[rgba(255,255,255,0.4)] hover:text-white"
            >
              ← Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
