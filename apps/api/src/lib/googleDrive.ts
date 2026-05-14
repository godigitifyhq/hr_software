import { Readable } from "stream";
import fs from "node:fs";
import path from "node:path";
import { google, drive_v3 } from "googleapis";
import axios from "axios";

export type DriveUploadInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folderId?: string | null;
  description?: string;
  appProperties?: Record<string, string>;
};

export type DriveUploadResult = {
  driveFileId: string;
  viewUrl: string;
  directUrl: string;
  folderId: string | null;
  mimeType: string;
  fileName: string;
};

let driveClient: drive_v3.Drive | null = null;

function findServiceAccountFileFromWorkspace() {
  const cwd = process.cwd();
  const candidateDirs = [cwd, path.join(cwd, "apps", "api")];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    const explicitCandidate = path.join(dir, "hr-appraisel-9f94b128655c.json");
    if (fs.existsSync(explicitCandidate)) {
      return explicitCandidate;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const jsonCredential = entries.find(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        /appraisel|service[-_]?account|credentials/i.test(entry.name),
    );

    if (jsonCredential) {
      return path.join(dir, jsonCredential.name);
    }
  }

  return null;
}

function getDriveCredentials() {
  const serviceAccountJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  const serviceAccountFile =
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE ||
    findServiceAccountFileFromWorkspace();

  if (serviceAccountFile) {
    const fileContent = fs.readFileSync(serviceAccountFile, "utf-8");
    const parsed = JSON.parse(fileContent) as {
      client_email?: string;
      private_key?: string;
    };

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error(
        "GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE must point to JSON containing client_email and private_key",
      );
    }

    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  }

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson) as {
      client_email?: string;
      private_key?: string;
    };

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error(
        "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON must include client_email and private_key",
      );
    }

    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  }

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google Drive credentials are missing. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE, GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON, or GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY.",
    );
  }

  return {
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const { clientEmail, privateKey } = getDriveCredentials();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

/**
 * Upload file buffer to Google Drive via Google Apps Script webhook.
 *
 * This function POSTs the file to a pre-deployed Apps Script that handles:
 * - Direct Drive API calls within the Google Workspace context
 * - File creation and permission setting in Workspace Drive
 * - Automatic integration with Workspace features
 *
 * WHY APPS SCRIPT:
 * - Allows impersonation/delegation within Workspace
 * - Simplifies permission management for workspace users
 * - No service account emails visible in file ownership
 * - Easier to maintain/update without code redeployment
 *
 * ARGS:
 * - fileBase64: Buffer converted to base64 string
 * - folderId: Google Drive folder ID (where to create file)
 * - Apps Script webhook secret passed server-side only
 *
 * @param input Upload parameters (fileName, mimeType, buffer, folderId, etc.)
 * @returns Upload result with driveFileId, viewUrl, directUrl
 */
export async function uploadBufferViaAppsScript(
  input: DriveUploadInput,
): Promise<DriveUploadResult> {
  const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const appsScriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  const folderId = input.folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? null;

  if (!appsScriptUrl) {
    throw new Error(
      "GOOGLE_APPS_SCRIPT_URL environment variable is not set. " +
        "Apps Script webhook URL required for file uploads.",
    );
  }

  if (!appsScriptSecret) {
    throw new Error(
      "GOOGLE_APPS_SCRIPT_SECRET environment variable is not set. " +
        "Webhook secret required for authentication.",
    );
  }

  if (!folderId) {
    throw new Error(
      "Google Drive folder ID is required but not configured. " +
        "Set GOOGLE_DRIVE_FOLDER_ID or module-specific folder vars.",
    );
  }

  // Convert buffer to base64 for transmission
  const fileBase64 = input.buffer.toString("base64");

  try {
    console.log(
      `[GoogleAppsScript] Uploading "${input.fileName}" to folder ${folderId}`,
    );
    console.log(`[GoogleAppsScript] Webhook URL: ${appsScriptUrl}`);
    console.log(
      `[GoogleAppsScript] Payload size: ~${(
        fileBase64.length /
        1024 /
        1024
      ).toFixed(2)} MB`,
    );

    const response = await axios.post(
      appsScriptUrl,
      {
        secret: appsScriptSecret,
        folderId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileBase64,
        // Optional metadata the Apps Script can store
        description: input.description,
        appProperties: input.appProperties,
      },
      {
        timeout: 60000, // 60 second timeout for Apps Script execution
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    console.log(
      `[GoogleAppsScript] HTTP ${response.status} - Response received`,
    );
    console.log(
      `[GoogleAppsScript] Response body:`,
      JSON.stringify(response.data, null, 2),
    );

    // Validate Apps Script response format
    if (!response.data || typeof response.data !== "object") {
      throw new Error("Invalid Apps Script response format");
    }

    const { success, fileId, viewUrl, downloadUrl, error, message } =
      response.data;

    console.log(
      `[GoogleAppsScript] Response:`,
      JSON.stringify(response.data, null, 2),
    );

    if (!success) {
      const errorMsg =
        error ||
        message ||
        `Apps Script upload failed. Full response: ${JSON.stringify(
          response.data,
        )}`;
      throw new Error(errorMsg);
    }

    if (!fileId) {
      throw new Error("Apps Script did not return a file ID");
    }

    if (!viewUrl || !downloadUrl) {
      throw new Error("Apps Script response missing viewUrl or downloadUrl");
    }

    console.log(`[GoogleAppsScript] Upload successful: fileId=${fileId}`);

    return {
      driveFileId: fileId,
      viewUrl,
      directUrl: downloadUrl,
      folderId,
      mimeType: input.mimeType,
      fileName: input.fileName,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorMsg = error.response?.data?.error || error.message;

      if (statusCode === 401 || statusCode === 403) {
        throw new Error(
          `Apps Script authentication failed (${statusCode}). ` +
            "Check GOOGLE_APPS_SCRIPT_SECRET is correct.",
        );
      }

      if (statusCode === 404) {
        throw new Error(
          "Apps Script webhook not found (404). " +
            "Check GOOGLE_APPS_SCRIPT_URL is correct.",
        );
      }

      if (statusCode === 500) {
        throw new Error(
          `Apps Script server error: ${errorMsg}. ` +
            "Check script logs and folder ID permissions.",
        );
      }

      throw new Error(`Apps Script error (HTTP ${statusCode}): ${errorMsg}`);
    }

    if (error instanceof Error && (error as any).code === "ECONNREFUSED") {
      throw new Error(
        "Could not connect to Apps Script webhook. " +
          "Check GOOGLE_APPS_SCRIPT_URL is accessible.",
      );
    }

    throw error;
  }
}

/**
 * LEGACY: Upload file buffer directly to Google Drive via API.
 *
 * This function directly authenticates with Google Drive using service account.
 * Now replaced by uploadBufferViaAppsScript() for Workspace integration.
 *
 * Kept for reference and fallback scenarios.
 */
export async function uploadBufferToDrive(
  input: DriveUploadInput,
): Promise<DriveUploadResult> {
  const drive = getDriveClient();
  const folderId = input.folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? null;
  const media = {
    mimeType: input.mimeType,
    body: Readable.from(input.buffer),
  };

  const createResponse = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: folderId ? [folderId] : undefined,
      mimeType: input.mimeType,
      description: input.description,
      appProperties: input.appProperties,
    },
    media,
    fields: "id, name, mimeType, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  const driveFileId = createResponse.data.id;
  if (!driveFileId) {
    throw new Error("Google Drive did not return a file id");
  }

  await drive.permissions.create({
    fileId: driveFileId,
    supportsAllDrives: true,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  const viewUrl =
    createResponse.data.webViewLink ??
    `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;
  const directUrl = `https://drive.google.com/uc?export=view&id=${driveFileId}`;

  return {
    driveFileId,
    viewUrl,
    directUrl,
    folderId,
    mimeType: input.mimeType,
    fileName: createResponse.data.name ?? input.fileName,
  };
}

export async function deleteDriveFile(driveFileId: string) {
  const drive = getDriveClient();

  try {
    await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
  } catch {
    // Best-effort cleanup only.
  }
}
