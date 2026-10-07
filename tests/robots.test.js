const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const robots = readFileSync(join(__dirname, "../robots.txt"), "utf8");

// A named crawler group replaces the wildcard group; it does not inherit its
// exclusions. Keep the intended public-site/API boundary in every group.
const groups = [];
let current;
for (const rawLine of robots.split(/\r?\n/)) {
  const line = rawLine.replace(/#.*$/, "").trim();
  if (!line) continue;
  const colon = line.indexOf(":");
  if (colon < 0) continue;
  const key = line.slice(0, colon).trim().toLowerCase();
  const value = line.slice(colon + 1).trim();
  if (key === "user-agent") {
    if (!current || current.rules.length) {
      current = { agents: [], rules: [] };
      groups.push(current);
    }
    current.agents.push(value);
  } else if (current && (key === "allow" || key === "disallow")) {
    current.rules.push({ key, value });
  }
}

test("every crawler group allows public pages and excludes API routes", () => {
  assert.ok(groups.length > 0, "robots.txt must contain crawler rules");
  for (const group of groups) {
    assert.deepEqual(group.rules, [
      { key: "allow", value: "/" },
      { key: "disallow", value: "/api/" },
    ], `${group.agents.join(", ")} must preserve the public-site/API boundary`);
  }
});

test("search crawlers and the public sitemap remain discoverable", () => {
  const agents = groups.flatMap(group => group.agents);
  for (const agent of ["*", "Googlebot", "Bingbot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot"]) {
    assert.ok(agents.includes(agent), `${agent} must retain an explicit crawler group`);
  }
  assert.match(robots, /^Sitemap: https:\/\/suedeai\.org\/sitemap\.xml$/m);
});
