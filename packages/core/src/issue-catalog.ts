import type { IssueEditorial, IssueSummary } from "./types.js";

type IssueLike = Pick<IssueSummary, "code" | "title" | "family" | "weight">;

const references = {
  escaping: {
    label: "WordPress escaping functions",
    href: "https://developer.wordpress.org/apis/security/escaping/",
  },
  validating: {
    label: "WordPress validating, sanitizing, and escaping",
    href: "https://developer.wordpress.org/apis/security/sanitizing/",
  },
  nonces: {
    label: "WordPress nonces",
    href: "https://developer.wordpress.org/apis/security/nonces/",
  },
  database: {
    label: "WordPress database access",
    href: "https://developer.wordpress.org/apis/wpdb/",
  },
  i18n: {
    label: "WordPress internationalization",
    href: "https://developer.wordpress.org/plugins/internationalization/",
  },
  enqueues: {
    label: "Including CSS and JavaScript",
    href: "https://developer.wordpress.org/plugins/javascript/enqueuing/",
  },
  headers: {
    label: "Plugin header requirements",
    href: "https://developer.wordpress.org/plugins/plugin-basics/header-requirements/",
  },
  filesystem: {
    label: "WordPress Filesystem API",
    href: "https://developer.wordpress.org/apis/filesystem/",
  },
  codingStandards: {
    label: "WordPress Coding Standards",
    href: "https://developer.wordpress.org/coding-standards/wordpress-coding-standards/",
  },
} as const;

