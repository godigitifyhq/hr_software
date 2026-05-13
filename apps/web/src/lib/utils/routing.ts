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
    case "FACULTY":
      return "/faculty-dashboard";
    case "EMPLOYEE":
      return "/employee-dashboard";
    case "HOD":
      return "/hod-review";
    case "COMMITTEE":
      return "/committee-review";
    case "SUPER_ADMIN":
      return "/super-admin-dashboard";
    case "HR":
    case "ADMIN":
      return "/hr-dashboard";
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
    "FACULTY",
    "EMPLOYEE",
    "MANAGEMENT",
  ];
  return priority.find((role) => roles.includes(role)) ?? "EMPLOYEE";
}
