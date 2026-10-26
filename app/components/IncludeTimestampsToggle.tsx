"use client";

import { CHECK_INPUT, CHECK_LABEL } from "@/app/lib/uiStyles";

export default function IncludeTimestampsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={CHECK_LABEL}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className={CHECK_INPUT} />
      Include timestamps
    </label>
  );
}
