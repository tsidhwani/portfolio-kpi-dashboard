"use client";

/** Triggers the browser print dialog — "Save as PDF" from there. */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print rounded border px-3 py-1 text-sm hover:bg-gray-50"
    >
      {label}
    </button>
  );
}
