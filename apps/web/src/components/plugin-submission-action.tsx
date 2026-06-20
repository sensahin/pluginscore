"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  normalizePluginSubmissionInput,
  submitPluginForScan,
} from "@/lib/plugin-submission";

export function PluginSubmissionAction({
  input,
  className = "",
}: {
  input: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slug = normalizePluginSubmissionInput(input);

  if (!slug) {
    return null;
  }

  async function submit() {
    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await submitPluginForScan(input);
      router.push(result.pluginUrl);
      router.refresh();
    } catch (submissionError) {
      setError((submissionError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={submit}
        disabled={isSubmitting}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-foreground transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
        Scan &quot;{slug}&quot; from WordPress.org
      </button>
      {error ? <p className="mt-2 text-sm text-risk">{error}</p> : null}
    </div>
  );
}
