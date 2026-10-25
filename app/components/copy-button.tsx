"use client";

import { useState } from "react";

type CopyButtonProps = {
  text: string;
  label?: string;
};

const COPIED_FEEDBACK_MS = 1_500;

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="btn btn-ghost btn-xs" onClick={handleCopy} disabled={!text}>
      {copied ? "Copied" : label}
    </button>
  );
}
