# Issue Editorial Catalog

PluginScore keeps public issue explanations in source control instead of storing
them as scan data.

The catalog lives in:

```text
packages/core/src/issue-catalog.ts
```

The scanner and API can discover new finding codes from Plugin Check output, but
the public explanation should be reviewed text that contributors can improve.

## Fields

Each exact catalog entry can define:

- `title`: public display title, optional
- `summary`: short explanation shown at the top of the issue page
- `whyItShowsUp`: why Plugin Check or WordPress Coding Standards reported it
- `whyItMatters`: practical impact for plugin authors and site owners
- `fixSummary`: short fix text used in tables
- `howToFix`: concrete remediation steps
- `notes`: optional caveats or false-positive context
- `references`: optional official docs links

## Adding Or Updating An Issue

Add an exact entry keyed by the finding code:

```ts
export const issueEditorialCatalog: Record<string, IssueEditorial> = {
  "Vendor.Rule.Example": {
    title: "Readable issue title",
    summary: "One plain-language sentence about what this means.",
    whyItShowsUp: "Why the scanner reports this finding.",
    whyItMatters: "Why plugin authors should care.",
    fixSummary: "Short fix summary for issue tables.",
    howToFix: [
      "First concrete step.",
      "Second concrete step.",
    ],
  },
};
```

If an exact entry is missing, `getIssueEditorial()` falls back to hand-written
family and pattern guidance for WPCS, Plugin Check, repository metadata, i18n,
performance, and supply-chain findings. Exact entries are preferred for common
or subtle issues.
