import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveAccountId, setActiveAccountId } from "@/lib/activeAccount";

export type AccountRole = "owner" | "admin" | "manager" | "sdr" | "viewer";

export interface AccountMembership {
  account_id: string;
  role: AccountRole;
  account: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    is_internal: boolean;
    logo_url: string | null;
  };
}

interface ActiveAccountContextValue {
  loading: boolean;
  memberships: AccountMembership[];
  activeAccountId: string | null;
  role: AccountRole | null;
  isSuperAdmin: boolean;
  switchAccount: (accountId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ActiveAccountContextValue | undefined>(undefined);

export function ActiveAccountProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<AccountMembership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(getActiveAccountId());

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMemberships([]);
      setActiveAccountId(null);
      setActiveId(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("account_members")
      .select("account_id, role, account:accounts(id, name, slug, plan, status, is_internal, logo_url)")
      .eq("user_id", sessionData.session.user.id)
      .eq("status", "active");

    if (error) {
      console.error("[useActiveAccount] failed to load memberships", error);
      setMemberships([]);
      setLoading(false);
      return;
    }

    const list = (data || []) as unknown as AccountMembership[];
    setMemberships(list);

    // Resolve active account
    let next = getActiveAccountId();
    if (!next || !list.find((m) => m.account_id === next)) {
      next = list[0]?.account_id ?? null;
    }
    if (next) {
      setActiveAccountId(next);
      setActiveId(next);
      // Set GUC server-side so RLS helpers can read it (best-effort)
      await supabase.rpc("set_active_account", { _account_id: next }).catch(() => {});
    } else {
      setActiveAccountId(null);
      setActiveId(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const switchAccount = useCallback(async (accountId: string) => {
    setActiveAccountId(accountId);
    setActiveId(accountId);
    await supabase.rpc("set_active_account", { _account_id: accountId }).catch(() => {});
  }, []);

  const active = memberships.find((m) => m.account_id === activeId);
  const role = active?.role ?? null;
  const isSuperAdmin = memberships.some((m) => m.account.is_internal && (m.role === "owner" || m.role === "admin"));

  return (
    <Ctx.Provider
      value={{
        loading,
        memberships,
        activeAccountId: activeId,
        role,
        isSuperAdmin,
        switchAccount,
        refresh: load,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useActiveAccount() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveAccount must be used within ActiveAccountProvider");
  return ctx;
}
