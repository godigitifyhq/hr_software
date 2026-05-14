// apps/web/src/lib/api.ts
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  FacultyDocumentSummary,
  AppraisalStatus,
  DepartmentSummary,
  FacultyAppraisalPolicy,
  FacultyAppraisalRequestPayload,
  FacultyAppraisalRequestStatus,
  FacultyEvidenceUpload,
  FacultyProfileDocumentFieldKey,
  FacultyProfile,
  FacultyProfilePayload,
} from "@svgoi/shared-types";
import type { LoginInput, RegisterInput } from "@svgoi/zod-schemas";

export type Role =
  | "EMPLOYEE"
  | "HOD"
  | "COMMITTEE"
  | "HR"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "FACULTY"
  | "MANAGEMENT";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
}

export interface AuthResponse {
  accessToken: string;
  user: SessionUser;
}

export interface AppraisalCycleSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  status?: string;
}

export interface AppraisalItemSummary {
  id: string;
  key?: string;
  label?: string;
  points?: number | null;
  selfScore?: number | null;
  hodScore?: number | null;
  committeeScore?: number | null;
  weight: number;
  notes?: string | null;
}

export interface AppraisalSummary {
  id: string;
  userId: string;
  cycleId: string;
  status: AppraisalStatus;
  submittedAt?: string | null;
  locked?: boolean;
  finalScore?: number | null;
  finalPercent?: number | null;
  hodRemarks?: string | null;
  committeeNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cycle?: AppraisalCycleSummary;
  user?: SessionUser & { department?: { id: string; name: string } | null };
  items?: AppraisalItemSummary[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  meta?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roles?: Role[];
  } | null;
}

type Envelope<T> = ApiResponse<T>;

export interface UploadProgressSnapshot {
  loaded: number;
  total: number | null;
  progress: number;
}

export interface UploadedDocumentResponse extends FacultyDocumentSummary {
  criterionKey?: string;
  fileName: string;
  url: string;
  validation?: {
    label: string;
    acceptedMimeTypes: string[];
    maxSizeBytes: number;
    required: boolean;
  };
}

async function unwrap<T>(
  request: Promise<{ data: Envelope<T> }>,
): Promise<Envelope<T>> {
  const { data } = await request;
  return data;
}

