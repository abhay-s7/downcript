// Client-safe types, no runtime dependencies -- shared between the parser
// (server-side-ish, but pure) and the renderer/UI.
export type MetaCreativeKind = "video" | "image";

export interface MetaCreative {
  index: number; // 1-based, feeds the Creative_NN naming convention
  kind: MetaCreativeKind;
  url: string;
  title?: string;
}

export type MetaAdType = "video" | "image" | "carousel" | "unknown";

export interface MetaAdManifest {
  adArchiveId: string;
  pageName?: string;
  adType: MetaAdType;
  creatives: MetaCreative[];
}

export class MetaAdUnavailableError extends Error {}

// Which transcript export(s) to write for a Meta Ads video creative --
// chosen by the user before generating a transcript, so only the formats
// they actually want get written (unlike the main Transcript module, this
// writes straight to disk rather than an on-demand browser download, so
// there's no equivalent of "click Export DOCX whenever you feel like it"
// here -- the choice has to be made up front, at generate time).
export type TranscriptFormat = "txt" | "docx" | "srt";
export const TRANSCRIPT_FORMATS: TranscriptFormat[] = ["txt", "docx", "srt"];
