import { Readable } from "stream";
import { google, drive_v3 } from "googleapis";

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

function getDriveCredentials() {
  const serviceAccountJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

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
      "Google Drive credentials are missing. Set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY, or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.",
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
