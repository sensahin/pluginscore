"use client";

import type { PluginReportType } from "@pluginscore/core";
import { CheckCircle2, Loader2, MessageSquare, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

const reportTypes: Array<{ value: PluginReportType; label: string }> = [
  { value: "incorrect_metadata", label: "Incorrect plugin metadata" },
  { value: "score_looks_wrong", label: "Score looks wrong" },
  { value: "false_positive_issue", label: "False positive issue" },
  { value: "missing_issue", label: "Missing issue" },
  { value: "plugin_updated", label: "Plugin has been updated" },
  { value: "other", label: "Other" },
];

export function PluginReportCard({
  pluginSlug,
  pluginName,
  pluginVersion,
  auditRunId,
}: {
  pluginSlug: string;
  pluginName: string;
  pluginVersion: string;
  auditRunId?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<PluginReportType>("incorrect_metadata");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setSubmitted(false);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/plugins/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          pluginSlug,
          pluginVersion,
          auditRunId,
          reportType,
          message,
          contactEmail,
          website,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(reportErrorMessage(data?.error));
      }

      setSubmitted(true);
      setMessage("");
      setContactEmail("");
      setWebsite("");
      setReportType("incorrect_metadata");
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Report an issue with this profile</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Flag stale metadata, score questions, or audit result issues.
          </p>
        </div>
        <MessageSquare size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      </div>

      {submitted ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-good/20 bg-good/10 p-3 text-sm text-good">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Report submitted. Thanks for helping keep {pluginName} accurate.</span>
        </div>
      ) : null}

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
        >
          Report profile
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="text"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Issue type</span>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as PluginReportType)}
              className="h-10 w-full rounded-md border border-line bg-background px-3 text-sm outline-none transition focus:border-brand"
            >
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              rows={4}
              className="w-full resize-y rounded-md border border-line bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-muted focus:border-brand"
              placeholder="What should we review?"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email optional</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              maxLength={254}
              className="h-10 w-full rounded-md border border-line bg-background px-3 text-sm outline-none transition placeholder:text-muted focus:border-brand"
              placeholder="you@example.com"
            />
          </label>

          <p className="text-xs leading-5 text-muted">
            For sensitive vulnerability reports, contact security privately.
          </p>

          {error ? <p className="text-sm text-risk">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : null}
              Submit
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setError("");
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-muted transition hover:bg-surface-subtle hover:text-foreground"
            >
              <X size={15} aria-hidden="true" />
              Close
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}

function reportErrorMessage(code?: string) {
  if (code === "message_too_short") return "Please add a little more detail.";
  if (code === "message_too_long") return "Please keep the message under 2,000 characters.";
  if (code === "invalid_email") return "Please enter a valid email address.";
  if (code === "too_many_links") return "Please remove extra links from the message.";
  if (code === "rate_limited") return "Please wait a minute before sending another report.";
  return "Report could not be submitted. Please try again.";
}