export const issueEditorialCatalog: Record<string, IssueEditorial> = {
  missing_direct_file_access_protection: {
    title: "Missing direct file access protection",
    summary:
      "A PHP file in the plugin can be loaded directly instead of through WordPress.",
    whyItShowsUp:
      "Plugin Check found a PHP file without an early guard such as an ABSPATH check. Without that guard, a browser or script can request the file by path.",
    whyItMatters:
      "Direct access can run code outside the normal WordPress bootstrap, expose output, or trigger assumptions about loaded functions, permissions, and request context.",
    fixSummary: "Add an ABSPATH guard near the top of executable PHP files.",
    howToFix: [
      "Add a guard near the top of PHP files that are not intended to be requested directly.",
      "Use `if ( ! defined( 'ABSPATH' ) ) { exit; }` before the file performs work or sends output.",
      "Keep template partials and bootstrap files protected too, not only the main plugin file.",
    ],
    notes: [
      "Files that are deliberately public endpoints should route through WordPress APIs or explicitly validate the request before doing work.",
    ],
    references: [references.codingStandards],
  },
  "PluginCheck.CodeAnalysis.DirectFileAccess.Missing": {
    title: "Missing direct file access guard",
    summary:
      "A PHP file can be executed directly instead of being loaded through WordPress.",
    whyItShowsUp:
      "The scan found a PHP file that does not stop execution when WordPress constants are missing.",
    whyItMatters:
      "Direct execution bypasses the plugin's normal WordPress runtime assumptions and can expose warnings, output, or side effects.",
    fixSummary: "Add an ABSPATH guard before executable code runs.",
    howToFix: [
      "Place `if ( ! defined( 'ABSPATH' ) ) { exit; }` near the top of the PHP file.",
      "Apply the guard consistently to include files, admin files, and front-end handlers.",
      "For intentional endpoints, route through WordPress and validate permissions, nonces, and inputs explicitly.",
    ],
    references: [references.codingStandards],
  },
  "WordPress.Security.EscapeOutput.OutputNotEscaped": {
    title: "Output is not escaped",
    summary:
      "Dynamic data is printed to the page without an escaping function for the output context.",
    whyItShowsUp:
      "WordPress Coding Standards detected a variable, option, request value, or function result reaching HTML output without a nearby escaping call.",
    whyItMatters:
      "Unescaped output can become cross-site scripting when attackers control any part of the value being printed.",
    fixSummary: "Escape output with the function that matches the HTML context.",
    howToFix: [
      "Use `esc_html()` for plain text, `esc_attr()` for attributes, and `esc_url()` for URLs.",
      "Use `wp_kses()` or `wp_kses_post()` when limited HTML is intentionally allowed.",
      "Escape as late as possible, right before output, so the selected escaping function matches the final context.",
    ],
    references: [references.escaping],
  },
  "WordPress.Security.EscapeOutput.UnsafePrintingFunction": {
    title: "Unsafe printing function",
    summary:
      "A printing function is outputting dynamic content without proving that the content is escaped.",
    whyItShowsUp:
      "The scan saw output through functions such as `printf`, `print`, or similar constructs where the printed values were not escaped for their context.",
    whyItMatters:
      "Formatted output is still browser output. If any argument contains attacker-controlled content, the page can become vulnerable to cross-site scripting.",
    fixSummary: "Escape each printed value before passing it to the printing function.",
    howToFix: [
      "Escape every dynamic argument with `esc_html()`, `esc_attr()`, `esc_url()`, or `wp_kses()` as appropriate.",
      "Keep translation wrappers and escaping wrappers in the correct order, such as `esc_html__( 'Text', 'text-domain' )` for translated text.",
      "Avoid marking values as safe unless they are hard-coded or already strictly constrained.",
    ],
    references: [references.escaping],
  },
  "WordPress.Security.EscapeOutput.ExceptionNotEscaped": {
    title: "Exception output is not escaped",
    summary:
      "An exception message or related exception value is printed without escaping.",
    whyItShowsUp:
      "The scan found exception data being displayed directly in HTML output.",
    whyItMatters:
      "Exception messages can include file paths, request values, remote API responses, or database details. Printing them raw can expose information or create XSS risk.",
    fixSummary: "Escape exception output and avoid showing raw exception messages to visitors.",
    howToFix: [
      "Use `esc_html()` or another context-appropriate escaping function before displaying exception text.",
      "Show a generic user-facing message and log the detailed exception for administrators or developers.",
      "Do not print stack traces, paths, or raw remote responses on public pages.",
    ],
    references: [references.escaping],
  },
  "WordPress.Security.ValidatedSanitizedInput.MissingUnslash": {
    title: "Request data is not unslashed",
    summary:
      "Input from a WordPress request superglobal is used before removing WordPress-added slashes.",
    whyItShowsUp:
      "WordPress adds slashes to request data for historical compatibility. The scan found `$_GET`, `$_POST`, `$_REQUEST`, or similar input used without `wp_unslash()`.",
    whyItMatters:
      "Sanitizing slashed data can produce incorrect values, failed comparisons, broken validation, or stored data that does not match what the user submitted.",
    fixSummary: "Call `wp_unslash()` before sanitizing request input.",
    howToFix: [
      "Read the specific request key, then call `wp_unslash()` on it.",
      "Sanitize the unslashed value with a function that matches the expected data type.",
      "Validate the sanitized value before using it in permissions, queries, redirects, or stored settings.",
    ],
    references: [references.validating],
  },
  "WordPress.Security.ValidatedSanitizedInput.InputNotSanitized": {
    title: "Input is not sanitized",
    summary:
      "Request data is used without being cleaned for the expected type or format.",
    whyItShowsUp:
      "The scan found superglobal input flowing into code without a sanitizer such as `sanitize_text_field()`, `absint()`, `sanitize_key()`, `esc_url_raw()`, or a custom allowlist.",
    whyItMatters:
      "Unsanitized input can pollute stored settings, alter logic, break queries, or become part of a later security issue.",
    fixSummary: "Sanitize request data before using or storing it.",
    howToFix: [
      "Unslash request data with `wp_unslash()` first.",
      "Choose the sanitizer for the expected value, such as `absint()` for IDs or `sanitize_key()` for keys.",
      "Use allowlists for actions, sort fields, file names, option names, and other constrained values.",
    ],
    references: [references.validating],
  },
  "WordPress.Security.ValidatedSanitizedInput.InputNotValidated": {
    title: "Input is not validated",
    summary:
      "Request data is used without checking that it is allowed for the operation.",
    whyItShowsUp:
      "The scan found input from a request superglobal being used without validation such as capability checks, allowlists, type checks, or range checks.",
    whyItMatters:
      "Sanitization cleans a value, but validation proves the value is acceptable. Missing validation can allow unexpected actions, invalid states, or unsafe query choices.",
    fixSummary: "Validate sanitized input against the values the code actually supports.",
    howToFix: [
      "Check that IDs are positive integers, enum-like values are in an allowlist, and URLs or file paths are constrained.",
      "Pair state-changing requests with nonce and capability checks.",
      "Reject or safely default values that do not pass validation.",
    ],
    references: [references.validating, references.nonces],
  },
  "WordPress.Security.ValidatedSanitizedInput.InputNotValidatedNotSanitized": {
    title: "Input is not validated or sanitized",
    summary:
      "Request data is used without both cleanup and an allowability check.",
    whyItShowsUp:
      "The scan found a request value moving into code without sanitization and without validation.",
    whyItMatters:
      "This combines two common input-handling failures: the value may contain unsafe content, and the code has not proven that the value is acceptable for the operation.",
    fixSummary: "Unslash, sanitize, then validate the input before use.",
    howToFix: [
      "Call `wp_unslash()` on request input first.",
      "Sanitize for the expected type or format.",
      "Validate against allowed values, ranges, capabilities, and nonces before using the value.",
    ],
    references: [references.validating, references.nonces],
  },
  "WordPress.Security.NonceVerification.Missing": {
    title: "Missing nonce verification",
    summary:
      "A request handler uses request data without verifying that the request was intentionally created by WordPress.",
    whyItShowsUp:
      "The scan found `$_GET`, `$_POST`, or similar request data in a context where a nonce check is expected but missing.",
    whyItMatters:
      "Without nonce verification, an attacker may be able to trick a logged-in user into submitting an unwanted state-changing request.",
    fixSummary: "Verify a nonce before processing state-changing requests.",
    howToFix: [
      "Add a nonce to the form, link, AJAX request, or REST request.",
      "Verify it with `check_admin_referer()`, `check_ajax_referer()`, or `wp_verify_nonce()` before changing state.",
      "Keep capability checks separate; nonces prove intent, not permission.",
    ],
    references: [references.nonces],
  },
  "WordPress.Security.NonceVerification.Recommended": {
    title: "Nonce verification recommended",
    summary:
      "The code reads request data in a place where Plugin Check recommends a nonce check.",
    whyItShowsUp:
      "The scan saw request handling that may not always mutate state, but still looks like a user-triggered action that should usually be protected by a nonce.",
    whyItMatters:
      "Adding a nonce reduces accidental or forged requests and documents that the action is expected to originate from the plugin UI.",
    fixSummary: "Add nonce verification unless the request is intentionally public and read-only.",
    howToFix: [
      "For admin forms and action links, add and verify a nonce.",
      "For AJAX handlers, use `check_ajax_referer()`.",
      "For public read-only endpoints, document why a nonce is not required and keep input validation strict.",
    ],
    references: [references.nonces],
  },
  "WordPress.DB.PreparedSQL.NotPrepared": {
    title: "SQL query is not prepared",
    summary:
      "A database query includes dynamic data without using `$wpdb->prepare()` or an equivalent safe pattern.",
    whyItShowsUp:
      "The scan found a SQL string passed to `$wpdb` where variables appear to be interpolated or concatenated directly.",
    whyItMatters:
      "Unprepared SQL can allow SQL injection when user-controlled values reach the query.",
    fixSummary: "Use `$wpdb->prepare()` for dynamic SQL values.",
    howToFix: [
      "Move dynamic values into placeholders such as `%s`, `%d`, `%f`, or `%i` where supported.",
      "Pass the values as separate arguments to `$wpdb->prepare()`.",
      "For table names, column names, and sort directions, use strict allowlists instead of raw user input.",
    ],
    references: [references.database],
  },
  "WordPress.DB.PreparedSQL.InterpolatedNotPrepared": {
    title: "Interpolated SQL is not prepared",
    summary:
      "Variables are interpolated into a SQL string before the query is prepared.",
    whyItShowsUp:
      "The scan found dynamic values placed directly inside SQL, often through string interpolation, before `$wpdb->prepare()` can safely bind them.",
    whyItMatters:
      "Preparing a query after unsafe interpolation does not reliably protect the dynamic value.",
    fixSummary: "Put placeholders in the SQL string and pass dynamic values separately.",
    howToFix: [
      "Replace interpolated variables with placeholders.",
      "Pass each dynamic value as a separate `$wpdb->prepare()` argument.",
      "Use allowlists for SQL identifiers and directions that cannot be represented as normal values.",
    ],
    references: [references.database],
  },
  "PluginCheck.Security.DirectDB.UnescapedDBParameter": {
    title: "Database parameter is not escaped",
    summary:
      "A value is passed into database-related code without escaping, preparation, or strict allowlisting.",
    whyItShowsUp:
      "Plugin Check found a database parameter that appears to come from dynamic input without the usual `$wpdb->prepare()` protection.",
    whyItMatters:
      "Database parameters often influence queries directly. Unsafe values can corrupt data access or create SQL injection risk.",
    fixSummary: "Prepare SQL values and allowlist SQL identifiers.",
    howToFix: [
      "Use `$wpdb->prepare()` for values.",
      "Use explicit allowlists for table names, column names, order fields, and directions.",
      "Sanitize and validate request data before it reaches query construction.",
    ],
    references: [references.database, references.validating],
  },
  "PluginCheck.CodeAnalysis.SettingSanitization.register_settingMissing": {
    title: "Setting is missing a sanitization callback",
    summary:
      "A registered setting does not define a sanitization callback.",
    whyItShowsUp:
      "Plugin Check found `register_setting()` without a `sanitize_callback` or equivalent validation strategy.",
    whyItMatters:
      "Settings can be saved by administrators and then displayed or used later. Without sanitization, invalid or unsafe values can persist.",
    fixSummary: "Add a `sanitize_callback` when registering the setting.",
    howToFix: [
      "Pass a `sanitize_callback` in the `register_setting()` arguments.",
      "Use built-in sanitizers for simple values and custom callbacks for structured settings.",
      "Validate allowed values and return a safe default when input is invalid.",
    ],
    references: [references.validating],
  },
  hidden_files: {
    title: "Hidden files included",
    summary:
      "The plugin package contains hidden files or directories that usually should not ship in a WordPress.org release.",
    whyItShowsUp:
      "Plugin Check found dotfiles, hidden folders, or operating-system metadata in the plugin ZIP.",
    whyItMatters:
      "Hidden files can leak development metadata, repository configuration, local tooling state, or unexpected content.",
    fixSummary: "Remove hidden development files from the release package.",
    howToFix: [
      "Exclude dotfiles and local metadata from the release build.",
      "Build release ZIPs from a clean export or packaging script.",
      "Keep only files required for the plugin to run, document itself, or provide distributed assets.",
    ],
  },
  compressed_files: {
    title: "Compressed files included",
    summary:
      "The plugin package contains nested archives or compressed files.",
    whyItShowsUp:
      "Plugin Check found ZIP, TAR, GZ, or similar compressed files inside the plugin package.",
    whyItMatters:
      "Nested archives hide code from normal review and can increase supply-chain risk or bloat the release.",
    fixSummary: "Remove nested archives from the distributed plugin package.",
    howToFix: [
      "Do not ship backup archives, vendor source archives, or release ZIPs inside the plugin.",
      "Extract required assets into normal files or fetch optional data through documented runtime flows.",
      "Review packaging scripts so archives are not copied into the release by accident.",
    ],
  },
  obfuscated_code_detected: {
    title: "Obfuscated code detected",
    summary:
      "The plugin contains code that appears intentionally hard to read or review.",
    whyItShowsUp:
      "Plugin Check detected patterns commonly associated with obfuscation, such as encoded code, dynamic evaluation, or unreadable transformations.",
    whyItMatters:
      "Obfuscation makes security review difficult and can hide unwanted behavior from site owners and reviewers.",
    fixSummary: "Ship readable source code and remove obfuscation.",
    howToFix: [
      "Replace obfuscated PHP or JavaScript with readable source.",
      "Avoid runtime decoding and dynamic execution for normal plugin logic.",
      "If minified assets are needed, include readable source or a clear build process.",
    ],
  },
};

