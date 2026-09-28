import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, posix, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = {
  "azure-functions-hosted-skills": {
    path: "canvases/azure-functions-hosted-skills",
    manifest: ".github/plugin/plugin.json",
    skills: [
      "./skills/azure-functions-hosted-skills-canvas/",
      "./skills/azure-functions-hosted-skills-github-daily-digest/",
    ],
    extension: "azure-functions-hosted-skills",
    extensionPath: "com.github.copilot/extensions/azure-functions-hosted-skills",
    receipt: "canvases/azure-functions-hosted-skills/SHA256SUMS",
  },
  "azure-resources-query": {
    path: "canvases/azure-resources-query",
    manifest: ".github/plugin/plugin.json",
    skills: ["./skills/azure-resources-query/"],
    extension: "azure-resources-query",
    extensionPath: "com.github.copilot/extensions/azure-resources-query",
    receipt: "canvases/azure-resources-query/SHA256SUMS",
  },
  "canvas-authoring": {
    path: "plugins/canvas-authoring",
    manifest: "plugin.json",
    skills: ["./skills/create-canvas-app/"],
    receipt: "docs/canvas-authoring/SHA256SUMS",
  },
  "azure-cost-health-check": {
    path: "canvases/azure-cost-health-check",
    manifest: ".github/plugin/plugin.json",
    skills: ["./skills/azure-cost-health-check/"],
    extension: "azure-cost-health-check",
    extensionPath: "com.github.copilot/extensions/azure-cost-health-check",
    receipt: "canvases/azure-cost-health-check/SHA256SUMS",
    mutableDocumentation: true,
  },
  "azure-sre-agent": {
    path: "canvases/azure-sre-agent",
    manifest: ".github/plugin/plugin.json",
    skills: ["./skills/azure-sre-agent-canvas/"],
    extension: "azure-sre-agent",
    extensionPath: "com.github.copilot/extensions/azure-sre-agent",
    receipt: "canvases/azure-sre-agent/SHA256SUMS",
  },
};
const combinedPatchProducts = [
  "azure-functions-hosted-skills",
  "azure-resources-query",
  "canvas-authoring",
];
const combinedPatchCommit = "a6d394bbaa6fb1dc0151257a85cbac0de772b138";
const pairedCanvasProducts = ["azure-functions-hosted-skills", "azure-resources-query"];
const products = Object.keys(packages);
const previousTags = {
  "azure-functions-hosted-skills-v0-5-1-2bb8354": "cc59516eba4d6eecda9ff7c9f0191fe2117167af",
  "azure-resources-query-v0-1-1-be9551d": "cc59516eba4d6eecda9ff7c9f0191fe2117167af",
  "canvas-authoring-v0-1-0-23aa6b1": "180136488727f011e8001321c29150a005f89fe0",
  "azure-functions-hosted-skills-v0-5-2-8af10f8": combinedPatchCommit,
  "azure-resources-query-v0-1-2-8af10f8": combinedPatchCommit,
  "canvas-authoring-v0-1-1-8af10f8": combinedPatchCommit,
  "azure-cost-health-check-v0-4-3-b355172": "59e5889e464b099344a8ba8ff13cdf73d401d433",
};

