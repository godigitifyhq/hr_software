// apps/web/src/lib/utils/routing.ts
export type UiRole =
  | "EMPLOYEE"
  | "HOD"
  | "COMMITTEE"
  | "HR"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "FACULTY"
  | "MANAGEMENT";

export function getRoleHomePath(role: UiRole): string {
  switch (role) {
    case "HOD":
      return "/hod-review";
    case "COMMITTEE":
      return "/committee-review";
    case "SUPER_ADMIN":
      return "/super-admin-dashboard";
    case "HR":
    case "ADMIN":
      return "/hr-dashboard";
    case "EMPLOYEE":
    default:
      return "/appraisals";
  }
}

export function getPrimaryRole(roles: string[] = []): UiRole {
  const priority: UiRole[] = [
    "SUPER_ADMIN",
    "ADMIN",
    "HR",
    "HOD",
    "COMMITTEE",
    "EMPLOYEE",
    "FACULTY",
    "MANAGEMENT",
  ];
  return priority.find((role) => roles.includes(role)) ?? "EMPLOYEE";
}