async function uploadMultipartFile<T>(
  moduleName: string,
  fieldKey: string,
  file: File,
  options?: {
    label?: string;
    metadata?: Record<string, unknown>;
    onUploadProgress?: (progress: UploadProgressSnapshot) => void;
  },
) {
  const formData = new FormData();
  formData.append("file", file);

  if (options?.label) {
    formData.append("label", options.label);
  }

  if (options?.metadata) {
    formData.append("metadata", JSON.stringify(options.metadata));
  }

  return unwrap<T>(
    apiClient.post(`/uploads/${moduleName}/${fieldKey}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (event) => {
        if (!options?.onUploadProgress) {
          return;
        }

        const total = event.total ?? null;
        const progress = total ? Math.round((event.loaded / total) * 100) : 0;
        options.onUploadProgress({ loaded: event.loaded, total, progress });
      },
    }),
  );
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? "";
  const lastName = parts.length > 0 ? parts.join(" ") : firstName;

  return { firstName, lastName };
}

export const api = {
  uploads: {
    uploadDocument: <T = UploadedDocumentResponse>(
      moduleName: string,
      fieldKey: string,
      file: File,
      options?: {
        label?: string;
        metadata?: Record<string, unknown>;
        onUploadProgress?: (progress: UploadProgressSnapshot) => void;
      },
    ) => uploadMultipartFile<T>(moduleName, fieldKey, file, options),
  },
  auth: {
    login: (data: LoginInput) =>
      unwrap<AuthResponse>(apiClient.post("/auth/login", data)),
    register: (data: RegisterInput) => {
      const { firstName, lastName } = splitFullName(data.fullName);

      return unwrap<{ id: string; email: string }>(
        apiClient.post("/auth/register", {
          email: data.email,
          password: data.password,
          firstName,
          lastName,
          departmentId: data.departmentId || undefined,
        }),
      );
    },
    logout: () => unwrap<{ message: string }>(apiClient.post("/auth/logout")),
    refresh: () =>
      unwrap<{ accessToken: string }>(apiClient.post("/auth/refresh")),
  },
  appraisals: {
    list: () => unwrap<AppraisalSummary[]>(apiClient.get("/appraisals")),
    getById: (id: string) =>
      unwrap<AppraisalSummary>(apiClient.get(`/appraisals/${id}`)),
    update: (
      id: string,
      data: {
        items: Array<{
          id?: string;
          key: string;
          points: number;
          weight: number;
          notes?: string;
        }>;
        status?: AppraisalStatus;
      },
    ) => unwrap<AppraisalSummary>(apiClient.put(`/appraisals/${id}`, data)),
    submit: (id: string) =>
      unwrap<AppraisalSummary>(apiClient.post(`/appraisals/${id}/submit`)),
  },
  hod: {
    getTeamAppraisals: () =>
      unwrap<AppraisalSummary[]>(apiClient.get("/hod/review-list")),
    getScorePreview: (data: Record<string, unknown>) =>
      unwrap<Record<string, unknown>>(
        apiClient.post("/hod/scoring/preview", data),
      ),
    submitReview: (
      id: string,
      data: { metrics: Record<string, unknown>; remarks?: string },
    ) =>
      unwrap<Record<string, unknown>>(
        apiClient.post(`/hod/appraisals/${id}/score`, data),
      ),
    getFacultyRequests: () =>
      unwrap<Record<string, unknown>[]>(apiClient.get("/hod/requests")),
    getFacultyRequestById: (id: string) =>
      unwrap<Record<string, unknown>>(apiClient.get(`/hod/requests/${id}`)),
    submitFacultyReview: (
      id: string,
      payload: {
        items: Array<{
          itemId: string;
          approvedPoints: number;
          remark?: string;
        }>;
        additionalPoints?: number;
        additionalPointsRemark?: string;
        overallRemark?: string;
      },
    ) =>
      unwrap<Record<string, unknown>>(
        apiClient.put(`/hod/requests/${id}/review`, payload),
      ),
  },
  committee: {
    getTeamAppraisals: () =>
      unwrap<AppraisalSummary[]>(apiClient.get("/committee/review-list")),
    submitReview: (id: string, data: { notes: string }) =>
      unwrap<AppraisalSummary>(
        apiClient.post(`/appraisals/${id}/committee-review`, data),
      ),
  },
  hr: {
    getDashboardStats: () =>
      unwrap<Record<string, unknown>>(
        apiClient.get("/appraisals/hr/dashboard"),
      ),
    getAuditLogs: (params?: Record<string, string | number | undefined>) =>
      unwrap<AuditLogEntry[]>(apiClient.get("/audit-logs", { params })),
    getEmployees: () =>
      unwrap<Record<string, unknown>>(apiClient.get("/users")),
    getCycles: () =>
      unwrap<Record<string, unknown>>(apiClient.get("/appraisal-cycles")),
    getSubmissions: () =>
      unwrap<Record<string, unknown>>(apiClient.get("/appraisals")),
  },
  departments: {
    list: () => unwrap<DepartmentSummary[]>(apiClient.get("/departments")),
  },
  faculty: {
    getProfile: () => unwrap<FacultyProfile>(apiClient.get("/faculty/profile")),
    saveProfile: (data: FacultyProfilePayload) =>
      unwrap<FacultyProfile>(apiClient.put("/faculty/profile", data)),
    uploadImage: (
      file: File,
      options?: {
        label?: string;
        metadata?: Record<string, unknown>;
        onUploadProgress?: (progress: UploadProgressSnapshot) => void;
      },
    ) =>
      api.uploads.uploadDocument(
        "faculty-profile",
        "profilePicture",
        file,
        options,
      ),
    uploadDocument: (
      fieldKey: FacultyProfileDocumentFieldKey,
      file: File,
      options?: {
        label?: string;
        metadata?: Record<string, unknown>;
        onUploadProgress?: (progress: UploadProgressSnapshot) => void;
      },
    ) => api.uploads.uploadDocument("faculty-profile", fieldKey, file, options),
    getAppraisalPolicy: () =>
      unwrap<FacultyAppraisalPolicy>(
        apiClient.get("/faculty/appraisal/policy"),
      ),
    getAppraisalStatus: () =>
      unwrap<FacultyAppraisalRequestStatus>(
        apiClient.get("/faculty/appraisal/status"),
      ),
    uploadAppraisalEvidence: (
      criterionKey: string,
      file: File,
      options?: {
        label?: string;
        metadata?: Record<string, unknown>;
        onUploadProgress?: (progress: UploadProgressSnapshot) => void;
      },
    ) =>
      api.uploads.uploadDocument<FacultyEvidenceUpload>(
        "appraisal-evidence",
        criterionKey,
        file,
        { label: criterionKey, ...options },
      ),
    submitAppraisalRequest: (payload: FacultyAppraisalRequestPayload) =>
      unwrap<Record<string, unknown>>(
        apiClient.post("/faculty/appraisal/request", payload),
      ),
  },
};

export type { ApiResponse };
