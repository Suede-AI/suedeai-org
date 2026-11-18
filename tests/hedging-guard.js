'use strict';
// Banned hedging phrases in public copy (owner ruling 2026-11-18).
//
// Founder-stated facts are the record (AGENTS.md). These five phrase families
// hedge, disclaim or qualify them, so they must never ship in public copy.
// tests/hedging_phrases.test.js runs scanSite() under `node --test`, which CI
// (verify-site.yml) runs on every push and pull request.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Matching is case-insensitive. Curly quotes and HTML entities are folded to a
// straight apostrophe first, and any run of whitespace or markup counts as one
// space, so "doesn&rsquo;t <em>prove</em>" is caught like "doesn't prove".
const FAMILIES = [
  {
    id: 1,
    name: 'promise disclaimers',
    phrases: ['cannot be promised', "can't promise", 'cannot promise', 'no one can guarantee', 'nobody can guarantee', 'not a guarantee', 'no guarantee'],
  },
  {
    id: 2,
    name: 'proves-nothing framing',
    phrases: ['does not prove', "doesn't prove", 'what this does not prove', 'not proof'],
  },
  {
    id: 3,
    name: 'unit disclaimers next to founder figures',
    phrases: ['events, not users', 'not active users', 'not unique products', 'not installs', 'not downloads'],
  },
  {
    id: 4,
    name: 'attribution qualifiers',
    phrases: ['as reported by', 'founder-reported', 'founder reported', 'self-reported'],
  },
  {
    id: 5,
    name: 'listing caveats',
    phrases: ['editions overlap', 'Android editions overlap iOS', 'counts describe platform listings'],
  },
];

function phraseRegex(phrase) {
  const body = phrase
    .split(/\s+/)
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-\\s]?'))
    .join('\\s+');
  // No trailing \b, so plurals ("no guarantees") are caught too.
  return new RegExp(`\\b${body}`, 'gi');
}

const MATCHERS = FAMILIES.flatMap(family => family.phrases.map(phrase => ({ family, phrase, regex: phraseRegex(phrase) })));

