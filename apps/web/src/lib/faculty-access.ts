"use client";

import { api } from "@/lib/api";
import { getPrimaryRole, getRoleHomePath } from "@/lib/utils/routing";

export function userHasFacultyOrEmployeeRole(roles: string[] = []) {
  return roles.includes("FACULTY") || roles.includes("EMPLOYEE");
}

export function userHasFacultyRole(roles: string[] = []) {
  return roles.includes("FACULTY");
}

function canBypassFacultyGate(pathname: string) {
  return (
    pathname.startsWith("/profile") || pathname.startsWith("/unauthorized")
  );
}

// The route guard below and the faculty/employee dashboard pages each need
// the same profile fetch within moments of one another on every navigation.
// A short-lived shared cache (same module-level-promise pattern as
// useFilterData) lets them share one network call instead of firing two.
// Cleared immediately on profile save so edits are never read stale.
type ProfileResponse = Awaited<ReturnType<typeof api.faculty.getProfile>>;
let cachedProfilePromise: Promise<ProfileResponse> | null = null;
let cachedProfileAt = 0;
const PROFILE_CACHE_TTL_MS = 15_000;

export function getCachedFacultyProfile(): Promise<ProfileResponse> {
  const isFresh =
    cachedProfilePromise && Date.now() - cachedProfileAt < PROFILE_CACHE_TTL_MS;

  if (!isFresh) {
    cachedProfileAt = Date.now();
    cachedProfilePromise = api.faculty.getProfile().catch((error) => {
      cachedProfilePromise = null;
      throw error;
    });
  }

  return cachedProfilePromise!;
}

export function invalidateFacultyProfileCache() {
  cachedProfilePromise = null;
}

export async function resolvePostLoginPath(roles: string[] = []) {
  const primaryRole = getPrimaryRole(roles);

  // If user is not faculty or employee, use default role-based navigation
  if (!userHasFacultyOrEmployeeRole(roles)) {
    return getRoleHomePath(primaryRole);
  }

  // For faculty/employee, check profile completion
  const response = await getCachedFacultyProfile();
  return response.data.isProfileComplete
    ? getRoleHomePath(primaryRole)
    : "/profile?complete=1";
}

export async function resolveFacultyGuardRedirect(
  roles: string[] = [],
  pathname: string,
) {
  if (!userHasFacultyOrEmployeeRole(roles) || canBypassFacultyGate(pathname)) {
    return null;
  }

  const response = await getCachedFacultyProfile();
  return response.data.isProfileComplete ? null : "/profile?complete=1";
}
