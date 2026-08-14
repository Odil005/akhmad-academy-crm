import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/authz";

type AuthenticatedRouteContext = {
  user: User;
  roles: AppRole[];
};

type RoleCache = {
  userId: string;
  roles: AppRole[];
  expiresAt: number;
};

const ROLE_CACHE_MS = 5 * 60_000;
let roleCache: RoleCache | null = null;
let roleRequest: { userId: string; promise: Promise<AppRole[]> } | null = null;

export function clearAuthenticatedRouteCache() {
  roleCache = null;
  roleRequest = null;
}

async function loadRoles(userId: string): Promise<AppRole[]> {
  if (roleRequest?.userId === userId) return roleRequest.promise;

  const promise = Promise.resolve(supabase.from("user_roles").select("role").eq("user_id", userId))
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []).map((row) => row.role as AppRole);
    })
    .finally(() => {
      if (roleRequest?.promise === promise) roleRequest = null;
    });

  roleRequest = { userId, promise };
  return promise;
}

/**
 * Route transitions must not call Supabase Auth and user_roles from scratch.
 * getSession reads the persisted local session; RLS still enforces every data
 * request on the server. Roles are short-lived cached navigation metadata.
 */
export async function getAuthenticatedRouteContext(): Promise<AuthenticatedRouteContext | null> {
  const { data, error } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (error || !user) {
    clearAuthenticatedRouteCache();
    return null;
  }

  if (roleCache?.userId === user.id && roleCache.expiresAt > Date.now()) {
    return { user, roles: roleCache.roles };
  }

  try {
    const roles = await loadRoles(user.id);
    roleCache = { userId: user.id, roles, expiresAt: Date.now() + ROLE_CACHE_MS };
    return { user, roles };
  } catch (loadError) {
    // If the network briefly disconnects, keep navigation usable with the last
    // known roles. Database RLS remains the source of truth for authorization.
    if (roleCache?.userId === user.id) return { user, roles: roleCache.roles };
    throw loadError;
  }
}