export function getIssueEditorial(issue: IssueLike): IssueEditorial {
  return issueEditorialCatalog[issue.code] ?? inferIssueEditorial(issue);
}

export function enrichIssueSummary(issue: IssueSummary): IssueSummary {
  const editorial = getIssueEditorial(issue);

  return {
    ...issue,
    title: editorial.title ?? issue.title,
    explanation: editorial.summary,
    fix: editorial.fixSummary,
    summary: editorial.summary,
    whyItShowsUp: editorial.whyItShowsUp,
    whyItMatters: editorial.whyItMatters,
    howToFix: editorial.howToFix,
    notes: editorial.notes,
    references: editorial.references,
  };
}

function inferIssueEditorial(issue: IssueLike): IssueEditorial {
  const code = issue.code;
  const lowerCode = code.toLowerCase();
  const family = issue.family.toLowerCase();
  const displayTitle = cleanTitle(issue);

  if (code.includes("PrefixAllGlobals")) {
    return prefixGlobalsEditorial(issue);
  }

  if (code.includes("ValidatedSanitizedInput.MissingUnslash")) {
    return issueEditorialCatalog["WordPress.Security.ValidatedSanitizedInput.MissingUnslash"];
  }

  if (code.includes("ValidatedSanitizedInput.InputNotValidatedNotSanitized")) {
    return issueEditorialCatalog["WordPress.Security.ValidatedSanitizedInput.InputNotValidatedNotSanitized"];
  }

  if (code.includes("ValidatedSanitizedInput.InputNotSanitized")) {
    return issueEditorialCatalog["WordPress.Security.ValidatedSanitizedInput.InputNotSanitized"];
  }

  if (code.includes("ValidatedSanitizedInput.InputNotValidated")) {
    return issueEditorialCatalog["WordPress.Security.ValidatedSanitizedInput.InputNotValidated"];
  }

  if (code.includes("EscapeOutput")) {
    return escapeOutputEditorial(issue, displayTitle);
  }

  if (code.includes("NonceVerification")) {
    return nonceEditorial(issue, displayTitle);
  }

  if (code.includes("PreparedSQL") || code.includes("PreparedSQLPlaceholders")) {
    return preparedSqlEditorial(issue, displayTitle);
  }

  if (code.includes("DirectDatabaseQuery")) {
    return directDatabaseEditorial(issue, displayTitle);
  }

  if (code.includes("SlowDBQuery")) {
    return slowDatabaseEditorial(issue, displayTitle);
  }

  if (code.includes("RestrictedFunctions.mysql") || code.includes("RestrictedClasses.mysql")) {
    return restrictedMysqlEditorial(issue, displayTitle);
  }

  if (
    code.includes("WP.I18n") ||
    code.includes("TextDomain") ||
    lowerCode.includes("textdomain") ||
    lowerCode.includes("load_plugin_textdomain")
  ) {
    return i18nEditorial(issue, displayTitle);
  }

  if (code.includes("EnqueuedResource") || code.includes("EnqueuedResources")) {
    return enqueueEditorial(issue, displayTitle);
  }

  if (code.includes("AlternativeFunctions.file_system_operations")) {
    return filesystemEditorial(issue, displayTitle);
  }

  if (code.includes("AlternativeFunctions.curl")) {
    return curlEditorial(issue, displayTitle);
  }

  if (code.includes("AlternativeFunctions.rand")) {
    return randomEditorial(issue, displayTitle);
  }

  if (code.includes("AlternativeFunctions.strip_tags")) {
    return stripTagsEditorial(issue, displayTitle);
  }

  if (code.includes("AlternativeFunctions.parse_url")) {
    return parseUrlEditorial(issue, displayTitle);
  }

  if (code.includes("DevelopmentFunctions") || code.includes("prevent_path_disclosure")) {
    return developmentFunctionEditorial(issue, displayTitle);
  }

  if (
    code.includes("DeprecatedFunctions") ||
    code.includes("DeprecatedParameters") ||
    code.includes("DeprecatedClasses") ||
    code.includes("DeprecatedParameterValues")
  ) {
    return deprecatedEditorial(issue, displayTitle);
  }

  if (code.includes("WPQueryParams") || family === "performance") {
    return performanceEditorial(issue, displayTitle);
  }

  if (code.includes("WriteFile")) {
    return writeFileEditorial(issue, displayTitle);
  }

  if (code.includes("DirectFileAccess") || lowerCode.includes("direct_file_access")) {
    return issueEditorialCatalog.missing_direct_file_access_protection;
  }

  if (lowerCode.includes("license")) {
    return licenseEditorial(issue, displayTitle);
  }

  if (lowerCode.includes("readme")) {
    return readmeEditorial(issue, displayTitle);
  }

  if (lowerCode.includes("plugin_header")) {
    return pluginHeaderEditorial(issue, displayTitle);
  }

  if (lowerCode.includes("stable_tag") || lowerCode.includes("tested_upto")) {
    return repositoryMetadataEditorial(issue, displayTitle);
  }

  if (
    lowerCode.includes("hidden_files") ||
    lowerCode.includes("compressed_files") ||
    lowerCode.includes("obfuscated") ||
    family === "supply_chain"
  ) {
    return supplyChainEditorial(issue, displayTitle);
  }

  if (lowerCode.includes("updater") || lowerCode.includes("update_modification")) {
    return updateMechanismEditorial(issue, displayTitle);
  }

  if (lowerCode.includes("trademark") || lowerCode.includes("five_star_reviews")) {
    return directoryPolicyEditorial(issue, displayTitle);
  }

  if (
    code.includes("ForbiddenFunctions") ||
    code.includes("DiscouragedFunctions") ||
    code.includes("Discouraged") ||
    code.includes("BacktickOperator") ||
    code.includes("DiscourageGoto")
  ) {
    return discouragedCodeEditorial(issue, displayTitle);
  }

  if (
    code.includes("DisallowShortOpenTag") ||
    code.includes("DisallowAlternativePHPTags") ||
    code.includes("ByteOrderMark") ||
    code.includes("LineEndings")
  ) {
    return phpCompatibilityEditorial(issue, displayTitle);
  }

  if (lowerCode.includes("localhost") || lowerCode.includes("shorturl")) {
    return externalDependencyEditorial(issue, displayTitle);
  }

  if (lowerCode.includes("no_code_found") || code.includes("Internal.")) {
    return internalScanEditorial(issue, displayTitle);
  }

  if (family === "security") {
    return genericSecurityEditorial(issue, displayTitle);
  }

  if (family === "repo_compliance") {
    return repositoryMetadataEditorial(issue, displayTitle);
  }

  if (family === "i18n") {
    return i18nEditorial(issue, displayTitle);
  }

  return genericMaintainabilityEditorial(issue, displayTitle);
}

