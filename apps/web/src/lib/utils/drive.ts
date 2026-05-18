const DRIVE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]+)/,
  /\/api\/v1\/drive\/([a-zA-Z0-9_-]+)/,
];

export function getDriveFileId(value: string) {
  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function toDriveViewerUrl(value: string) {
  const fileId = getDriveFileId(value);
  if (!fileId) {
    return value;
  }

  return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
}
