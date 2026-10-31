const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Search-result contract for every public page: a title of 60 characters or
// fewer that names the company as "Suede AI" (never bare "Suede"), a meta
// description of 155 characters or fewer, and exactly one H1 that never uses
// the bare brand either.
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

const bareBrand = /\bSuede\b(?! AI\b)(?!Mic|Vault)/;

for (const file of htmlFiles(root)) {
  const rel = path.relative(root, file);
  const html = fs.readFileSync(file, 'utf8');
  test(`${rel}: title, description and H1 meet the search contract`, () => {
    const title = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    assert.ok(title, 'missing <title>');
    assert.ok(title.length <= 60, `title is ${title.length} characters: ${title}`);
    assert.ok(title.includes('Suede AI'), `title must name Suede AI: ${title}`);
    assert.doesNotMatch(title, bareBrand, `title uses bare "Suede": ${title}`);

    const description = decode((html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || '');
    assert.ok(description.length > 0 && description.length <= 155, `description is ${description.length} characters`);

    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => decode(match[1]));
    assert.equal(h1s.length, 1, `expected one H1, found ${h1s.length}`);
    assert.doesNotMatch(h1s[0], bareBrand, `H1 uses bare "Suede": ${h1s[0]}`);
  });
}

test('the company entity never lists the bare word "Suede" as an alternateName', () => {
  for (const file of htmlFiles(root)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const value = JSON.parse(match[1]);
      const nodes = (Array.isArray(value) ? value : [value]).flatMap(item => item['@graph'] || [item]);
      for (const node of nodes.filter(n => n['@id'] === 'https://suedeai.ai/#organization' && n.alternateName)) {
        const names = [].concat(node.alternateName);
        assert.ok(!names.includes('Suede'), path.relative(root, file));
      }
    }
  }
});
