#!/usr/bin/env node
// Derive every sitemap <lastmod>, JSON-LD "dateModified" and
// article:modified_time from git, so the dates search engines read move when a
// page actually changes and never when it does not.
//
//   node scripts/sync-lastmod.mjs          rewrite sitemap.xml and the pages
//   node scripts/sync-lastmod.mjs --check  exit 1 if anything is out of date
//
// For each sitemap URL the date is the page file's last commit date
// (`git log -1 --format=%cs`). A page that is edited but not yet committed, or
// whose own dates this run has to rewrite (which edits it), gets today's date
// instead: that edit lands in the next commit, so today is its commit date.
// Run it before committing a page change. tests/lastmod_sync.test.js keeps the
// three dates equal and no earlier than the page's last commit.
//
// It needs full history: in a shallow clone every file's date is the clone tip.
// Run `git fetch --unshallow origin` first.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://suedeai.org';
const check = process.argv.includes('--check');

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

if (git('rev-parse', '--is-shallow-repository') === 'true') {
  console.error('sync-lastmod: shallow clone; run `git fetch --unshallow origin` first.');
  process.exit(1);
}

export function pageFileFor(loc) {
  const route = loc.slice(SITE_URL.length).replace(/^\/+|\/+$/g, '');
  return route ? `${route}/index.html` : 'index.html';
}

const DATE_PATTERNS = [
  /("dateModified"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/g,
  /(<meta\s+property="article:modified_time"\s+content=")(\d{4}-\d{2}-\d{2})(T[^"]*")/g,
];

const today = new Date().toISOString().slice(0, 10);
const sitemapPath = path.join(root, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
const stale = [];

sitemap = sitemap.replace(
  /(<url>\s*<loc>)([^<]+)(<\/loc>\s*<lastmod>)(\d{4}-\d{2}-\d{2})(<\/lastmod>)/g,
  (whole, open, loc, mid, oldLastmod, close) => {
    const file = pageFileFor(loc);
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) throw new Error(`sitemap.xml lists ${loc} but ${file} does not exist`);
    const html = fs.readFileSync(abs, 'utf8');
    const committed = git('log', '-1', '--format=%cs', '--', file);
    const dirty = git('status', '--porcelain', '--', file) !== '';
    let target = dirty || !committed ? today : committed;
    const pageDates = DATE_PATTERNS.flatMap(re => [...html.matchAll(re)].map(m => m[2]));
    if (pageDates.some(d => d !== target)) target = today;
    if (pageDates.some(d => d !== target)) {
      stale.push(`${file}: page dates ${[...new Set(pageDates)].join(', ')} -> ${target}`);
      if (!check) {
        let next = html;
        for (const re of DATE_PATTERNS) next = next.replace(re, (_, a, _d, b) => `${a}${target}${b}`);
        fs.writeFileSync(abs, next);
      }
    }
    if (oldLastmod !== target) stale.push(`sitemap.xml: ${loc} lastmod ${oldLastmod} -> ${target}`);
    return `${open}${loc}${mid}${target}${close}`;
  },
);

if (check) {
  if (stale.length) {
    console.error(`sync-lastmod: ${stale.length} date(s) out of date:\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log('sync-lastmod: every date matches git.');
} else {
  fs.writeFileSync(sitemapPath, sitemap);
  console.log(stale.length ? `sync-lastmod: updated\n  ${stale.join('\n  ')}` : 'sync-lastmod: nothing to update.');
}