function prefixGlobalsEditorial(issue: IssueLike): IssueEditorial {
  const kind = inferGlobalKind(issue.code);

  return {
    title: `Non-prefixed ${kind}`,
    summary: `The plugin defines a ${kind} without a plugin-specific prefix.`,
    whyItShowsUp:
      "WordPress loads many plugins in the same PHP runtime. Plugin Check found a global symbol or hook name that is not clearly namespaced to this plugin.",
    whyItMatters:
      "Unprefixed globals can collide with WordPress core, themes, or other plugins, causing fatal errors, overwritten values, or handlers running in the wrong context.",
    fixSummary: `Prefix the ${kind} with a unique plugin namespace.`,
    howToFix: [
      "Choose a short, unique prefix or namespace based on the plugin slug or vendor name.",
      `Rename the ${kind} so it cannot collide with code from another plugin.`,
      "For public hooks, document the final hook name and keep it stable after release.",
    ],
    references: [references.codingStandards],
  };
}

function escapeOutputEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "A value reaches browser output without clear escaping for the final HTML context.",
    whyItShowsUp:
      "The scan found output where WordPress Coding Standards could not see `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses()`, or another context-appropriate escaping function.",
    whyItMatters:
      "When dynamic data is printed raw, any user-controlled part of that data can become cross-site scripting.",
    fixSummary: "Escape dynamic output at the point where it is printed.",
    howToFix: [
      "Use `esc_html()` for text nodes, `esc_attr()` for attributes, and `esc_url()` for URLs.",
      "Use `wp_kses()` when limited HTML is allowed.",
      "Escape late, right before output, so the escaping function matches the final context.",
    ],
    references: [references.escaping],
  };
}

