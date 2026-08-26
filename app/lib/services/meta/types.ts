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
