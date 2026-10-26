"use client";

// New shared pill/track toggle for boolean Settings rows -- the app
// previously only had plain checkboxes (still used for Include timestamps,
// TXT/DOCX/SRT, file lists); the reference draws Settings' boolean rows as
// switches specifically, so this is new, not a restyle of an existing one.
export default function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className="relative inline-block w-[42px] h-[25px] flex-shrink-0 cursor-pointer" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute inset-0 opacity-0 m-0 cursor-pointer z-[1] peer"
      />
      <span className="absolute inset-0 rounded-full bg-surface-3 border border-line-2 transition-colors peer-checked:bg-gradient-to-br peer-checked:from-accent peer-checked:to-accent-2 peer-checked:border-transparent peer-checked:shadow-[0_0_16px_var(--color-accent-glow)]" />
      <span className="absolute top-[3px] left-[3px] w-[17px] h-[17px] rounded-full bg-white shadow-[0_1px_3px_rgba(20,24,40,.3)] transition-transform peer-checked:translate-x-[17px]" />
    </label>
  );
}