function nonceEditorial(issue: IssueLike, title: string): IssueEditorial {
  const required = issue.code.endsWith(".Missing");

  return {
    title: required ? "Missing nonce verification" : title,
    summary: required
      ? "A request handler uses request data without verifying a WordPress nonce."
      : "A request handler reads request data in a place where nonce verification is recommended.",
    whyItShowsUp:
      "The scan found request input in action-handling code and did not find a matching nonce verification call.",
    whyItMatters:
      "Nonces help prove that a logged-in user intentionally started the request from the plugin or WordPress UI.",
    fixSummary: required
      ? "Verify a nonce before processing the request."
      : "Add nonce verification unless the request is intentionally public and read-only.",
    howToFix: [
      "Add a nonce field or nonce URL to the form, link, AJAX call, or REST request.",
      "Verify it with `check_admin_referer()`, `check_ajax_referer()`, or `wp_verify_nonce()`.",
      "Pair nonce checks with capability checks for privileged actions.",
    ],
    references: [references.nonces],
  };
}

function preparedSqlEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "A SQL query is built in a way that Plugin Check cannot verify as safely prepared.",
    whyItShowsUp:
      "The scan found missing, incorrect, quoted, unsupported, or mismatched SQL placeholders around `$wpdb->prepare()` usage.",
    whyItMatters:
      "Broken preparation can leave dynamic SQL values unsafe or make queries behave differently than intended.",
    fixSummary: "Use valid `$wpdb->prepare()` placeholders and pass replacements separately.",
    howToFix: [
      "Keep placeholders in the SQL string and pass dynamic values as separate arguments.",
      "Use the placeholder that matches the value type.",
      "Do not quote placeholders manually, and use allowlists for identifiers or SQL fragments.",
    ],
    references: [references.database],
  };
}

function directDatabaseEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin runs a direct database query instead of using a higher-level WordPress API or cache-aware pattern.",
    whyItShowsUp:
      "Plugin Check found `$wpdb` access that queries the database directly, changes schema, or bypasses normal caching expectations.",
    whyItMatters:
      "Direct queries can be correct, but they are easier to make unsafe, slower at scale, and harder for WordPress to cache or filter.",
    fixSummary: "Prefer WordPress APIs, and prepare and cache direct queries when they are necessary.",
    howToFix: [
      "Use WordPress APIs such as post, term, metadata, option, or user functions when they fit the task.",
      "If direct SQL is necessary, prepare dynamic values and add a clear caching strategy for repeated reads.",
      "Keep schema changes in activation or upgrade routines and make them idempotent.",
    ],
    references: [references.database],
  };
}

function slowDatabaseEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "A query pattern is likely to be slow on larger WordPress sites.",
    whyItShowsUp:
      "The scan found query arguments such as broad meta queries, tax queries, or unindexed lookups that commonly become expensive as content grows.",
    whyItMatters:
      "A query that feels fine on a small test site can become a production bottleneck on large stores, membership sites, or publishers.",
    fixSummary: "Reduce expensive query arguments and add caching where the result is reused.",
    howToFix: [
      "Avoid broad `meta_query`, `tax_query`, and unindexed searches on front-end requests when possible.",
      "Cache expensive results with transients, object cache, or precomputed data.",
      "Add narrower constraints, pagination, and indexes when custom tables are appropriate.",
    ],
    references: [references.database],
  };
}

function restrictedMysqlEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses a raw MySQL extension or class instead of WordPress database APIs.",
    whyItShowsUp:
      "The scan found `mysql_*`, `mysqli_*`, PDO MySQL, or related database functions in plugin code.",
    whyItMatters:
      "Bypassing `$wpdb` can ignore WordPress database configuration, escaping conventions, character sets, and compatibility layers.",
    fixSummary: "Use `$wpdb` or a WordPress API instead of direct MySQL calls.",
    howToFix: [
      "Replace raw MySQL calls with `$wpdb` methods or higher-level WordPress APIs.",
      "Use `$wpdb->prepare()` for dynamic values.",
      "If a third-party library requires a database connection, isolate it and document why WordPress APIs cannot be used.",
    ],
    references: [references.database],
  };
}

