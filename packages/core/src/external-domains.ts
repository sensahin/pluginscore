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

export function isExternalDomainLikelyPublicHostname(domain: string) {
  const value = normalizeExternalDomain(domain).replace(/\.$/, "");

  if (!value || value.length > 253 || value.includes("..")) {
    return false;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value
      .split(".")
      .every((segment) => {
        const number = Number(segment);
        return Number.isInteger(number) && number >= 0 && number <= 255;
      });
  }

  if (!value.includes(".") || /[^a-z0-9.-]/.test(value)) {
    return false;
  }

  const labels = value.split(".");
  const tld = labels.at(-1);

  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return false;
  }

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}
