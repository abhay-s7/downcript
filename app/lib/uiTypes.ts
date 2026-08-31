// UI-only concept: which input form is showing. Distinct from JobSource in
// jobs.ts (a job's source is "google-drive"; the tab for it is "drive") —
// this file has no bearing on how jobs are processed.
export type Mode = "youtube" | "instagram" | "dailymotion" | "upload" | "drive";

// Top-level app navigation.
export type Section = "home" | "download" | "transcript" | "meta" | "library" | "settings";
