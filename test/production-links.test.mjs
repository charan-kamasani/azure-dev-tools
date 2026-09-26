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

test("production catalog matches installable plugins in order and leaves planned entry unlinked", () => {
  const readme = readFileSync(new URL("README.md", root), "utf8");
  const rows = readme.split("\n").filter((line) => line.startsWith("| ["));
  const products = {
    "azure-functions-hosted-skills": ["Azure Functions Hosted Skills", "canvases/azure-functions-hosted-skills/"],
    "azure-resources-query": ["Azure Resources Query", "canvases/azure-resources-query/"],
    "canvas-authoring": ["Canvas Authoring", "plugins/canvas-authoring/"],
    "azure-cost-health-check": ["Azure Cost Health Check", "canvases/azure-cost-health-check/"],
  };
  assert.equal(rows.length, manifest.plugins.length);
  for (const [index, { name, version }] of manifest.plugins.entries()) {
    const [label, path] = products[name];
    assert.ok(rows[index].startsWith(`| [${label}](${path}) |`), `catalog order: ${label}`);
    assert.ok(existsSync(new URL(path, root)), `${label}: missing package`);
    assert.ok(rows[index].includes(version), `${label}: current catalog version`);
  }
  assert.match(rows[2], /Skill-only plugin, with no canvas panel/);
  assert.match(readme, /Azure SRE Agent is not distributed from this production marketplace/);
  assert.doesNotMatch(readme, /\[Azure SRE Agent\]/);
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
  assert.match(readme, /Build and run a local Hosted Skill/);
  for (const heading of ["Install", "Prerequisites", "First local run", "Invoke an existing Azure Function App", "Troubleshooting", "Safety and authentication"]) {
    assert.ok(readme.includes(`## ${heading}\n`), `Hosted guide missing ${heading}`);
  }
  assert.match(readme, /copilot plugin install azure-functions-hosted-skills@azure-dev-tools/);
  assert.match(readme, /azure-functions-hosted-skills-canvas/);
  assert.match(readme, /azure-functions-hosted-skills-github-daily-digest/);
  assert.match(readme, /https:\/\/github\.com\/microsoft\/azure-dev-tools\/tree\/azure-functions-hosted-skills-latest\/canvases\/azure-functions-hosted-skills\/extensions\/azure-functions-hosted-skills/);
  assert.match(readme, /https:\/\/github\.com\/microsoft\/azure-dev-tools\/blob\/azure-functions-hosted-skills-latest\/canvases\/azure-functions-hosted-skills\/README\.md/);
  assert.match(readme, /^Open Azure Functions Hosted Skills canvas$/m);
  assert.match(readme, /^1\. Select \*\*Local Function App\*\*/m);
  assert.match(readme, /^1\. Select \*\*Azure Function App\*\*/m);
  assert.match(readme, /This installs the canvas only, not the/);
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
