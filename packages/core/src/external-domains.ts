import type {
  ExternalConnectionConfidence,
  ExternalDomainClassification,
} from "./types.js";

export function normalizeExternalDomain(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
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

export function externalDomainRoot(domain: string) {
  const value = normalizeExternalDomain(domain);

  if (!isPlainExternalHostname(value) || isPlaceholderExternalDomain(value)) {
    return value;
  }

  const labels = value.split(".");

  if (labels.length <= 2) {
    return value;
  }

  const lastTwo = labels.slice(-2).join(".");
  const lastThree = labels.slice(-3).join(".");

  if (PUBLIC_SUFFIX_HOSTS.has(lastTwo)) {
    return lastThree;
  }

  if (MULTI_PART_PUBLIC_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return lastThree;
  }

  const suffixThree = labels.slice(-3).join(".");

  if (MULTI_PART_PUBLIC_SUFFIXES.has(suffixThree) && labels.length >= 4) {
    return labels.slice(-4).join(".");
  }

  return lastTwo;
}

export function externalDomainClassification(
  domain: string,
  confidence: ExternalConnectionConfidence = "low",
): ExternalDomainClassification {
  const value = normalizeExternalDomain(domain);

  if (!isPlainExternalHostname(value)) {
    return "invalid";
  }

  if (isPlaceholderExternalDomain(value)) {
    return "placeholder";
  }

  if (isPlatformReferenceExternalDomain(value, confidence)) {
    return "platform_reference";
  }

  return "standard";
}

export function isSubdomainOfExternalRoot(domain: string) {
  const value = normalizeExternalDomain(domain);
  const rootDomain = externalDomainRoot(value);

  return Boolean(rootDomain && value !== rootDomain);
}

export function isPlainExternalHostname(domain: string) {
  const value = normalizeExternalDomain(domain);

  if (
    !value ||
    value.length > 253 ||
    !value.includes(".") ||
    value.includes("..") ||
    /[^a-z0-9.-]/.test(value)
  ) {
    return false;
  }

  const labels = value.split(".");
  const tld = labels.at(-1);

  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return false;
  }

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

function isPlaceholderExternalDomain(domain: string) {
  const value = normalizeExternalDomain(domain);

  return (
    PLACEHOLDER_DOMAINS.has(value) ||
    PLACEHOLDER_TLDS.has(value.split(".").at(-1) ?? "") ||
    value.includes("${") ||
    value.includes("}") ||
    value.includes("$")
  );
}

const PLACEHOLDER_DOMAINS = new Set([
  "domain.com",
  "example.com",
  "example.net",
  "example.org",
  "foo.com",
  "site.com",
  "test.com",
  "your-domain.com",
  "your-link.com",
  "yourdomain.com",
]);

const PLACEHOLDER_TLDS = new Set(["freemius", "invalid", "localhost", "test"]);

const PUBLIC_SUFFIX_HOSTS = new Set([
  "github.io",
  "pages.dev",
  "vercel.app",
]);

const MULTI_PART_PUBLIC_SUFFIXES = new Set([
  "ac.uk",
  "co.jp",
  "co.uk",
  "com.au",
  "com.br",
  "com.tr",
  "com.ua",
  "edu.au",
  "gov.uk",
  "net.au",
  "org.au",
  "org.uk",
]);
