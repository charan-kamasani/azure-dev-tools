import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL(".github/plugin/marketplace.json", root), "utf8"));
const customerDocs = [
  "README.md",
  "docs/plugin-marketplace.md",
  "docs/azure-resources-query/README.md",
  "canvases/azure-functions-hosted-skills/README.md",
  "canvases/azure-resources-query/README.md",
  "canvases/azure-sre-agent/README.md",
  "canvases/azure-sre-agent/docs/advanced.md",
  "canvases/azure-sre-agent/skills/azure-sre-agent-canvas/SKILL.md",
  "canvases/azure-functions-hosted-skills/skills/azure-functions-hosted-skills-canvas/SKILL.md",
  "canvases/azure-functions-hosted-skills/skills/azure-functions-hosted-skills-github-daily-digest/SKILL.md",
];

test("customer installation docs identify the production repository, not public staging", () => {
  for (const path of customerDocs) {
    const content = readFileSync(new URL(path, root), "utf8");
    const owners = [...content.matchAll(/\b([A-Za-z][\w-]*)\/azure-dev-tools\b/gi)]
      .map((match) => match[1].toLowerCase());
    assert.ok(owners.length > 0, `${path}: missing production repository destination`);
    assert.deepEqual([...new Set(owners)], ["microsoft"], `${path}: wrong repository owner`);
  }
});

test("production catalog matches all installable plugins in order", () => {
  const readme = readFileSync(new URL("README.md", root), "utf8");
  const rows = readme.split("\n").filter((line) => line.startsWith("| ["));
  const products = {
    "azure-functions-hosted-skills": ["Azure Functions Hosted Skills", "canvases/azure-functions-hosted-skills/"],
    "azure-resources-query": ["Azure Resources Query", "canvases/azure-resources-query/"],
    "canvas-authoring": ["Canvas Authoring", "plugins/canvas-authoring/"],
    "azure-cost-health-check": ["Azure Cost Health Check", "canvases/azure-cost-health-check/"],
    "azure-sre-agent": ["Azure SRE Agent", "canvases/azure-sre-agent/"],
  };
  assert.equal(rows.length, manifest.plugins.length);
  for (const [index, { name, version }] of manifest.plugins.entries()) {
    const [label, path] = products[name];
    assert.ok(rows[index].startsWith(`| [${label}](${path}) |`), `catalog order: ${label}`);
    assert.ok(existsSync(new URL(path, root)), `${label}: missing package`);
    assert.ok(rows[index].includes(version), `${label}: current catalog version`);
  }
  assert.match(rows[2], /Skill-only plugin, with no canvas panel/);
  assert.match(readme, /copilot plugin install azure-sre-agent@azure-dev-tools/);
  assert.match(readme, /\[Azure SRE Agent\]\(canvases\/azure-sre-agent\/\)/);
});

test("SRE package has its catalog identity, official preview logo and customer connection steps", () => {
  const path = "canvases/azure-sre-agent/";
  const catalogEntry = manifest.plugins.find(({ name }) => name === "azure-sre-agent");
  const plugin = JSON.parse(readFileSync(new URL(`${path}.github/plugin/plugin.json`, root)));
  const release = JSON.parse(readFileSync(new URL(`${path}release.json`, root)));
  const readme = readFileSync(new URL(`${path}README.md`, root), "utf8");
  assert.equal(plugin.name, "azure-sre-agent");
  assert.equal(plugin.version, catalogEntry.version);
  assert.equal(plugin.description, catalogEntry.description);
  assert.deepEqual(plugin.skills, ["./skills/azure-sre-agent-canvas/"]);
  assert.equal(plugin.extensions["com.github.copilot"].logo, "assets/preview.png");
  assert.equal(release.publicationRepository, "microsoft/azure-dev-tools");
  assert.equal(release.plugin.extension.entry,
    "com.github.copilot/extensions/azure-sre-agent/extension.mjs");
  assert.match(readme, /Open an agent by URL or resource ID/);
  assert.match(readme, /Save connected agent/);
  assert.match(readme, /My app is failing/);
  assert.match(readme, /microsoft\/azure-dev-tools/);
});

