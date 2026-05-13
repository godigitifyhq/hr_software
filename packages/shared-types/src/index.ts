/**
 * Shared TypeScript types used across services
 */

export type UUID = string;

export type RoleName =
    | 'FACULTY'
    | 'EMPLOYEE'
    | 'HOD'
    | 'COMMITTEE'
    | 'HR'
    | 'MANAGEMENT'
    | 'SUPER_ADMIN';

export interface IUser {
    id: UUID;
    email: string;
    firstName: string;
    lastName: string;
    departmentId?: UUID;
}
