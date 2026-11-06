const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('home and founder record include sourced November coverage and dated recognition', () => {
  for (const path of ['index.html', 'jason-colapietro/index.html', 'llms-full.txt']) {
    const text = fs.readFileSync(path, 'utf8');
    for (const phrase of ['October 31, 2026', '5.0/5 on Clutch', 'IA Práctica', 'NeuralAdX', 'glama.ai/mcp/servers/JasonColapietro/suede-creator-skills', 'https://jasoncolapietro.com/apps/']) assert.ok(text.includes(phrase), `${path}: ${phrase}`);
  }
});
