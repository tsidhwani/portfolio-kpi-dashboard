"use client";

/** Triggers the browser print dialog — "Save as PDF" from there. */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn no-print">
      {label}
    </button>
  );
}
