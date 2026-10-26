// Shared className strings for the "Porcelain" design (see
// app/globals.css for the token definitions these reference). Plain
// exported strings, not a component library -- every existing component
// keeps its own markup/structure/logic, only the classNames change, and
// there's no new runtime dependency (no cva/tailwind-variants/clsx).
// Before this file, every component redefined near-identical button/input
// strings locally; centralizing them here is what makes applying one
// consistent visual language across ~25 files tractable.

export const CARD = "bg-surface border border-line rounded-2xl shadow-[0_1px_2px_rgba(20,24,40,.04),0_18px_36px_-24px_rgba(20,24,40,.18)]";
export const CARD_PAD = `${CARD} p-6`;

export const LABEL = "block text-[12.5px] font-medium text-text-2 mb-2";

export const INPUT =
  "w-full h-12 px-3.5 rounded-[10px] border border-line-2 bg-white text-text placeholder:text-text-3 shadow-[0_1px_2px_rgba(20,24,40,.05)_inset] transition-colors focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

export const SELECT =
  "h-12 px-3.5 pr-9 rounded-[10px] border border-line-2 bg-white text-text text-sm appearance-none bg-no-repeat bg-[right_12px_center] transition-colors focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft " +
  "bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%2712%27%20fill=%27none%27%20stroke=%27%236B7183%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%3E%3Cpath%20d=%27M2%204.5l4%204%204-4%27/%3E%3C/svg%3E')]";

export const SELECT_SM = SELECT.replace("h-12", "h-9").replace("text-sm", "text-[13px]");

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[10px] font-medium text-white whitespace-nowrap " +
  "bg-gradient-to-br from-accent to-accent-2 shadow-[0_1px_0_rgba(255,255,255,.5)_inset,0_8px_24px_-6px_var(--color-accent-glow)] " +
  "transition-[filter,box-shadow] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[10px] font-medium whitespace-nowrap " +
  "bg-white border border-line-2 text-text transition-colors hover:bg-surface-3 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

export const BTN_SM = "h-9 px-3.5 text-[13px] rounded-[9px]";
export const BTN_PRIMARY_SM = `${BTN_PRIMARY} ${BTN_SM}`;
export const BTN_GHOST_SM = `${BTN_GHOST} ${BTN_SM}`;

// Plain text-link style actions (Library row actions, export-menu items,
// "Change"/"Retry"/"Clear" links) -- the app's most common control, used
// far more than real buttons.
export const LINK = "text-sm text-accent hover:text-text transition-colors";
export const LINK_MUTED = "text-sm text-text-2 hover:text-text transition-colors";
export const LINK_DANGER = "text-sm text-danger hover:brightness-90 transition-[filter]";

export const PATH_CHIP = "font-mono text-xs text-text-2 bg-bg-2 border border-line px-2 py-0.5 rounded-[7px]";

export const CHECK_INPUT = "w-[17px] h-[17px] rounded-[5px] border border-line-2 accent-accent cursor-pointer";
export const CHECK_LABEL = "inline-flex items-center gap-2 text-text-2 cursor-pointer select-none";

export const CHIP = "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-surface-3 text-text-2";
export const CHIP_VIDEO = "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-accent-soft text-accent";
export const CHIP_AUDIO = "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-warn-soft text-warn";
export const CHIP_TRANSCRIPT = "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-ok-soft text-ok";
export const CHIP_DANGER = "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-danger-soft text-danger";

// Segmented control (e.g. Original/Hinglish) and tab-strip (source picker).
export const SEG = "inline-flex p-[3px] bg-bg-2 border border-line rounded-xl gap-0.5";
export const SEG_BTN = "px-3.5 py-1.5 rounded-lg text-[13px] font-medium text-text-2 transition-colors";
export const SEG_BTN_ON = "px-3.5 py-1.5 rounded-lg text-[13px] font-medium text-text bg-surface-3 shadow-[0_0_0_1px_var(--color-line-2)_inset]";

export const TABSTRIP = "flex gap-1 p-[5px] bg-surface border border-line rounded-[14px]";
export const TABSTRIP_BTN = "flex-1 border-0 bg-none px-2.5 py-2.5 rounded-[10px] text-text-2 font-medium text-sm transition-colors hover:text-text";
export const TABSTRIP_BTN_ON = "flex-1 border-0 px-2.5 py-2.5 rounded-[10px] text-text font-medium text-sm bg-surface-3 shadow-[0_0_0_1px_var(--color-line-2)_inset]";

export const DIVIDER = "h-px bg-line my-5";

export const PROGRESS_TRACK = "h-[5px] rounded-full bg-surface-3 overflow-hidden";
export const PROGRESS_FILL =
  "block h-full rounded-full bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_14px_var(--color-accent-glow)] transition-[width]";

export const DROPZONE =
  "border-[1.5px] border-dashed border-line-2 rounded-2xl bg-bg-2 p-11 text-center text-text-3 transition-colors hover:border-accent hover:text-accent hover:bg-accent-soft";

export const EMPTY_CARD = `${CARD} p-10 text-center text-text-3`;

// Split "Export X ▼" buttons (ExportMenu, ExportAllMenu) and their dropdown.
export const EXPORT_BTN_MAIN =
  "bg-gradient-to-br from-accent to-accent-2 text-white px-3.5 py-2 rounded-l-[9px] text-sm font-medium disabled:opacity-50 transition-[filter] hover:brightness-110";
export const EXPORT_BTN_CHEVRON =
  "bg-gradient-to-br from-accent to-accent-2 text-white px-2.5 py-2 rounded-r-[9px] border-l border-white/25 text-sm transition-[filter] hover:brightness-110";
export const EXPORT_DROPDOWN = "absolute right-0 top-full mt-1.5 bg-white border border-line-2 rounded-[10px] shadow-[0_18px_36px_-12px_rgba(20,24,40,.25)] z-10 min-w-[110px] overflow-hidden";
export const EXPORT_DROPDOWN_ITEM = "block w-full text-left px-3.5 py-2 text-sm text-text-2 hover:bg-surface-3 hover:text-text transition-colors";

export const BTN_DANGER_OUTLINE =
  "text-sm font-medium px-3.5 py-2 rounded-[9px] border border-danger/30 text-danger hover:bg-danger-soft transition-colors";
// Persistent state banners (model setup, app updates) -- no equivalent
// element in the reference mockup, so this is a new, consistent treatment
// built from the same tokens (accent-soft background/border) rather than
// the old plain blue-50/blue-200.
export const BANNER_INFO = "mb-6 rounded-2xl border border-accent/20 bg-accent-soft px-4 py-3.5 text-sm";
export const BANNER_INFO_TEXT = "text-text";
export const BANNER_PROGRESS_TRACK = "h-[5px] w-full max-w-md overflow-hidden rounded-full bg-white/60";
export const BANNER_PROGRESS_FILL = "h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width]";

export const BTN_OUTLINE =
  "text-sm font-medium px-3.5 py-2 rounded-[9px] border border-line-2 text-text-2 hover:bg-surface-3 hover:text-text transition-colors disabled:opacity-40 disabled:pointer-events-none";
