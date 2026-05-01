import type { UserToolShareRole, UserToolSource } from "../types";

const SHARE_ROLE_RANK: Record<UserToolShareRole, number> = {
  runner: 1,
  editor: 2,
};

export function resolveEffectiveUserToolShareRole(
  ...roles: Array<string | null | undefined>
): UserToolShareRole | null {
  return roles.reduce<UserToolShareRole | null>((best, role) => {
    if (role !== "runner" && role !== "editor") {
      return best;
    }
    if (!best || SHARE_ROLE_RANK[role] > SHARE_ROLE_RANK[best]) {
      return role;
    }
    return best;
  }, null);
}

export function isAgentExecutionSource(source: UserToolSource): boolean {
  return source === "agent" || source === "line";
}
