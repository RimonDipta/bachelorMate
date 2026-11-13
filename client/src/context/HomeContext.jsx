import { createContext, useContext } from "react";

export const HomeContext = createContext(null);

/** Current home + permission helpers for pages under /h/:homeId. */
export function useHome() {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error("useHome must be used inside a home route");
  return ctx;
}

export function buildHomeContext(home) {
  const perms = new Set(home.permissions || []);
  const roles = home.myMembership?.roles || [];
  return {
    home,
    homeId: home._id,
    currency: home.currency,
    membershipId: home.myMembership?._id,
    roles,
    isAdmin: roles.includes("admin"),
    can: (...p) => p.some((x) => perms.has(x)),
    archived: home.status === "archived",
  };
}