test("Cost Health package and customer README match the current catalog", () => {
  const path = "canvases/azure-cost-health-check/";
  const catalogEntry = manifest.plugins.find(({ name }) => name === "azure-cost-health-check");
  const plugin = JSON.parse(readFileSync(new URL(`${path}.github/plugin/plugin.json`, root)));
  const release = JSON.parse(readFileSync(new URL(`${path}release.json`, root)));
  const readme = readFileSync(new URL(`${path}README.md`, root), "utf8");
  const implementation = readFileSync(new URL(`${path}docs/implementation.md`, root), "utf8");
  assert.equal(plugin.name, "azure-cost-health-check");
  assert.equal(plugin.version, catalogEntry.version);
  assert.equal(release.version, catalogEntry.version);
  assert.deepEqual(plugin.skills, ["./skills/azure-cost-health-check/"]);
  assert.equal(plugin.extensions["com.github.copilot"].logo, "assets/preview.png");
  assert.equal(release.plugin.extension.entry,
    "com.github.copilot/extensions/azure-cost-health-check/extension.mjs");
  assert.match(readme, /install \*\*Azure Cost Health Check\*\*/);
  assert.match(readme, /copilot plugin install azure-cost-health-check@awesome-copilot/);
  assert.match(readme, /Open Azure Cost Health Check in real mode for my subscription/);
  assert.match(readme, /A loading or permission-limited\s+section is not zero cost/);
  assert.doesNotMatch(readme, /\bcandidate\b|receipt|verification evidence|release process/i);
  assert.match(readme, /\[installation notes\]\(docs\/implementation\.md#install\)/);
  assert.match(implementation, /com\.github\.copilot\/extensions\/azure-cost-health-check/);
  assert.match(implementation, /If the `azure-cost-health-check-latest` tag is\s+available/i);
});

test("current builder install and bundled quickstart do not claim an active release hold", () => {
  const readme = readFileSync(new URL("plugins/canvas-authoring/README.md", root), "utf8");
  const quickstart = readFileSync(new URL(
    "plugins/canvas-authoring/skills/create-canvas-app/references/toolkit/quickstart.md", root,
  ), "utf8");
  for (const [path, content] of [["builder README", readme], ["toolkit quickstart", quickstart]]) {
    assert.doesNotMatch(content, /\brelease hold\b|\bunreleased candidate\b/i, path);
    assert.match(content, /microsoft\/azure-dev-tools/, `${path}: private production destination`);
  }
});

test("Hosted customer guide retains installation, launch, first-run, and safety instructions", () => {
  const readme = readFileSync(new URL("canvases/azure-functions-hosted-skills/README.md", root), "utf8");
  const advanced = readFileSync(new URL("canvases/azure-functions-hosted-skills/docs/advanced.md", root), "utf8");
  assert.match(readme, /Create and run a local Timer, HTTP, or Queue Hosted Skill/);
  for (const heading of ["Install", "Try it", "What you can do", "Prompts to try"]) {
    assert.ok(readme.includes(`## ${heading}\n`), `Hosted guide missing ${heading}`);
  }
  assert.match(readme, /copilot plugin install azure-functions-hosted-skills@awesome-copilot/);
  assert.match(readme, /full plugin installs\s+the canvas and both launcher skills/);
  assert.match(readme, /Ask \*\*Open Azure Functions Hosted Skills canvas\*\*/);
  assert.match(readme, /\*\*Local Function\s+App\*\*/);
  assert.match(readme, /\*\*Start local function\*\*/);
  assert.match(readme, /\*\*Invoke Trigger\*\*/);
  assert.match(readme, /Remote invocation sends a real\s+request.*requires your confirmation/);
  assert.match(readme, /\[installation notes\]\(docs\/advanced\.md\)/);
  assert.match(advanced, /git clone --depth 1 --branch "\$HOSTED_SKILLS_TAG" https:\/\/github\.com\/microsoft\/azure-dev-tools\.git/);
  assert.match(advanced, new RegExp(`exact ${manifest.plugins[0].version.replaceAll(".", "\\.")} pin, wait`));
  assert.match(advanced, /azure-functions-hosted-skills-canvas/);
  assert.match(advanced, /azure-functions-hosted-skills-github-daily-digest/);
  assert.match(advanced, /com\.github\.copilot\/extensions\/azure-functions-hosted-skills/);
  assert.match(advanced, /The Azure CLI login remains yours/);
  assert.match(advanced, /This installs the canvas only, not the/);
});

test("customer guides link to full-plugin and canvas-only installation instructions", () => {
  for (const name of ["azure-functions-hosted-skills", "azure-resources-query"]) {
    const readme = readFileSync(new URL(`canvases/${name}/README.md`, root), "utf8");
    const advanced = readFileSync(new URL(`canvases/${name}/docs/advanced.md`, root), "utf8");
    assert.match(readme, /\[installation (?:notes|alternatives)\]\(docs\/advanced\.md\)/);
    assert.match(advanced, /git clone --depth 1 --branch/);
    assert.match(advanced, new RegExp(`exact ${manifest.plugins.find((plugin) => plugin.name === name).version.replaceAll(".", "\\.")}\\s+pin, wait`));
    assert.match(advanced, /a planned tag is not an\s+installable ref/);
    assert.match(advanced, new RegExp(`${name}-latest`));
    assert.match(advanced, new RegExp(`com\\.github\\.copilot/extensions/${name}`));
    assert.match(advanced, /canvas only|only the canvas extension/i);
    assert.match(advanced, /microsoft\/azure-dev-tools/);
  }
});

for (const skill of [
  "azure-functions-hosted-skills-canvas",
  "azure-functions-hosted-skills-github-daily-digest",
]) {
  test(`${skill} recovery does not pin the unpublished 0.5.3 release`, () => {
    const path = `canvases/azure-functions-hosted-skills/skills/${skill}/SKILL.md`;
    const content = readFileSync(new URL(path, root), "utf8");
    assert.ok(!/(?:version\s+0\.5\.3|azure-functions-hosted-skills-v0-5-3-)/.test(content),
      `${path}: recovery must not depend on the unpublished 0.5.3 release`);
  });
}

test("Resources recovery does not claim a released package is still a candidate", () => {
  const path = "canvases/azure-resources-query/skills/azure-resources-query/SKILL.md";
  const content = readFileSync(new URL(path, root), "utf8");
  assert.ok(!/this is a packaged candidate,\s+not a publicly released marketplace install/i.test(content),
    `${path}: recovery must not claim a released package is still a candidate`);
});

test("new canvas patch tags retain production support documentation", () => {
  for (const [name, version] of [
    ["azure-functions-hosted-skills", "0-5-2"],
    ["azure-resources-query", "0-1-2"],
  ]) {
    const tags = execFileSync("git", ["tag", "-l", `${name}-v${version}-*`], {
      cwd: root,
      encoding: "utf8",
    }).trim().split("\n").filter(Boolean);
    if (!tags.length) continue;
    assert.equal(tags.length, 1, `${name}: one new immutable tag required`);
    const taggedDoc = execFileSync("git", [
      "show", `${tags[0]}:docs/azure-resources-query/README.md`,
    ], { cwd: root, encoding: "utf8" });
    assert.match(taggedDoc, /microsoft\/azure-dev-tools/);
    assert.doesNotMatch(taggedDoc, /\bAzure\/azure-dev-tools\b/i);
  }
});
