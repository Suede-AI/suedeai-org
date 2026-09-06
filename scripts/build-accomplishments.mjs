// Dated local snapshot: updates require editing content/accomplishments.json.
import { readFileSync, writeFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const data = JSON.parse(read('content/accomplishments.json'));
const targets = JSON.parse(read('content/accomplishments-targets.json'));
const esc = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const start = '<!-- accomplishments:start -->';
const end = '<!-- accomplishments:end -->';
for (const target of targets) {
 const records = target.compact ? data.records.filter(r => ['google-cloud','open-source','books','coverage'].includes(r.id)) : data.records;
 const cards = records.map(r => `<article class="accomplishment" id="accomplishment-${esc(r.id)}"><p class="accomplishment-meta">${esc(r.category)} · ${esc(r.date)}</p><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><ul class="accomplishment-links">${r.links.map(l => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('')}</ul></article>`).join('\n');
 const content = `${start}\n<section id="accomplishments" class="accomplishments ${esc(target.className)}" aria-labelledby="accomplishments-title"><p class="accomplishments-kicker">Jason Colapietro / Suede Labs AI · Updated ${data.updated}</p><h2 id="accomplishments-title">${esc(target.compact ? 'A record built in public.' : data.title)}</h2><p class="accomplishments-intro">${esc(data.intro)}</p><div class="accomplishments-list">${cards}</div>${target.compact ? `<p class="accomplishments-more"><a href="${esc(target.fullUrl)}">Explore all accomplishments and source records</a></p>` : `<p class="accomplishments-more"><a href="${esc(data.source)}">Explore the original evidence archive on Suede SEO</a></p>`}</section>\n${end}`;
 const original = read(target.file);
 if (!original.includes(start) || !original.includes(end)) throw new Error(`Missing record markers in ${target.file}`);
 const updated = original.slice(0,original.indexOf(start)) + content + original.slice(original.indexOf(end)+end.length);
 if (process.argv.includes('--check')) { if (original !== updated) throw new Error(`Regenerate ${target.file}`); }
 else writeFileSync(new URL('../'+target.file,import.meta.url),updated);
}

const feedPath = 'llms-full.txt';
const feed = read(feedPath);
const text = '\n## Accomplishments — updated '+data.updated+'\n\n'+data.records.map(r => r.title+'\n'+r.date+'\n'+r.body+'\n'+r.links.map(l => l.label+': '+l.url).join('\n')).join('\n\n')+'\n';
if (!feed.includes(start) || !feed.includes(end)) throw new Error(`Missing record markers in ${feedPath}`);
const updatedFeed = feed.slice(0,feed.indexOf(start)) + start + text + end + feed.slice(feed.indexOf(end)+end.length);
if (process.argv.includes('--check')) { if (feed !== updatedFeed) throw new Error(`Regenerate ${feedPath}`); }
else writeFileSync(new URL('../'+feedPath,import.meta.url),updatedFeed);
