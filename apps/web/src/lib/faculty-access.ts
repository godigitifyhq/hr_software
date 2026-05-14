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

export async function resolvePostLoginPath(roles: string[] = []) {
  const primaryRole = getPrimaryRole(roles);

  // If user is not faculty or employee, use default role-based navigation
  if (!userHasFacultyOrEmployeeRole(roles)) {
    return getRoleHomePath(primaryRole);
  }

  // For faculty/employee, check profile completion
  const response = await api.faculty.getProfile();
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

  const response = await api.faculty.getProfile();
  return response.data.isProfileComplete ? null : "/profile?complete=1";
}
