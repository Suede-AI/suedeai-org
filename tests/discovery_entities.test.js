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
test('public copy, metadata and structured data exclude the unrelated guitar app', () => {
  const files = [...pages, ...['llms.txt', 'llms-full.txt', 'content/accomplishments.json', 'docs/accomplishments.md'].map(file => path.join(root, file))];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /FretPulse\s+LLC|6766649729|fretpulse\.io/i, path.relative(root, file));
  }
});
test('both app catalogs preserve the nine Suede apps and the correct tuner identity', () => {
  const expectedIds = ['6765461286', '6767552764', '6767763231', '6779134962', '6778880737', '6778286160', '6770668793', '6785347610', '6806770875'].sort();
  for (const file of ['index.html', 'investors/index.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const appIds = [...new Set([...html.matchAll(/https:\/\/apps\.apple\.com\/[a-z]{2}\/app\/[^"\s]+\/id(\d+)/g)].map(match => match[1]))].sort();
    assert.deepEqual(appIds, expectedIds, file);
    assert.match(html, /href="https:\/\/fretpulse\.suedeai\.ai\/"[^>]*>Suede Guitar Tuner &amp; Studio<\/a>/, file);
  }
});
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

// Identity canon v2 (2026-10-19), Suede-AI-App suede-home/src/lib/identity-canon.ts:
// the company and founder one-liners are quoted, never paraphrased, and the
// founder's sameAs is the verified list only (no pages of his own sites).
const COMPANY_ONE_LINER = 'Suede AI is an agentic platform company founded in 2024 by engineer Jason Colapietro in West Palm Beach, Florida. It builds and runs AI agent platforms that businesses use to manage their work, and white-labels them for agencies and their clients.';
const FOUNDER_ONE_LINER = 'Jason Colapietro is an engineer, author, and the founder and CEO of Suede AI. He has 54 pull requests merged across 46 open-source repositories he does not maintain, including Jest, Adobe React Spectrum, Backstage and the Polkadot SDK; he has written five books on Amazon in hardcover, paperback, and Kindle, including The Claude Code Bible and Codex in Production; and he has shipped 9 iOS apps under his own Apple developer account. He publishes under the pen name Johnny Suede.';
const CANONICAL_PERSON_SAME_AS = [
  'https://www.wikidata.org/wiki/Q140235755',
  'https://www.crunchbase.com/person/jason-colapietro-d83e',
  'https://apps.apple.com/us/developer/jason-colapietro/id1895958699',
  'https://github.com/JasonColapietro',
  'https://www.linkedin.com/in/jasoncolapietro',
  'https://x.com/johnnysuede',
  'https://www.youtube.com/@johnnysuede',
  'https://jasoncolapietro.substack.com',
  'https://jasoncolapietro.com',
  'https://johnnysuede.com',
];
test('company and founder nodes quote identity canon v2', () => {
  const all = pages.flatMap(nodes);
  for (const org of all.filter(n => n['@type'] === 'Organization' && n['@id'] === orgId && n.description)) {
    assert.equal(org.description, COMPANY_ONE_LINER);
  }
  const people = all.filter(n => n['@type'] === 'Person' && n['@id'] === founderId);
  assert.ok(people.length > 0);
  for (const person of people) {
    if (person.description) assert.equal(person.description, FOUNDER_ONE_LINER);
    if (person.jobTitle) assert.equal(person.jobTitle, 'Founder and CEO, Suede AI');
    assert.deepEqual(person.sameAs, CANONICAL_PERSON_SAME_AS);
  }
  for (const file of ['llms.txt', 'llms-full.txt']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(text.includes(COMPANY_ONE_LINER), file);
    assert.doesNotMatch(text, /web development and software engineering company|current business focus is web development/i, file);
  }
});
test('the founder lists seven works and no catalog note as a book', () => {
  const books = pages.flatMap(nodes).filter(n => n['@type'] === 'Book');
  assert.ok(!books.some(b => /Guitar Without a Number/.test(b.name)));
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /Eight titles are listed/, path.relative(root, file));
  }
});
test('every patent mention on llms.txt lists all five provisional applications', () => {
  const text = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
  for (const line of text.split('\n').filter(l => /patent/i.test(l))) {
    for (const serial of ['63/946,189', '63/946,192', '63/946,212', '63/946,217', '63/947,120']) {
      assert.ok(line.includes(serial), `${serial} missing from: ${line.slice(0, 80)}`);
    }
  }
});