function i18nEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "A translation or text-domain pattern does not match WordPress internationalization expectations.",
    whyItShowsUp:
      "Plugin Check found missing text domains, mismatched domains, missing translator comments, variable-only strings, placeholder issues, or deprecated translation loading patterns.",
    whyItMatters:
      "Translation issues make the plugin harder to localize and can break strings for non-English WordPress users.",
    fixSummary: "Use stable, literal translation strings and the plugin's correct text domain.",
    howToFix: [
      "Use the plugin slug as the text domain unless the plugin intentionally declares a different one.",
      "Keep translatable strings literal and move variables into placeholders.",
      "Add translator comments before strings with placeholders or ambiguous context.",
    ],
    references: [references.i18n],
  };
}

function enqueueEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "A script or stylesheet is loaded without the expected WordPress enqueue metadata.",
    whyItShowsUp:
      "The scan found missing versions, missing footer placement, or scripts/styles printed directly instead of being enqueued.",
    whyItMatters:
      "Proper enqueueing lets WordPress manage dependencies, versions, placement, caching, and compatibility with other plugins.",
    fixSummary: "Load assets through `wp_enqueue_script()` or `wp_enqueue_style()` with complete metadata.",
    howToFix: [
      "Register or enqueue assets with handles, dependencies, versions, and placement arguments.",
      "Use a file modification time or plugin version for local asset versions when appropriate.",
      "Avoid printing script or stylesheet tags directly in templates.",
    ],
    references: [references.enqueues],
  };
}

function filesystemEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin performs filesystem work with raw PHP functions where WordPress expects safer filesystem handling.",
    whyItShowsUp:
      "Plugin Check found functions such as `fopen`, `fwrite`, `chmod`, `mkdir`, `readfile`, or related operations.",
    whyItMatters:
      "WordPress sites can use different filesystem permissions and transports. Raw filesystem calls can fail on common hosts or write to unsafe locations.",
    fixSummary: "Use the WordPress Filesystem API or tightly constrain file operations.",
    howToFix: [
      "Use WordPress filesystem helpers when writing, reading, or changing files in plugin-managed paths.",
      "Validate paths and keep writes inside directories owned by the plugin or WordPress uploads.",
      "Never write PHP code from user input or remote responses.",
    ],
    references: [references.filesystem],
  };
}

function curlEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses raw cURL functions instead of the WordPress HTTP API.",
    whyItShowsUp:
      "Plugin Check found `curl_*` calls in plugin code.",
    whyItMatters:
      "The WordPress HTTP API handles transports, proxies, SSL behavior, filters, and host compatibility more consistently than raw cURL.",
    fixSummary: "Use `wp_remote_get()`, `wp_remote_post()`, or related WordPress HTTP helpers.",
    howToFix: [
      "Replace simple cURL requests with `wp_remote_get()` or `wp_remote_post()`.",
      "Handle `WP_Error`, status codes, timeouts, and response body parsing explicitly.",
      "If a bundled library uses cURL internally, keep it isolated and avoid passing unchecked user input into requests.",
    ],
  };
}

function randomEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses a random function that may not be appropriate for the task.",
    whyItShowsUp:
      "The scan found functions such as `rand()`, `mt_rand()`, `srand()`, or `mt_srand()`.",
    whyItMatters:
      "General random functions are not suitable for security-sensitive tokens and manual seeding can reduce randomness.",
    fixSummary: "Use a purpose-appropriate random API.",
    howToFix: [
      "Use `wp_rand()` for ordinary WordPress randomness.",
      "Use PHP cryptographic randomness for security-sensitive tokens.",
      "Avoid manual random seeding unless there is a narrow, documented reason.",
    ],
  };
}

function stripTagsEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses `strip_tags()` where WordPress-specific sanitization is usually clearer.",
    whyItShowsUp:
      "Plugin Check found `strip_tags()` in plugin code.",
    whyItMatters:
      "`strip_tags()` is blunt and can leave unsafe attribute content or remove markup in ways that do not match WordPress expectations.",
    fixSummary: "Use a WordPress sanitizer or escaping function that matches the expected value.",
    howToFix: [
      "Use `sanitize_text_field()` for plain text input.",
      "Use `wp_kses()` when limited HTML should be allowed.",
      "Use context-specific escaping at output time.",
    ],
    references: [references.validating, references.escaping],
  };
}

function parseUrlEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses raw URL parsing where WordPress URL helpers may be safer or more compatible.",
    whyItShowsUp:
      "Plugin Check found `parse_url()` in plugin code.",
    whyItMatters:
      "URL parsing is easy to get subtly wrong, especially with relative URLs, encoded values, and malformed input.",
    fixSummary: "Prefer WordPress URL helpers and validate parsed URL parts.",
    howToFix: [
      "Use WordPress helpers such as `wp_parse_url()`, `esc_url_raw()`, `esc_url()`, and `wp_http_validate_url()` where they fit.",
      "Validate schemes and hosts before using parsed URL parts.",
      "Do not use parsed URLs to build redirects or requests without allowlisting.",
    ],
  };
}

function developmentFunctionEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "Development or debugging behavior appears in code that may run in production.",
    whyItShowsUp:
      "The scan found logging, debugging, path disclosure, `phpinfo()`, error-reporting changes, or similar development-oriented functions.",
    whyItMatters:
      "Debug output can leak paths, configuration, request data, stack details, or sensitive runtime information.",
    fixSummary: "Remove production debug output or guard it behind safe debug-only conditions.",
    howToFix: [
      "Remove temporary debugging calls before release.",
      "If logging is required, guard it with `WP_DEBUG` or a plugin setting intended for administrators.",
      "Never show debug details to unauthenticated visitors or normal front-end users.",
    ],
  };
}

function deprecatedEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses a WordPress API, parameter, class, or value that has been deprecated.",
    whyItShowsUp:
      "Plugin Check found a deprecated WordPress function, parameter position, class, or parameter value.",
    whyItMatters:
      "Deprecated APIs may keep working for now, but they can behave differently across WordPress versions and make maintenance harder.",
    fixSummary: "Replace the deprecated usage with the current WordPress API.",
    howToFix: [
      "Look up the replacement API in the WordPress developer reference.",
      "Update the call signature and test on the plugin's supported WordPress versions.",
      "Keep compatibility wrappers only when the plugin intentionally supports older WordPress versions.",
    ],
    references: [references.codingStandards],
  };
}

function performanceEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses a query or runtime pattern that can become expensive on larger sites.",
    whyItShowsUp:
      "Plugin Check found arguments or code paths associated with slow queries, broad exclusions, suppressed filters, or uncached work.",
    whyItMatters:
      "Performance issues often appear only after a site has enough content, orders, users, or traffic.",
    fixSummary: "Use narrower queries, pagination, and caching for repeated expensive work.",
    howToFix: [
      "Avoid broad exclusion lists and unbounded queries on front-end requests.",
      "Cache repeated expensive results.",
      "Measure the query plan or runtime on a realistically sized dataset before deciding the warning is harmless.",
    ],
  };
}

function writeFileEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin writes files in or near plugin-controlled directories.",
    whyItShowsUp:
      "Plugin Check found file creation or modification behavior that may affect the plugin directory or executable files.",
    whyItMatters:
      "Runtime writes to plugin code directories can break updates, create permission issues, or introduce supply-chain risk.",
    fixSummary: "Write only to appropriate data locations and never write executable code from untrusted input.",
    howToFix: [
      "Store generated data in uploads, cache, or another WordPress-approved writable location.",
      "Validate paths and file names against strict allowlists.",
      "Avoid modifying plugin source files at runtime.",
    ],
    references: [references.filesystem],
  };
}

function licenseEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin's license metadata is missing, invalid, or inconsistent.",
    whyItShowsUp:
      "Plugin Check found license information that does not match WordPress.org expectations across the plugin header, readme, or bundled files.",
    whyItMatters:
      "Clear license metadata helps users and repository reviewers understand whether the plugin can be distributed and modified.",
    fixSummary: "Use clear, consistent GPL-compatible license metadata.",
    howToFix: [
      "Declare the license in the plugin header and readme.",
      "Use a valid SPDX-style license name or a WordPress.org-accepted GPL-compatible license.",
      "Keep bundled third-party library licenses intact and compatible.",
    ],
    references: [references.headers],
  };
}

function readmeEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin readme contains metadata or formatting that WordPress.org may not parse as intended.",
    whyItShowsUp:
      "Plugin Check found readme headers, sections, tags, contributors, language, or formatting that do not match repository expectations.",
    whyItMatters:
      "The readme powers the WordPress.org plugin page. Parser issues can hide important metadata, show stale compatibility, or reduce discoverability.",
    fixSummary: "Update the readme to match WordPress.org parser expectations.",
    howToFix: [
      "Use standard readme headers and section names.",
      "Keep short descriptions, tags, contributors, Requires at least, Requires PHP, Tested up to, and Stable tag valid and current.",
      "Run the readme through Plugin Check again after editing.",
    ],
    references: [references.headers],
  };
}

function pluginHeaderEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin file header contains missing, invalid, or inconsistent metadata.",
    whyItShowsUp:
      "Plugin Check found a header value such as plugin name, license, domain path, network, Requires PHP, or Requires at least that does not match expected format.",
    whyItMatters:
      "Header metadata tells WordPress and WordPress.org how to identify, load, translate, and present the plugin.",
    fixSummary: "Correct the plugin header metadata in the main plugin file.",
    howToFix: [
      "Use standard WordPress plugin header fields and valid values.",
      "Keep header values consistent with the readme and actual plugin support policy.",
      "Remove unsupported or stale metadata before release.",
    ],
    references: [references.headers],
  };
}

function repositoryMetadataEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "Repository metadata is missing, stale, or inconsistent with WordPress.org expectations.",
    whyItShowsUp:
      "Plugin Check found metadata such as Stable tag, Tested up to, Requires at least, Requires PHP, tags, or directory names that need attention.",
    whyItMatters:
      "Repository metadata affects compatibility signals, update expectations, search presentation, and reviewer confidence.",
    fixSummary: "Align the plugin header, readme, and release package metadata.",
    howToFix: [
      "Update stale compatibility values before release.",
      "Keep readme and plugin header values consistent.",
      "Remove unsupported files or names from the release package.",
    ],
    references: [references.headers],
  };
}

function supplyChainEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The release package contains content that increases review or supply-chain risk.",
    whyItShowsUp:
      "Plugin Check found hidden files, compressed archives, obfuscated code, or other content that is difficult to review.",
    whyItMatters:
      "Users and reviewers need to understand what code is shipped. Hidden or opaque content can conceal behavior or leak development artifacts.",
    fixSummary: "Remove opaque or unnecessary files from the release package.",
    howToFix: [
      "Build the release from a clean packaging process.",
      "Exclude local metadata, backups, archives, generated caches, and unrelated development files.",
      "Ship readable source for code that runs in WordPress.",
    ],
  };
}

function updateMechanismEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin appears to include its own update or modification mechanism.",
    whyItShowsUp:
      "Plugin Check found updater code or code that modifies plugin files outside the normal WordPress.org update flow.",
    whyItMatters:
      "Custom update mechanisms can bypass repository review, surprise site owners, or change executable code after installation.",
    fixSummary: "Use the normal WordPress.org update flow unless there is a clearly documented reason.",
    howToFix: [
      "Remove custom updater code from WordPress.org releases when it is not needed.",
      "Do not rewrite plugin source files at runtime.",
      "If remote updates are intentional outside WordPress.org, document the trust model and protect it with strong validation.",
    ],
  };
}

function directoryPolicyEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin metadata or copy appears to conflict with WordPress.org directory policy expectations.",
    whyItShowsUp:
      "Plugin Check detected wording, naming, review prompts, trademarks, or promotional patterns that repository reviewers commonly inspect.",
    whyItMatters:
      "Directory policy issues can delay review and can mislead users about affiliation, endorsement, or review behavior.",
    fixSummary: "Adjust naming and promotional copy to be clear, accurate, and policy-safe.",
    howToFix: [
      "Avoid unsupported trademark use or wording that implies official affiliation.",
      "Do not pressure users into five-star reviews.",
      "Keep marketing copy accurate and focused on the plugin's own functionality.",
    ],
  };
}

function discouragedCodeEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin uses a PHP or WordPress pattern that coding standards discourage.",
    whyItShowsUp:
      "Plugin Check found a discouraged function, forbidden function, goto, backtick operator, or similar construct.",
    whyItMatters:
      "Discouraged patterns are often harder to review, less portable across hosts, or easier to misuse securely.",
    fixSummary: "Replace the discouraged construct with a WordPress-friendly alternative.",
    howToFix: [
      "Identify why the construct is used and whether WordPress provides a safer API.",
      "Replace shell execution, dynamic execution, or broad forbidden functions with constrained WordPress APIs.",
      "If a third-party library triggers the warning, isolate and document it.",
    ],
    references: [references.codingStandards],
  };
}

function phpCompatibilityEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin contains PHP syntax or file formatting that can cause compatibility problems.",
    whyItShowsUp:
      "Plugin Check found short tags, alternative PHP tags, byte order marks, mixed line endings, or similar formatting issues.",
    whyItMatters:
      "Formatting issues can break parsing, cause unexpected output, or behave differently across PHP configurations and hosts.",
    fixSummary: "Normalize PHP files to standard tags, UTF-8 without BOM, and consistent line endings.",
    howToFix: [
      "Use full `<?php` opening tags.",
      "Save files as UTF-8 without a byte order mark.",
      "Normalize line endings and run formatting checks before release.",
    ],
  };
}

function externalDependencyEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "The plugin contains a development-only URL, short URL, or local endpoint reference.",
    whyItShowsUp:
      "Plugin Check found localhost references, short URLs, or offloaded content references that may not be appropriate in a distributed plugin.",
    whyItMatters:
      "Local or opaque URLs can break for users, hide the true destination, or make repository review harder.",
    fixSummary: "Replace development URLs with production URLs and avoid short links in distributed code.",
    howToFix: [
      "Remove localhost and private-network URLs before release.",
      "Use full, transparent URLs for external resources.",
      "Bundle required assets locally when WordPress.org expects them to ship with the plugin.",
    ],
  };
}

function internalScanEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "Plugin Check could not fully analyze part of the plugin or encountered an internal scan condition.",
    whyItShowsUp:
      "The scanner reported a no-code, exception, or internal condition while processing the package.",
    whyItMatters:
      "Incomplete analysis can hide other findings and usually means the release package or scanner input needs review.",
    fixSummary: "Review the scan output and package contents, then rerun the scan.",
    howToFix: [
      "Check whether the plugin ZIP contains the expected PHP files.",
      "Review scanner stderr or raw Plugin Check output for parse errors or exceptions.",
      "Fix package structure or syntax problems before relying on the score.",
    ],
  };
}

function genericSecurityEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "Plugin Check reported a security-sensitive coding pattern that needs review.",
    whyItShowsUp:
      "The finding came from a security-focused WordPress coding standard or Plugin Check rule.",
    whyItMatters:
      "Security findings often involve trust boundaries: request input, browser output, redirects, database access, capabilities, or filesystem behavior.",
    fixSummary: "Review the affected code path and apply the WordPress security API for that context.",
    howToFix: [
      "Identify the untrusted value or privileged action involved.",
      "Add validation, sanitization, escaping, nonce checks, capability checks, or prepared SQL as appropriate.",
      "Rerun Plugin Check after the code path is fixed.",
    ],
    references: [references.validating, references.escaping, references.nonces],
  };
}

function genericMaintainabilityEditorial(issue: IssueLike, title: string): IssueEditorial {
  return {
    title,
    summary:
      "Plugin Check reported a maintainability issue that can make the plugin harder to review, run, or update.",
    whyItShowsUp:
      "The finding matches a WordPress coding-standard or Plugin Check rule for code clarity, compatibility, packaging, or API usage.",
    whyItMatters:
      "Maintainability findings reduce confidence that the plugin will behave consistently across hosts, WordPress versions, and other plugins.",
    fixSummary: "Review the affected code and replace the pattern with the WordPress-recommended approach.",
    howToFix: [
      "Find the exact file and line in the raw scan output.",
      "Prefer WordPress APIs and standard coding patterns over custom or legacy behavior.",
      "If the warning is from bundled third-party code, document that separately and avoid modifying vendor files unless necessary.",
    ],
    references: [references.codingStandards],
  };
}

function inferGlobalKind(code: string) {
  if (code.includes("Variable")) return "global variable";
  if (code.includes("Hookname")) return "hook name";
  if (code.includes("Function")) return "function";
  if (code.includes("Constant")) return "constant";
  if (code.includes("Class")) return "class";
  if (code.includes("Interface")) return "interface";
  if (code.includes("Namespace")) return "namespace";
  if (code.includes("Trait")) return "trait";
  return "global symbol";
}

function cleanTitle(issue: IssueLike) {
  const title = issue.title.trim();

  if (
    title &&
    !["Found", "Missing", "Recommended", "Discouraged", "Mixed"].includes(title)
  ) {
    return title;
  }

  const parts = issue.code
    .split(/[._]/)
    .filter(Boolean)
    .slice(-3)
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return parts ? toTitleCase(parts) : title || issue.code;
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
