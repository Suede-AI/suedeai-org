const { test } = require('node:test');
const assert = require('node:assert/strict');
const guard = require('./hedging-guard');

// Guard: banned hedging phrases never ship in public copy (owner ruling
// 2026-11-18). See tests/hedging-guard.js for the families and every exemption.

test('public copy carries no banned hedging phrase', () => {
  const findings = guard.scanSite();
  const report = findings.map(guard.format).join('\n');
  if (findings.length) console.error(`Banned hedging phrases in public copy:\n${report}`);
  assert.equal(findings.length, 0, `Banned hedging phrases in public copy (state the fact confidently instead):\n${report}`);
});

test('the scan covers pages, llms files, public JSON and the public Markdown record', () => {
  const files = guard.publicFiles();
  for (const expected of ['index.html', 'jason-colapietro/index.html', 'llms.txt', 'llms-full.txt', 'ai-instructions/index.html', 'content/accomplishments.json', 'docs/accomplishments.md']) {
    assert.ok(files.includes(expected), `scan is missing ${expected}`);
  }
  for (const excluded of ['README.md', 'AGENTS.md', 'vercel.json', 'requirements-test.txt', 'docs/handoffs/2026-11-04-vs-and-alternatives-pages.md']) {
    assert.ok(!files.includes(excluded), `scan should not read ${excluded}`);
  }
});

const familyCases = {
  1: ['Results cannot be promised.', 'We can’t promise rankings.', 'We cannot promise placement.', 'No one can guarantee an AI answer.', 'Nobody can guarantee it.', 'This is not a guarantee.', 'There are no guarantees.'],
  2: ['What this does not prove', 'A screenshot doesn&rsquo;t prove anything.', 'This doesn\'t prove reach.', 'It is not proof of demand.', 'The chart does <em>not</em> prove growth.'],
  3: ['These are events, not users.', '1,000 sessions, not active users.', '17 listings, not unique products.', 'Store views, not installs.', '528 events, not downloads.'],
  4: ['Source: Suede app analytics, as reported by Jason Colapietro.', 'A founder-reported figure.', 'Founder reported numbers.', 'Self-reported results.'],
  5: ['Some editions overlap.', 'Android editions overlap iOS products.', 'Counts describe platform listings.'],
};

for (const [family, samples] of Object.entries(familyCases)) {
  test(`family ${family} is caught, with file:line and the family`, () => {
    for (const sample of samples) {
      const findings = guard.scanText(`<p>Intro.</p>\n<p>${sample}</p>`, 'index.html');
      assert.ok(findings.some(f => f.family === Number(family)), `family ${family} missed: ${sample}`);
      const finding = findings.find(f => f.family === Number(family));
      assert.equal(finding.line, 2, sample);
      assert.match(guard.format(finding), new RegExp(`^index\\.html:2: family ${family} \\(`));
    }
  });
}

test('the five families match the owner ruling verbatim', () => {
  assert.deepEqual(guard.FAMILIES.map(f => f.phrases), [
    ['cannot be promised', "can't promise", 'cannot promise', 'no one can guarantee', 'nobody can guarantee', 'not a guarantee', 'no guarantee'],
    ['does not prove', "doesn't prove", 'what this does not prove', 'not proof'],
    ['events, not users', 'not active users', 'not unique products', 'not installs', 'not downloads'],
    ['as reported by', 'founder-reported', 'founder reported', 'self-reported'],
    ['editions overlap', 'Android editions overlap iOS', 'counts describe platform listings'],
  ]);
});

const banned = 'Results cannot be promised.';

test('exempt: legal pages', () => {
  for (const rel of ['terms/index.html', 'privacy/index.html', 'refund-policy/index.html', 'voice/terms/index.html', 'voice/privacy/index.html', 'licenses/index.html']) {
    assert.deepEqual(guard.scanText(banned, rel), [], rel);
  }
  assert.equal(guard.scanText(banned, 'about/index.html').length, 1, 'a non-legal page is still scanned');
});

test('exempt: code comments, inline scripts and styles', () => {
  assert.deepEqual(guard.scanText(`<!-- ${banned} -->`, 'index.html'), []);
  assert.deepEqual(guard.scanText(`<script>// ${banned}\nshowError("${banned}");</script>`, 'index.html'), []);
  assert.deepEqual(guard.scanText(`<style>/* ${banned} */</style>`, 'index.html'), []);
  assert.equal(guard.scanText(`<script type="application/ld+json">{"text":"${banned}"}</script>`, 'index.html').length, 1, 'JSON-LD is public copy');
});

test('exempt: error and status messages', () => {
  assert.deepEqual(guard.scanText(`<p role="alert">${banned}</p>`, 'contact/index.html'), []);
  assert.deepEqual(guard.scanText(`<div role="status">${banned}</div>`, 'contact/index.html'), []);
});

test('exempt: third-party quotes marked with cite or data-third-party', () => {
  assert.deepEqual(guard.scanText(`<blockquote cite="https://example.com"><p>${banned}</p></blockquote>`, 'index.html'), []);
  assert.deepEqual(guard.scanText(`<q data-third-party>${banned}</q>`, 'index.html'), []);
  assert.equal(guard.scanText(`<blockquote><p>${banned}</p></blockquote>`, 'index.html').length, 1, 'an unattributed blockquote is Suede copy and is scanned');
});

test('exempt: test fixtures and docs/handoffs', () => {
  assert.deepEqual(guard.scanText(banned, 'tests/fixtures/sample.json'), []);
  assert.deepEqual(guard.scanText(banned, 'docs/handoffs/2026-11-18-note.md'), []);
});

test('exempt: IP-registry legal explanations', () => {
  assert.deepEqual(guard.scanText('<p>A registry record doesn’t prove ownership.</p>', 'proof-of-creation/index.html'), []);
  assert.deepEqual(guard.scanText('<p>Registration does not prove authorship in court.</p>', 'why-copyright-fails/index.html'), []);
  assert.equal(guard.scanText('<p>This chart does not prove growth.</p>', 'proof-of-creation/index.html').length, 1);
});

test('exempt: methodology chapters of the book', () => {
  assert.deepEqual(guard.scanText('<p>A single screenshot does not prove a trend.</p>', 'site/book/chapters/measurement.html'), []);
  assert.equal(guard.scanText('<p>This does not prove anything.</p>', 'book/index.html').length, 1, 'the book landing page is sales copy and is scanned');
});

test('every exemption carries a one-line reason', () => {
  for (const entry of [...guard.EXEMPT_PATHS, ...guard.EXEMPT_REGIONS, ...guard.EXEMPT_SENTENCES]) {
    assert.ok(entry.reason && !entry.reason.includes('\n'), String(entry.pattern));
  }
});
