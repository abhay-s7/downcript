"use client";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-2 p-4">
      <p className="font-medium text-text mb-1">{title}</p>
      <p className="text-sm text-text-2 mb-4">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="text-sm font-medium px-3.5 py-2 rounded-[9px] border border-line-2 text-text-2 hover:bg-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`text-sm font-medium px-3.5 py-2 rounded-[9px] text-white transition-[filter] hover:brightness-110 ${
            danger ? "bg-danger" : "bg-gradient-to-br from-accent to-accent-2"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
