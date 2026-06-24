import type { ExternalConnectionConfidence } from "./types.js";

export function normalizeExternalDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

export function isPlatformReferenceExternalDomain(
  domain: string,
  confidence: ExternalConnectionConfidence = "low",
) {
  const value = normalizeExternalDomain(domain);

  return (
    value === "wordpress.org" ||
    value.endsWith(".wordpress.org") ||
    value === "w.org" ||
    value.endsWith(".w.org") ||
    value === "w3.org" ||
    value.endsWith(".w3.org") ||
    value === "schema.org" ||
    value.endsWith(".schema.org") ||
    value === "gnu.org" ||
    value.endsWith(".gnu.org") ||
    value === "fsf.org" ||
    value.endsWith(".fsf.org") ||
    value === "opensource.org" ||
    value.endsWith(".opensource.org") ||
    (value === "github.com" && confidence === "low")
  );
}
