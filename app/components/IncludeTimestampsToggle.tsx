"use client";

// Same plain-checkbox style as the Settings panel's "Completion sound"
// toggle -- deliberately not a segmented button pair like OutputFormatToggle,
// since this is a single on/off choice, not a pick-one-of-several.
export default function IncludeTimestampsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-blue-600"
      />
      Include timestamps
    </label>
  );
}