function git(...args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function requireFile(sha, path) {
  git("cat-file", "-e", `${sha}:${path}`);
}

function fileAt(sha, path) {
  return execFileSync("git", ["show", `${sha}:${path}`], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function packageFiles(sha, path) {
  return git("ls-tree", "-r", "--name-only", sha, "--", path)
    .split("\n").filter(Boolean).map((file) => file.slice(path.length + 1));
}

function packageTree(sha, path) {
  return git("ls-tree", "-r", "-z", sha, "--", path)
    .split("\0").filter(Boolean).map((entry) => {
      const match = /^(\d{6}) (blob|commit) ([0-9a-f]{40})\t(.+)$/.exec(entry);
      if (!match || !match[4].startsWith(`${path}/`)) {
        throw new Error(`invalid package tree entry: ${entry}`);
      }
      return { mode: match[1], oid: match[3], file: match[4].slice(path.length + 1) };
    });
}

function isSafePackagePath(file) {
  return typeof file === "string" && !file.startsWith("/") &&
    !/[\t\n\r\\]/.test(file) &&
    file.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

const documentExtensions = /\.(?:md|markdown|txt|rst|adoc|png|jpe?g|webp|gif|avif)$/i;
const noticeName = /(?:^|[\/._-])(?:notice|notices|licen[cs]e|copying|copyright|authors|attribution|patents|third.party)(?:[\/._-]|$)/i;
const executablePath = /\.(?:mjs|cjs|js|jsx|ts|tsx|css|html|json|wasm|node|sh|py|ps1)$/i;

function isInertReadmeName(name) {
  return /^README(?:[.\w-]*)?$/i.test(name) &&
    (name.toUpperCase() === "README" || /\.(?:md|markdown|txt|rst|adoc)$/i.test(name));
}

function isMutableDocument(file) {
  const segments = file.split("/");
  const name = segments.at(-1);
  const inDocDirectory = segments.length > 1 &&
    (segments[0].toLowerCase() === "doc" || segments[0].toLowerCase() === "docs");
  const isReadme = isInertReadmeName(name) &&
    !segments.slice(0, -1).some((segment, index) =>
      segment.toLowerCase() === "extensions" ||
      index > 0 && /^(?:doc|docs)$/i.test(segment));
  return (inDocDirectory || isReadme) && !noticeName.test(file);
}

function referencesMutableDocument(file, content) {
  const patterns = [
    /\b(?:import|export)\s+(?:[^;\n"'`]*?\bfrom\s*)?["'`]([^"'`]+)["'`]/g,
    /\b(?:import|require|readFileSync|readFile|createReadStream|fetch|new\s+URL)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /\]\(([^)\s#]+)(?:#[^)]*)?\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const target = match[1].replaceAll("\\", "/");
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      if (isMutableDocument(posix.normalize(posix.join(posix.dirname(file), target))) ||
          isMutableDocument(target)) return true;
    }
  }
  return false;
}

function verifyInertDocument(file, content) {
  const extension = file.slice(file.lastIndexOf(".")).toLowerCase();
  const header = {
    ".png": content.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
    ".jpg": content.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex")),
    ".jpeg": content.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex")),
    ".gif": /^GIF8[79]a/.test(content.toString("ascii", 0, 6)),
    ".webp": content.toString("ascii", 0, 4) === "RIFF" &&
      content.toString("ascii", 8, 12) === "WEBP",
    ".avif": /^ftyp(?:avif|avis)$/.test(content.toString("ascii", 4, 12)),
  };
  if (Object.hasOwn(header, extension) && !header[extension]) {
    throw new Error(`mutable documentation image is not a valid ${extension} file: ${file}`);
  }
  if (!Object.hasOwn(header, extension)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(content);
      if (text.includes("\0")) throw new Error("binary content");
    } catch {
      throw new Error(`mutable documentation is not inert UTF-8 text: ${file}`);
    }
  }
}

export function verifyMutableDocumentationTrees(current, tagged, readCurrent, readTagged) {
  const pinned = (tree, readFile) => {
    const files = new Map();
    for (const entry of tree) {
      if (files.has(entry.file) || !isSafePackagePath(entry.file) ||
          entry.mode !== "100644" && entry.mode !== "100755") {
        throw new Error(`unsafe package file or mode: ${entry.file}`);
      }
      files.set(entry.file, entry);
      const docPath = /^docs?\//i.test(entry.file) || /(^|\/)README/i.test(entry.file);
      const protectedReadme = !/^docs?\//i.test(entry.file) &&
        isInertReadmeName(entry.file.split("/").at(-1));
      if (docPath && !isMutableDocument(entry.file) && !protectedReadme) {
        throw new Error(`executable or legal content cannot hide in mutable documentation: ${entry.file}`);
      }
      if (isMutableDocument(entry.file)) {
        if (entry.mode !== "100644" || !documentExtensions.test(entry.file) &&
            !/^README$/i.test(entry.file)) {
          throw new Error(`unsafe mutable documentation file: ${entry.file}`);
        }
        verifyInertDocument(entry.file, readFile(entry.file));
      }
    }
    for (const entry of tree) {
      if (!isMutableDocument(entry.file) &&
          (executablePath.test(entry.file) || /^skills\/.*\/SKILL\.md$/.test(entry.file)) &&
          /^(?:extensions|skills)\//.test(entry.file) &&
          referencesMutableDocument(entry.file, readFile(entry.file).toString("utf8"))) {
        throw new Error(`runtime or skill references mutable documentation: ${entry.file}`);
      }
    }
    return files;
  };
  const currentFiles = pinned(current, readCurrent);
  const taggedFiles = pinned(tagged, readTagged);
  const immutableFiles = [...currentFiles.keys()].filter((file) =>
    file !== "SHA256SUMS" && !isMutableDocument(file));
  const taggedImmutableFiles = [...taggedFiles.keys()].filter((file) =>
    file !== "SHA256SUMS" && !isMutableDocument(file));
  if (immutableFiles.length !== taggedImmutableFiles.length ||
      immutableFiles.some((file) => {
        const now = currentFiles.get(file);
        const atTag = taggedFiles.get(file);
        return !atTag || now.mode !== atTag.mode || now.oid !== atTag.oid;
      })) {
    throw new Error("immutable package files differ from the reviewed release tag");
  }
  return immutableFiles;
}

export function verifyRuntimeInventory(release) {
  for (const field of ["modules", "assets"]) {
    if (release[field] === undefined) continue;
    if (!Array.isArray(release[field]) || release[field].some((entry) =>
      !entry || typeof entry.file !== "string" ||
      isMutableDocument(entry.file) || /^docs?\//i.test(entry.file))) {
      throw new Error(`runtime ${field} cannot depend on mutable documentation`);
    }
  }
}

export function verifyMutableReleaseMetadata(release, checksums, immutableFiles, readFile) {
  const payload = immutableFiles.filter((file) =>
    file !== "release.json" && file !== "checksums.json");
  const expectedChecksums = [...payload, "release.json"];
  if (release.schemaVersion !== 2 || release.mutableDocumentation !== true ||
      release.readmeAssets !== undefined ||
      !Array.isArray(release.files) ||
      release.files.length !== payload.length ||
      new Set(release.files).size !== payload.length ||
      release.files.some((file) => !payload.includes(file)) ||
      Object.keys(checksums).length !== expectedChecksums.length ||
      expectedChecksums.some((file) => !Object.hasOwn(checksums, file)) ||
      !immutableFiles.some((file) => file.startsWith("notices/"))) {
    throw new Error("mutable-document release metadata must enumerate only protected payload and notices");
  }
  verifyRuntimeInventory(release);
  for (const file of expectedChecksums) {
    const digest = createHash("sha256").update(readFile(file)).digest("hex");
    if (checksums[file] !== digest) {
      throw new Error(`protected release checksum differs: ${file}`);
    }
  }
}

function releaseTagFor(name, version, { allowMissing = false } = {}) {
  const tags = git("tag", "-l", `${name}-v${version.replaceAll(".", "-")}-*`)
    .split("\n").filter(Boolean);
  if (allowMissing && tags.length === 0) return null;
  if (tags.length !== 1) {
    throw new Error(`${name}@${version}: expected exactly one reviewed immutable release tag`);
  }
  return tags[0];
}

export function verifyCombinedReleaseCommits(commits) {
  if (commits.length !== combinedPatchProducts.length || new Set(commits).size !== 1) {
    throw new Error("Combined patch release tags must point to the same reviewed production merge commit");
  }
  if (commits[0] !== combinedPatchCommit) {
    throw new Error("Combined patch immutable release tags moved from their reviewed commit");
  }
}

export function verifySubsequentReleaseCommit(previousCommit, releaseCommit) {
  if (previousCommit === releaseCommit) {
    throw new Error("Subsequent product release must have its own reviewed merge commit");
  }
  try {
    git("merge-base", "--is-ancestor", previousCommit, releaseCommit);
  } catch {
    throw new Error("Subsequent product release must descend from the prior production release");
  }
  try {
    git("merge-base", "--is-ancestor", releaseCommit, "HEAD");
  } catch {
    throw new Error("Refresh this branch onto the reviewed subsequent product release commit");
  }
}

export function verifyReceiptPath({ receipt }) {
  if (!isSafePackagePath(receipt)) {
    throw new Error("Every product requires a fixed repository-relative checksum receipt");
  }
}

export function verifyPreviousReleaseCommits(commits) {
  if (Object.keys(commits).length !== Object.keys(previousTags).length ||
      Object.entries(previousTags).some(([tag, expected]) => commits[tag] !== expected)) {
    throw new Error("Prior immutable release tags moved or are missing");
  }
}

export function verifyMarketplace(manifest, { candidate = false } = {}) {
  if (!manifest.name || !/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
    throw new Error("Marketplace must have a kebab-case name");
  }
  if (manifest.owner?.name !== "Microsoft" || !Array.isArray(manifest.plugins)) {
    throw new Error("Marketplace must have the Microsoft owner and a plugins array");
  }
  const names = manifest.plugins.map(({ name }) => name);
  if (names.length !== products.length || new Set(names).size !== products.length ||
      products.some((name) => !names.includes(name))) {
    throw new Error("Marketplace must contain exactly the reviewed production products");
  }
  const results = manifest.plugins.map((plugin) => verifyPlugin(plugin, { candidate }));
  if (manifest.name === "azure-dev-tools") {
    const commits = combinedPatchProducts.map((name) =>
      git("rev-parse", `${name}-v${previousVersion(name)}-8af10f8^{commit}`));
    verifyCombinedReleaseCommits(commits);
    verifyPreviousReleaseCommits(Object.fromEntries(Object.keys(previousTags).map((tag) =>
      [tag, git("rev-parse", `${tag}^{commit}`)])));
    try {
      git("merge-base", "--is-ancestor", previousTags["canvas-authoring-v0-1-0-23aa6b1"], commits[0]);
    } catch {
      throw new Error("Combined patch release must descend from the prior builder release commit");
    }
    try {
      git("merge-base", "--is-ancestor", commits[0], "HEAD");
    } catch {
      throw new Error("Refresh this branch onto the reviewed combined patch release commit");
    }
    const costCommit = git("rev-parse", "azure-cost-health-check-v0-4-3-b355172^{commit}");
    verifySubsequentReleaseCommit(commits[0], costCommit);
    const pairedTags = pairedCanvasProducts.map((name) =>
      releaseTagFor(name, marketplaceVersion(manifest, name), { allowMissing: candidate }));
    if (pairedTags.some(Boolean) && !pairedTags.every(Boolean)) {
      throw new Error("Paired canvas releases must both be candidates or both have immutable tags");
    }
    const pairedCommits = pairedTags.every(Boolean)
      ? pairedTags.map((tag) => git("rev-parse", `${tag}^{commit}`))
      : [];
    if (pairedCommits.length) {
      const canvasCommits = pairedCommits;
      if (new Set(canvasCommits).size !== 1) {
        throw new Error("New canvas release tags must point to the same reviewed merge commit");
      }
      verifySubsequentReleaseCommit(costCommit, canvasCommits[0]);
    }
    const currentCostTag = releaseTagFor(
      "azure-cost-health-check",
      marketplaceVersion(manifest, "azure-cost-health-check"),
      { allowMissing: candidate },
    );
    if (currentCostTag) {
      if (!pairedCommits.length) {
        throw new Error("Cost Health cannot be published before the paired canvas releases");
      }
      verifySubsequentReleaseCommit(
        pairedCommits[0],
        git("rev-parse", `${currentCostTag}^{commit}`),
      );
    } else if (pairedCommits.length) {
      verifySubsequentReleaseCommit(pairedCommits[0], "HEAD");
    }
  }
  return results;
}

function previousVersion(name) {
  return {
    "azure-functions-hosted-skills": "0-5-2",
    "azure-resources-query": "0-1-2",
    "canvas-authoring": "0-1-1",
  }[name];
}

function marketplaceVersion(manifest, name) {
  return manifest.plugins.find((plugin) => plugin.name === name).version;
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const parts = match?.slice(1).map(Number);
  return parts?.every(Number.isSafeInteger) ? parts : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function latestHistoricalVersion(name) {
  return Object.keys(previousTags).reduce((latest, tag) => {
    const match = new RegExp(
      `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-v(\\d+)-(\\d+)-(\\d+)-[0-9a-f]+$`,
    ).exec(tag);
    if (!match) return latest;
    const version = match.slice(1).map(Number);
    return !latest || compareVersions(version, latest) > 0 ? version : latest;
  }, null);
}

export function verifyCurrentVersion(name, version) {
  const current = parseVersion(version);
  const historical = packages[name] && latestHistoricalVersion(name);
  if (!current || !packages[name]) {
    throw new Error(`${name}@${version}: expected a reviewed product and semantic version`);
  }
  if (historical && compareVersions(current, historical) < 0) {
    throw new Error(`${name}@${version}: current version must not precede the latest immutable release`);
  }
}

export function verifyTagSource(name, version, tag) {
  verifyCurrentVersion(name, version);
  const base = `${name}-v${version.replaceAll(".", "-")}-`;
  const suffix = tag.startsWith(base) ? tag.slice(base.length) : "";
  if (!/^[0-9a-f]{7,40}$/.test(suffix)) {
    throw new Error(`${name}@${version}: tag does not identify a source commit`);
  }
}

export function verifyPlugin({ source, name, version }, { candidate = false } = {}) {
  const product = packages[name];
  verifyCurrentVersion(name, version);
  verifyReceiptPath(product);
  const path = product.path;
  if (source !== path) {
    throw new Error(`${name}: source must use its own repo-relative path`);
  }
  const releaseTag = releaseTagFor(name, version, { allowMissing: candidate });
  if (releaseTag) verifyTagSource(name, version, releaseTag);
  const revision = "HEAD";

  try {
    const packageManifest = JSON.parse(fileAt(revision, `${path}/${product.manifest}`));
    if (packageManifest.name !== name || packageManifest.version !== version) {
      throw new Error("plugin metadata differs from marketplace entry");
    }
    const files = packageFiles(revision, path);
    const immutableFiles = verifyMutableDocumentationTrees(
      packageTree(revision, path),
      packageTree(releaseTag ?? revision, path),
      (file) => fileAt(revision, `${path}/${file}`),
      (file) => fileAt(releaseTag ?? revision, `${path}/${file}`),
    );
    if (files.includes("release.json")) {
      verifyRuntimeInventory(JSON.parse(fileAt(releaseTag ?? revision, `${path}/release.json`)));
    }
    if (product.extensionPath) {
      const release = JSON.parse(fileAt(revision, `${path}/release.json`));
      const checksums = JSON.parse(fileAt(revision, `${path}/checksums.json`));
      if (product.mutableDocumentation) {
        verifyMutableReleaseMetadata(release, checksums, immutableFiles,
          (file) => fileAt(revision, `${path}/${file}`));
      } else {
        const payload = files.filter((file) =>
          file !== "release.json" && file !== "checksums.json" && file !== "SHA256SUMS");
        const protectedPayload = payload.filter((file) => !isMutableDocument(file));
        const expected = [...release.files, "release.json"];
        if (release.schemaVersion !== 1 || release.format !== "plugin" ||
            release.publicationRepository !== "microsoft/azure-dev-tools" ||
            !Array.isArray(release.files) ||
            new Set(release.files).size !== release.files.length ||
            release.files.some((file) => !isSafePackagePath(file)) ||
            protectedPayload.some((file) => !release.files.includes(file)) ||
            release.files.some((file) => !payload.includes(file) && !isMutableDocument(file)) ||
            Object.keys(checksums).length !== expected.length ||
            expected.some((file) => !Object.hasOwn(checksums, file)) ||
            [...protectedPayload, "release.json"].some((file) => checksums[file] !==
              createHash("sha256").update(fileAt(revision, `${path}/${file}`)).digest("hex"))) {
          throw new Error("Agent Plugins release inventory or checksums differ from package files");
        }
      }
      const packageJson = JSON.parse(fileAt(revision, `${path}/package.json`));
      if (release.name !== name || release.version !== version ||
          release.plugin?.manifest !== product.manifest ||
          release.plugin?.extension?.entry !== `${product.extensionPath}/extension.mjs` ||
          release.plugin?.extension?.canvasId !== product.extension ||
          release.plugin?.preview?.file !== "assets/preview.png" ||
          packageJson.name !== name || packageJson.version !== version ||
          packageJson.main !== `${product.extensionPath}/extension.mjs`) {
        throw new Error("protected release identity or extension layout differs from marketplace entry");
      }
    }
    if (product.extension) {
      requireFile(revision, `${path}/${product.extensionPath ?? `extensions/${product.extension}`}/extension.mjs`);
      if (product.extensionPath) {
        if (packageManifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json" ||
          packageManifest.extensions?.["com.github.copilot"]?.logo !== "assets/preview.png" ||
          Object.keys(packageManifest.extensions).length !== 1 ||
          !files.includes("assets/preview.png")) {
          throw new Error("Agent Plugins extension metadata differs from marketplace entry");
        }
      } else if (packageManifest.extensions !== "./extensions") {
        throw new Error("extension metadata differs from marketplace entry");
      }
      if (!Array.isArray(packageManifest.skills) ||
          packageManifest.skills.length !== product.skills.length ||
          product.skills.some((skill) => !packageManifest.skills.includes(skill))) {
        throw new Error("skills differ from marketplace entry");
      }
    } else if (Object.hasOwn(packageManifest, "extensions") ||
               Object.hasOwn(packageManifest, "canvases") ||
               files.some((file) => /^(extensions|canvases)\//.test(file)) ||
               files.filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file)).length !== 1 ||
               (packageManifest.skills !== undefined &&
                (!Array.isArray(packageManifest.skills) ||
                 packageManifest.skills.length !== 1 ||
                 packageManifest.skills[0] !== product.skills[0]))) {
      throw new Error("builder must contain one skill and no extension or canvas");
    }
    for (const skill of product.skills) {
      if (!/^\.\/skills\/[a-z0-9-]+\/$/.test(skill)) {
        throw new Error(`invalid skill path: ${skill}`);
      }
      requireFile(revision, `${path}/${skill.slice(2)}SKILL.md`);
    }
    const receipt = fileAt(revision, product.receipt);
    if (releaseTag && !receipt.equals(fileAt(releaseTag, product.receipt))) {
      throw new Error("current checksum receipt differs from immutable release tag");
    }
    const entries = receipt.toString("utf8").trimEnd().split("\n").map((line) => {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
      if (!match) throw new Error(`invalid checksum receipt entry: ${line}`);
      if (!match[2].startsWith(product.receiptPrefix ?? "")) {
        throw new Error(`invalid checksum receipt path: ${match[2]}`);
      }
      const file = match[2].slice((product.receiptPrefix ?? "").length);
      if (!isSafePackagePath(file)) {
        throw new Error(`invalid checksum receipt path: ${match[2]}`);
      }
      return { hash: match[1], file };
    });
    const expectedFiles = immutableFiles;
    const entryFiles = entries.map(({ file }) => file);
    if (new Set(entryFiles).size !== entries.length ||
        expectedFiles.some((file) => !entryFiles.includes(file)) ||
        entries.some(({ file }) => !expectedFiles.includes(file) && !isMutableDocument(file))) {
      throw new Error(`checksum receipt must cover every protected plugin file exactly once`);
    }
    for (const { hash, file } of entries) {
      if (isMutableDocument(file)) continue;
      const fileRevision = product.mutableDocumentation ? revision : releaseTag ?? revision;
      if (createHash("sha256").update(fileAt(fileRevision, `${path}/${file}`)).digest("hex") !== hash) {
        throw new Error(`plugin file differs from checksum receipt: ${file}`);
      }
    }
  } catch (error) {
    throw new Error(`${name}@${version} (${revision}): ${error.message}`, { cause: error });
  }
  return `${name}@${version} ${releaseTag ?? "(candidate; immutable tag pending)"}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const candidate = process.argv.includes("--candidate");
  const path = resolve(process.argv.slice(2).find((arg) => arg !== "--candidate") ??
    ".github/plugin/marketplace.json");
  try {
    for (const result of verifyMarketplace(
      JSON.parse(readFileSync(path, "utf8")), { candidate })) {
      console.log(result);
    }
  } catch (error) {
    console.error(`Marketplace verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
