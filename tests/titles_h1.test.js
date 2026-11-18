const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Search-result contract for every public page: a title of 60 characters or
// fewer that names the company Suede, a meta description of 155 characters or
// fewer, and exactly one H1. The company is named "Suede" (owner ruling
// 2026-11-18); "Suede AI", "Suede Labs AI" and "Suede Labs" are alternate names,
// so titles and H1s may use either form.
const root = path.resolve(__dirname, '..');

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['docs', 'node_modules', 'tests'].includes(entry.name)) return [];
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(name) : name.endsWith('.html') ? [name] : [];
  });
}

function decode(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

for (const file of htmlFiles(root)) {
  const rel = path.relative(root, file);
  const html = fs.readFileSync(file, 'utf8');
  test(`${rel}: title, description and H1 meet the search contract`, () => {
    const title = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    assert.ok(title, 'missing <title>');
    assert.ok(title.length <= 60, `title is ${title.length} characters: ${title}`);
    assert.match(title, /\bSuede\b/, `title must name Suede: ${title}`);

    const description = decode((html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || '');
    assert.ok(description.length > 0 && description.length <= 155, `description is ${description.length} characters`);

    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => decode(match[1]));
    assert.equal(h1s.length, 1, `expected one H1, found ${h1s.length}`);
  });
}

test('the founder page title and H1 name the company Suede', () => {
  const html = fs.readFileSync(path.join(root, 'jason-colapietro', 'index.html'), 'utf8');
  assert.match(html, /<title>Jason Colapietro, Founder and CEO of Suede<\/title>/);
  assert.match(html, /<h1>Jason Colapietro, founder and CEO of Suede<\/h1>/);
});

test('the company entity is named Suede, with Suede AI, Suede Labs AI and Suede Labs as alternate names', () => {
  for (const file of htmlFiles(root)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const value = JSON.parse(match[1]);
      const nodes = (Array.isArray(value) ? value : [value]).flatMap(item => item['@graph'] || [item]);
      for (const node of nodes.filter(n => n['@id'] === 'https://suedeai.ai/#organization' && n.alternateName)) {
        const names = [].concat(node.alternateName);
        assert.equal(node.name, 'Suede', path.relative(root, file));
        assert.deepEqual(names, ['Suede AI', 'Suede Labs AI', 'Suede Labs'], path.relative(root, file));
      }
    }
  }
});