// Every exemption, each with its one-line reason. Paths are relative to the
// repository root with forward slashes.
const EXEMPT_PATHS = [
  { pattern: /^terms\//, reason: 'legal page: terms of service' },
  { pattern: /^privacy\//, reason: 'legal page: privacy policy' },
  { pattern: /^refund-policy\//, reason: 'legal page: refund policy' },
  { pattern: /^voice\/(terms|privacy)\//, reason: 'legal page: Suede Voice app terms and privacy policy' },
  { pattern: /(^|\/)licen[cs]es?(\/|\.|$)/i, reason: 'legal page: licenses' },
  { pattern: /^tests\//, reason: 'test fixtures and tests, never deployed (.vercelignore)' },
  { pattern: /^docs\/handoffs\//, reason: 'docs/handoffs: internal handoff notes, never deployed' },
  { pattern: /^(site\/)?book\/(chapters?|methodology)\//, reason: 'methodology chapters of the book teach readers measurement; they are not claims about Suede' },
];

// Regions inside a scanned file that are exempt. Each is blanked (newlines
// kept, so line numbers stay true) before matching.
const EXEMPT_REGIONS = [
  { pattern: /<!--[\s\S]*?-->/g, reason: 'code comment (HTML comment)' },
  { pattern: /<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, reason: 'code: inline script, including its comments and error/status strings (JSON-LD is still scanned)' },
  { pattern: /<style\b[^>]*>[\s\S]*?<\/style>/gi, reason: 'code: inline stylesheet' },
  { pattern: /<(blockquote|q)\b[^>]*\b(cite|data-third-party)\b[^>]*>[\s\S]*?<\/\1>/gi, reason: 'third-party quote, kept verbatim (a blockquote or q marked with cite or data-third-party)' },
  { pattern: /<([a-z][a-z0-9]*)\b[^>]*\brole="(alert|status)"[^>]*>[\s\S]*?<\/\1>/gi, reason: 'error or status message (role="alert" or role="status")' },
];

// Sentence-level exemptions: IP-registry legal explanations of what a record
// establishes in law. These describe the legal effect of a registry entry, not
// a Suede claim or a founder figure.
const EXEMPT_SENTENCES = [
  {
    pattern: /\b(registry|registration|record|registered|timestamp|hash|certificate|entry)\b[^.]{0,60}\b(does not|doesn't|is not|isn't|not)\s+(prove|proof)\b[^.]{0,40}\b(ownership|authorship|copyright|title)\b/gi,
    reason: 'IP-registry legal explanation (e.g. "a registry record doesn\'t prove ownership")',
  },
];

// Public files: what Vercel serves (see .vercelignore). Markdown is internal
// except docs/accomplishments.md; configuration and agent files are not copy.
const PUBLIC_EXTENSIONS = new Set(['.html', '.txt', '.json', '.webmanifest', '.xml', '.md']);
const SKIP_DIRS = new Set(['node_modules', 'tests', 'scripts', 'supabase', 'api']);
const NON_COPY_FILES = new Set(['vercel.json', 'requirements-test.txt']);

function isPublic(rel) {
  if (NON_COPY_FILES.has(rel) || /^requirements.*\.txt$/.test(rel)) return false;
  if (rel.endsWith('.md')) return rel === 'docs/accomplishments.md';
  if (rel.startsWith('docs/') && rel !== 'docs/accomplishments.md') return false;
  return PUBLIC_EXTENSIONS.has(path.extname(rel));
}

function publicFiles(dir = ROOT) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (entry.isDirectory()) return publicFiles(full);
    return isPublic(rel) ? [rel] : [];
  });
}

function exemptPath(rel) {
  return EXEMPT_PATHS.find(entry => entry.pattern.test(rel)) || null;
}

const blank = text => text.replace(/[^\n]/g, ' ');

function normalize(text) {
  return text
    .replace(/<[^>]*>/g, blank) // markup between words reads as space
    .replace(/&(rsquo|lsquo|apos|#39|#x27|#8217|#8216|#x2019|#x2018);/gi, "'")
    .replace(/\\u201[89]/gi, "'") // JSON escapes
    .replace(/[\u2018\u2019\u02bc\u2032]/g, "'")
    .replace(/&(nbsp|#160|#xa0);/gi, ' ')
    .replace(/&(ndash|mdash|#8211|#8212);/gi, '-')
    .replace(/&amp;/gi, '&');
}

function scanText(text, rel = '<inline>') {
  if (exemptPath(rel)) return [];
  let body = text;
  for (const region of EXEMPT_REGIONS) body = body.replace(region.pattern, blank);
  body = normalize(body);
  for (const sentence of EXEMPT_SENTENCES) body = body.replace(sentence.pattern, blank);
  const findings = [];
  for (const { family, phrase, regex } of MATCHERS) {
    regex.lastIndex = 0;
    for (const match of body.matchAll(regex)) {
      const line = body.slice(0, match.index).split('\n').length;
      findings.push({ file: rel, line, family: family.id, familyName: family.name, phrase, match: match[0].replace(/\s+/g, ' ') });
    }
  }
  // "what this does not prove" also matches "does not prove"; report the
  // longest phrase once per location.
  const seen = new Map();
  for (const finding of findings) {
    const key = `${finding.file}:${finding.line}:${finding.family}`;
    const prior = seen.get(key);
    if (!prior || finding.match.length > prior.match.length) seen.set(key, finding);
  }
  return [...seen.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function scanSite() {
  return publicFiles().flatMap(rel => scanText(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel));
}

function format(finding) {
  return `${finding.file}:${finding.line}: family ${finding.family} (${finding.familyName}): "${finding.match}"`;
}

module.exports = { FAMILIES, EXEMPT_PATHS, EXEMPT_REGIONS, EXEMPT_SENTENCES, publicFiles, scanText, scanSite, format, exemptPath };
