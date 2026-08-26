// Shared filename rules used everywhere a job (transcript export, download,
// or Meta ad creative) turns into a real file on disk. Previously
// re-implemented per-component for exports; downloads and Meta creatives
// need the same rules plus real collision-safe dedup, since unlike a browser
// download they write straight to the filesystem with no OS-level "(1)"
// fallback.

// Strips a file extension and any character illegal in a Windows or macOS
// filename, so the same sanitized name is safe on both target platforms.
export function sanitizeFileBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^/.]+$/, "");
  const sanitized = withoutExtension.replace(/[\\/:*?"<>|]/g, "_").trim();
  return sanitized || "file";
}

export function sanitizePathSegment(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "file";
}
