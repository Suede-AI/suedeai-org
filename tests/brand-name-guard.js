'use strict';
// The company is "Suede" (owner direction 2026-11-21). "Suede AI", "Suede Labs"
// and "Suede Labs AI" are former names. They may appear in public copy only:
//   - as a schema.org "alternateName" value (entity merging for search and AI),
//   - in one alias line per llms.txt / llms-full.txt / ai-instructions page,
//   - inside the exempt regions the hedging guard already skips (comments,
//     inline scripts, styles, cited third-party quotes, status messages),
//   - inside the verbatim strings in ALLOWED_LITERALS (press headlines, external
//     listing names that cannot be changed from this repo, quoted third-party text).
// tests/brand_name.test.js runs scanSite() under `node --test` in CI.

const fs = require('node:fs');
const path = require('node:path');
const { publicFiles, EXEMPT_REGIONS } = require('./hedging-guard');

const ROOT = path.resolve(__dirname, '..');

const OLD_NAME = /\bSuede(?:\s|&nbsp;)+(?:Labs(?:\s|&nbsp;)+AI|AI|Labs)\b/gi;

const ALLOWED_LITERALS = [
  // Press headlines, quoted verbatim.
  { text: 'Suede Labs Brings AI-Powered Creative Tools to Students', reason: 'TechBullion headline' },
  { text: 'Suede Labs Advances in the Avalanche Build Games', reason: 'TechBullion headline' },
  { text: 'Suede Labs Launches A Comprehensive On-Chain IP Authentication System', reason: 'TechBullion headline' },
  { text: 'Suede Labs AI Releases iOS Apps', reason: 'TechBullion headline' },
  { text: 'Suede Labs AI Opens IP Visibility Audit', reason: 'TechBullion headline' },
  { text: 'Best Suno Alternatives in 2026: Suede Labs and Top Competitors', reason: 'TechBullion headline' },
  { text: "Opens Suede Labs AI's Long-Awaited SEO Cohort", reason: 'Business Insider headline' },
  { text: "opens Suede Labs AI's long-awaited SEO cohort", reason: 'Business Insider headline' },
  { text: 'Suede AI vs. Profound for Trade Associations', reason: 'Gigawatt Group headline' },
  { text: 'Suede AI opens SEO cohort with optional AI integration', reason: 'MSN headline' },
  // External listing names this repository cannot change.
  { text: 'Suede AI Agents: Directory', reason: 'Google Play app name' },
  { text: 'Suede AI Generator', reason: 'App Store app name' },
  { text: 'Suede AI Visibility', reason: 'Chrome Web Store extension name' },
  { text: '<strong>Facebook</strong><p>Suede Labs AI</p>', reason: 'Facebook page name' },
  { text: 'Clutch: Suede AI SEO', reason: 'Clutch profile name' },
  { text: 'listed as Suede AI SEO', reason: 'The Manifest listing name' },
  // Quoted third-party text.
  { text: 'Suede labs ai review', reason: 'Google search query shown in a screenshot' },
  { text: 'Suede Labs AI is highly rated', reason: "Google Web Guide's words, quoted" },
  { text: 'names Suede Labs as an opt-out option', reason: 'the proposed Community Note names Suede Labs; the record states what it says' },
];

// The one alias line allowed per discovery file.
const ALIAS_FILES = /^(llms\.txt|llms-full\.txt|ai-instructions\/index\.html)$/;
const ALIAS_LINE = /\b(also known as|alternate names?|formerly)\b/i;

const blank = text => text.replace(/[^\n]/g, ' ');

function normalize(text) {
  return text
    .replace(/<[^>]*>/g, '\u2063') // a tag separates words only where the copy has a space
    .replace(/&(rsquo|lsquo|apos|#39|#x27|#8217|#8216);/gi, "'")
    .replace(/[‘’]/g, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ');
}

function scanText(text, rel = '<inline>') {
  let body = text.replace(/"alternateName"\s*:\s*(\[[^\]]*\]|"[^"]*")/g, blank);
  for (const region of EXEMPT_REGIONS) body = body.replace(region.pattern, blank);
  const allow = () => { for (const { text: literal } of ALLOWED_LITERALS) body = body.split(literal).join(blank(literal)); };
  allow();
  body = normalize(body);
  allow();
  const findings = [];
  let aliasUsed = false;
  body.split('\n').forEach((line, index) => {
    const hits = line.match(OLD_NAME);
    if (!hits) return;
    if (ALIAS_FILES.test(rel) && !aliasUsed && ALIAS_LINE.test(line)) {
      aliasUsed = true;
      return;
    }
    for (const hit of hits) findings.push({ file: rel, line: index + 1, match: hit.replace(/\s+/g, ' ') });
  });
  return findings;
}

function scanSite() {
  return publicFiles().flatMap(rel => scanText(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel));
}

const format = finding => `${finding.file}:${finding.line}: "${finding.match}" (the company is "Suede")`;

module.exports = { ALLOWED_LITERALS, scanText, scanSite, format };
