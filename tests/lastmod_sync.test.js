const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Sitemap <lastmod>, JSON-LD "dateModified" and article:modified_time come from
// git (scripts/sync-lastmod.mjs). They must agree with each other, and none may
// be older than the page's last commit, or search engines are told a changed
// page has not changed. Fix a failure with `node scripts/sync-lastmod.mjs`.
const root = path.resolve(__dirname, '..');
const SITE_URL = 'https://suedeai.org';
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const entries = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
  .map(([, loc, lastmod]) => {
    const route = loc.slice(SITE_URL.length).replace(/^\/+|\/+$/g, '');
    return { loc, lastmod, file: route ? `${route}/index.html` : 'index.html' };
  });

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

test('every sitemap URL has a lastmod', () => {
  assert.ok(entries.length > 0);
  assert.equal(entries.length, (sitemap.match(/<url>/g) || []).length);
});

test('page dateModified and article:modified_time equal the sitemap lastmod', () => {
  for (const { loc, lastmod, file } of entries) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [, date] of html.matchAll(/"dateModified"\s*:\s*"([^"]+)"/g)) {
      assert.equal(date, lastmod, `${file} dateModified ${date} != sitemap lastmod ${lastmod} for ${loc}`);
    }
    for (const [, date] of html.matchAll(/<meta\s+property="article:modified_time"\s+content="(\d{4}-\d{2}-\d{2})/g)) {
      assert.equal(date, lastmod, `${file} article:modified_time ${date} != sitemap lastmod ${lastmod}`);
    }
  }
});

test('no lastmod is older than the page file\'s last commit', (t) => {
  const shallow = git('rev-parse', '--is-shallow-repository');
  if (shallow !== 'false') {
    t.skip('needs full git history (git fetch --unshallow origin); CI checks out with fetch-depth 0');
    return;
  }
  for (const { loc, lastmod, file } of entries) {
    const committed = git('log', '-1', '--format=%cs', '--', file);
    if (!committed) continue;
    assert.ok(lastmod >= committed, `${loc}: lastmod ${lastmod} predates ${file}'s last commit ${committed}; run node scripts/sync-lastmod.mjs`);
  }
});
