const { test } = require('node:test');
const assert = require('node:assert/strict');
const guard = require('./brand-name-guard');

// Guard: public copy names the company "Suede" (owner direction 2026-11-21).
// See tests/brand-name-guard.js for the allowed alias spots.

test('public copy names the company Suede, never Suede AI or Suede Labs', () => {
  const findings = guard.scanSite();
  const report = findings.map(guard.format).join('\n');
  assert.equal(findings.length, 0, `Old company names in public copy (write "Suede"):\n${report}`);
});

test('the old names are caught in page text, titles and JSON-LD names', () => {
  for (const sample of ['<p>Suede AI builds rails.</p>', '<title>About Suede Labs</title>', '{"name": "Suede Labs AI"}', '<p>SUEDE&nbsp;AI</p>', "<p>Suede AI's thesis</p>"]) {
    assert.equal(guard.scanText(`<p>Intro.</p>\n${sample}`, 'about/index.html').length, 1, sample);
  }
});

test('allowed: schema alternateName, one alias line, quotes and listed literals', () => {
  assert.deepEqual(guard.scanText('"alternateName": ["Suede AI", "Suede Labs AI", "Suede Labs"]', 'index.html'), []);
  assert.deepEqual(guard.scanText('Suede is also known as Suede AI and Suede Labs.', 'llms.txt'), []);
  assert.equal(guard.scanText('Suede is also known as Suede AI.\nFormerly Suede Labs.', 'llms.txt').length, 1, 'only one alias line per file');
  assert.equal(guard.scanText('Suede is also known as Suede AI.', 'about/index.html').length, 1, 'alias lines belong to the discovery files only');
  assert.deepEqual(guard.scanText('<blockquote cite="https://example.com">Suede AI is great</blockquote>', 'index.html'), []);
  assert.deepEqual(guard.scanText('<a href="#">Suede AI Agents: Directory</a>', 'index.html'), []);
  assert.deepEqual(guard.scanText('<!-- Suede AI -->', 'index.html'), []);
});

test('URLs, slugs and domains are not names', () => {
  assert.deepEqual(guard.scanText('<a href="/compare/suede-ai-vs-bernstein/">suedeai.ai</a>', 'index.html'), []);
});

test('every allowed literal carries a reason', () => {
  for (const entry of guard.ALLOWED_LITERALS) assert.ok(entry.reason, entry.text);
});
