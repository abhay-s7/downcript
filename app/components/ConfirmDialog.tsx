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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="font-medium text-gray-900 mb-1">{title}</p>
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`text-sm font-medium px-3 py-1.5 rounded-md text-white transition-colors ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
