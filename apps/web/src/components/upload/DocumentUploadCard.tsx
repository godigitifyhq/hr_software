"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RotateCw,
  Upload,
} from "lucide-react";
import type { ChangeEvent } from "react";
import type {
  FacultyDocumentSummary,
  FacultyDocumentUploadConfig,
} from "@svgoi/shared-types";
import type {
  UploadProgressSnapshot,
  UploadedDocumentResponse,
} from "@/lib/api";

type DocumentUploadCardProps = {
  config: FacultyDocumentUploadConfig;
  document?: FacultyDocumentSummary | null;
  disabled?: boolean;
  onUpload: (
    file: File,
    onProgress: (progress: UploadProgressSnapshot) => void,
  ) => Promise<UploadedDocumentResponse>;
  onUploaded?: (document: UploadedDocumentResponse) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toReadableName(fieldKey: string) {
  return fieldKey
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function toReadableMime(mime: string) {
  switch (mime) {
    case "image/jpeg":
      return "JPG";
    case "image/png":
      return "PNG";
    case "image/webp":
      return "WEBP";
    case "application/pdf":
      return "PDF";
    default:
      return mime;
  }
}

export function DocumentUploadCard({
  config,
  document,
  disabled,
  onUpload,
  onUploaded,
}: DocumentUploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "error" | "success"
  >(document ? "success" : "idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const allowImagePreview = useMemo(() => {
    const mime = document?.mime ?? selectedFile?.type ?? "";
    return mime.startsWith("image/");
  }, [document?.mime, selectedFile?.type]);

  const previewUrl = document?.directUrl ?? document?.viewUrl ?? null;
  const uploadedUrl = document?.viewUrl ?? document?.directUrl ?? null;
  const currentLabel = document?.name || config.label;
  const acceptedFormats = config.accept.map(toReadableMime).join(" / ");

  function validateFile(file: File) {
    if (!config.accept.includes(file.type)) {
      return `Unsupported file type. Allowed: ${config.accept.join(", ")}`;
    }

    if (file.size > config.maxSizeBytes) {
      return `${config.label} must be ${formatFileSize(
        config.maxSizeBytes,
      )} or less.`;
    }

    return null;
  }

  async function startUpload(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setStatus("error");
      setError(validationError);
      setSelectedFile(file);
      return;
    }

    try {
      setStatus("uploading");
      setError(null);
      setSelectedFile(file);
      setProgress(0);

      const uploaded = await onUpload(file, (progressSnapshot) => {
        setProgress(progressSnapshot.progress);
      });

      setStatus("success");
      setProgress(100);
      setSelectedFile(null);
      setError(null);
      onUploaded?.(uploaded);
    } catch (uploadError: any) {
      setStatus("error");
      setProgress(0);
      setError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          `Failed to upload ${config.label}`,
      );
    }
  }

  async function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await startUpload(file);
    event.target.value = "";
  }

  return (
    <section className="rounded-2xl border border-border/80 bg-gradient-to-br from-surface via-surface to-brand-light/30 p-5 shadow-sm transition hover:border-border-strong">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-text">
              {config.label}
            </h3>
            {config.required ? (
              <span className="rounded-full border border-danger/20 bg-danger-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-danger">
                Required
              </span>
            ) : (
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-text-2">
                Optional
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-text-2">
            {config.helperText}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wider text-text-2">
            <span className="rounded-full border border-border bg-surface px-2 py-1">
              {acceptedFormats}
            </span>
            <span className="rounded-full border border-border bg-surface px-2 py-1">
              Max {formatFileSize(config.maxSizeBytes)}
            </span>
          </div>
        </div>

        {status === "success" ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success-bg px-3 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Uploaded
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1.35fr_1fr] sm:items-stretch">
        <button
          type="button"
          disabled={disabled || status === "uploading"}
          onClick={() => inputRef.current?.click()}
          className="group flex min-h-36 w-full items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface px-5 py-6 text-left transition hover:border-brand hover:bg-brand-light/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand transition group-hover:scale-105">
              {status === "uploading" ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              ) : (
                <Upload className="h-5 w-5 text-brand" />
              )}
            </span>
            <div>
              <p className="text-base font-semibold text-text">
                {status === "uploading"
                  ? `Uploading ${config.label.toLowerCase()}...`
                  : document
                  ? `Replace ${config.label}`
                  : `Upload ${config.label}`}
              </p>
              <p className="mt-1 text-sm text-text-2">
                Click to choose a file from your device.
              </p>
            </div>
          </div>
        </button>

        <div className="flex min-w-[14rem] flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          {allowImagePreview && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={config.label}
              className="h-28 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-28 items-center justify-center rounded-xl border border-border bg-bg text-center text-xs text-text-3">
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>
                  {document
                    ? toReadableName(config.fieldKey)
                    : "No file uploaded"}
                </span>
              </div>
            </div>
          )}

          {uploadedUrl ? (
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text transition hover:bg-surface"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open file
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        {status === "uploading" ? (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-text-2">
              <span>Uploading</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-2">
              <div
                className="h-2.5 rounded-full bg-brand transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                if (selectedFile) {
                  void startUpload(selectedFile);
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-danger/20 bg-white px-3 py-1 text-xs font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedFile}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : null}

        {document ? (
          <div className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-text-2">
            Current file:{" "}
            <span className="font-semibold text-text">{currentLabel}</span>
            {document.originalName ? ` · ${document.originalName}` : null}
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={config.accept.join(",")}
        className="hidden"
        onChange={handleInputChange}
      />
    </section>
  );
}
