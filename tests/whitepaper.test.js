const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const pdfPath = '/whitepapers/suede-ai-agent-studio-v0.3.pdf';
const oldPath = '/wp-content/uploads/2024/12/Suede-Whitepaper.pdf';

test('the historical whitepaper resolves to the reviewed PDF before the WordPress catch-all', () => {
  const { redirects } = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const index = redirects.findIndex(rule => rule.source === oldPath);
  assert.ok(index >= 0);
  assert.ok(index < redirects.findIndex(rule => rule.source === '/wp-content/(.*)'));
  assert.equal(redirects[index].destination, pdfPath);
  assert.equal(redirects[index].permanent, true);
  const pdf = fs.readFileSync(path.join(root, pdfPath));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(createHash('sha256').update(pdf).digest('hex'), '465abed2d85ff8e38389ede7e39464e407888bb4b9836c686ae6db7c966d2ca5');
});

test('research discovery and document schema preserve the concept and credit boundaries', () => {
  const html = fs.readFileSync(path.join(root, 'research/index.html'), 'utf8');
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const doc = graph.find(node => node['@type'] === 'DigitalDocument');
  assert.equal(graph.find(node => node['@type'] === 'WebPage').hasPart['@id'], doc['@id']);
  assert.equal(doc.url, 'https://suedeai.org' + pdfPath);
  assert.equal(doc.encoding.contentUrl, doc.url);
  assert.equal(doc.encoding.encodingFormat, 'application/pdf');
  assert.equal(doc.author['@id'], 'https://suedeai.ai/founder#person');
  assert.equal(doc.publisher['@id'], 'https://suedeai.ai/#organization');
  assert.equal(doc.creativeWorkStatus, 'Purely conceptual and theoretical');
  const panel = html.match(/<article class="panel" id="agent-habitats-paper"[^>]*>([\s\S]*?)<\/article>/)[1];
  assert.ok(panel.includes('href="' + pdfPath + '"'));
  for (const phrase of ['Purely conceptual and theoretical', 'Amjad Masad', 'Marc Andreessen', 'does not assert deployed mechanisms or token benefits']) assert.ok(panel.includes(phrase));
});
