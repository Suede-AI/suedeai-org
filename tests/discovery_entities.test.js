const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.')) return [];
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(name) : name.endsWith('.html') ? [name] : [];
  });
}
function nodes(file) {
  return [...fs.readFileSync(file, 'utf8').matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(match => {
    const value = JSON.parse(match[1]);
    return (Array.isArray(value) ? value : [value]).flatMap(item => item['@graph'] || [item]);
  });
}
const pages = htmlFiles(root);
test('each standalone JSON-LD document declares its own schema context', () => {
  for (const file of pages) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const value = JSON.parse(match[1]);
      for (const node of Array.isArray(value) ? value : [value]) {
        assert.equal(node['@context'], 'https://schema.org', path.relative(root, file));
      }
    }
  }
});
const orgId = 'https://suedeai.ai/#organization';
const founderId = 'https://suedeai.ai/founder#person';
test('every full company node shares one identity, logo and accurate company context', () => {
  const organizations = pages.flatMap(nodes).filter(n => n['@type'] === 'Organization' && n['@id'] === orgId);
  assert.equal(organizations.length, 24);
  for (const org of organizations) {
    assert.deepEqual(org, organizations[0]);
    assert.equal(org.name, 'Suede AI');
    assert.ok(org.alternateName.includes('Suede Labs AI'));
    assert.equal(org.legalName, undefined);
    assert.equal(org.logo, 'https://suedeai.ai/suede-ai-logo-transparent.png');
    assert.equal(org.address.addressLocality, 'West Palm Beach');
    assert.ok(org.sameAs.includes('https://www.wikidata.org/wiki/Q141169484'));
    assert.equal(new Set(org.sameAs).size, org.sameAs.length);
  }
});
test('founder identity remains canonical and excludes company and software accounts', () => {
  const people = pages.flatMap(nodes).filter(n => n['@type'] === 'Person' && n['@id'] === founderId);
  assert.equal(people.length, 9);
  for (const person of people) {
    assert.equal(person.url, 'https://suedeai.ai/founder');
    assert.ok(person.sameAs.includes('https://www.wikidata.org/wiki/Q140235755'));
    assert.ok(!person.sameAs.includes('https://www.youtube.com/@aisuede'));
    assert.ok(!person.sameAs.some(url => url.startsWith('https://app.virtuals.io/')));
  }
});
test('homepage location and legal navigation agree with company identity', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('Suede AI, West Palm Beach, FL'));
  assert.ok(!html.includes('San Francisco'));
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
  for (const route of ['/privacy/', '/terms/']) assert.ok(footer.includes(`href="${route}"`));
  assert.equal(nodes(path.join(root, 'index.html')).find(n => n['@type'] === 'SoftwareApplication').applicationCategory, 'BusinessApplication');
});
test('proof thesis links technical guide and consistently states evidentiary limits', () => {
  const html = fs.readFileSync(path.join(root, 'proof-of-creation/index.html'), 'utf8');
  assert.ok(html.includes('href="https://suedeai.ai/proof-of-creation"'));
  assert.ok(html.includes('does not independently establish human authorship, copyright ownership, originality, or consent'));
  assert.ok(html.includes('signature authenticates the signing account'));
  assert.ok(!html.includes('Proof of creation makes authorship, provenance, and creator rights verifiable'));
  const article = nodes(path.join(root, 'proof-of-creation/index.html')).find(n => n['@type'] === 'Article');
  assert.equal(article.dateModified, '2026-10-03');
  assert.ok(html.includes(`<h1>${article.headline}</h1>`));
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/suedeai.org\/proof-of-creation\/<\/loc>\s*<lastmod>2026-10-03<\/lastmod>/);
});
