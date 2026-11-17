export interface PostAuthContext {
  role?: string | null;
  needsOnboarding?: boolean;
  activeOrgId?: string | null;
  organizations?: readonly unknown[] | null;
}

export function resolvePostAuthDestination(ctx: PostAuthContext): string {
  if (ctx.role === "admin") return "/admin/metrics";
  if (ctx.needsOnboarding === true) return "/home/onboarding";
  if (Array.isArray(ctx.organizations)) {
    if (ctx.organizations.length === 0) return "/home/onboarding";
    if (!ctx.activeOrgId && ctx.organizations.length > 1) return "/home/organizations";
  }
  return "/home";
}
