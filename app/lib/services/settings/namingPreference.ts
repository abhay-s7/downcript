import { NamingTemplate } from "@/app/lib/services/filesystem/naming";

// How new files get named: three fixed presets rather than a free-form
// custom template, to keep this simple. localStorage-backed module cache,
// same pattern as downloadConcurrency.ts/completionNotifier.ts -- read
// imperatively from queue/naming code, not just component render bodies.
const STORAGE_KEY = "downcript:namingTemplate";
const DEFAULT_TEMPLATE: NamingTemplate = "creator-title";

function isValidTemplate(value: unknown): value is NamingTemplate {
  return value === "title" || value === "creator-title" || value === "creator-title-platform";
}

let cache: NamingTemplate | null = null;

function readStored(): NamingTemplate {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidTemplate(stored) ? stored : DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function getNamingTemplate(): NamingTemplate {
  if (cache === null) cache = readStored();
  return cache;
}

export function setNamingTemplate(template: NamingTemplate): void {
  cache = template;
  try {
    localStorage.setItem(STORAGE_KEY, template);
  } catch {
    // Private-browsing-style storage block -- the in-memory cache still
    // makes the setting work for the rest of this session.
  }
}

export const NAMING_TEMPLATE_OPTIONS: Array<{ value: NamingTemplate; label: string; example: string }> = [
  { value: "title", label: "Title only", example: "Video Title.mp4" },
  { value: "creator-title", label: "Creator + Title", example: "Creator - Video Title.mp4" },
  {
    value: "creator-title-platform",
    label: "Creator + Title + Platform",
    example: "Creator - Video Title - YouTube.mp4",
  },
];
