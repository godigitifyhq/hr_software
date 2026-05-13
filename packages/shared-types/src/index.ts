/**
 * Shared TypeScript types used across services
 */

export type UUID = string;

export type AppraisalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "HOD_REVIEW"
  | "COMMITTEE_REVIEW"
  | "HR_FINALIZED"
  | "CLOSED";

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type RoleName =
  | "FACULTY"
  | "EMPLOYEE"
  | "HOD"
  | "COMMITTEE"
  | "HR"
  | "MANAGEMENT"
  | "SUPER_ADMIN";

export interface IUser {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  departmentId?: UUID;
}
