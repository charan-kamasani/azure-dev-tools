# Install Azure canvas plugins

## Full-plugin install (primary)

Once this repository's marketplace is approved and published, in GitHub
Copilot App open **Customize → Plugins**, use the gear beside the marketplace
dropdown to add `microsoft/azure-dev-tools`, then select the
`azure-dev-tools` marketplace. Install `azure-functions-hosted-skills`,
`azure-resources-query`, `canvas-authoring`, or `azure-cost-health-check`
separately **after each product's release gates pass**. Access to this
repository is required.
Restart Copilot and verify the installed skills; open a canvas for the Hosted,
Resources Query, or Cost Health products only. Installation does not
automatically display a panel: ask Copilot **"Open Azure Resources Query"**,
**"Open Azure Functions Hosted Skills"**, or **"Open Azure Cost Health Check
in real mode for my subscription"**. The builder entry is skill-only: use
the host's native `create-canvas` workflow instead of expecting a builder canvas.
[GitHub's App guide](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app#adding-plugins)
documents the registration workflow, but **this marketplace's App install has
not yet been verified**.

The equivalent full-plugin CLI commands, after marketplace publication, are:

```shell
copilot plugin marketplace add microsoft/azure-dev-tools
copilot plugin marketplace browse azure-dev-tools
copilot plugin install azure-functions-hosted-skills@azure-dev-tools
copilot plugin install azure-resources-query@azure-dev-tools
copilot plugin install canvas-authoring@azure-dev-tools
copilot plugin install azure-cost-health-check@azure-dev-tools
copilot plugin list
copilot skill list
```

Use this repository's [production package catalog](../README.md) or a
published source-qualified production tag when following install instructions.
Hosted Skills 0.5.5 and Azure Resources Query 0.1.5 are **review candidates**;
their planned immutable tags and the `-latest` extension URLs in the package
READMEs are not installation targets for these versions until the production
PR merges and both tags are published. The previous 0.5.2/0.1.2 tags remain
available; the intervening 0.5.3/0.1.3 candidates were never tagged. The older immutable
0.5.1/0.1.1 canvas package READMEs retain public
source-distribution links, **not** this repository's
production installation target. Native App installation from this
marketplace has not yet been verified.

Cost Health 0.4.3 was exported from
the exact [merged source main revision](https://github.com/coreai-microsoft/canvases-cloud-foundation/commit/b3551729b5d1e6377283efd1a012fa523e0c8aac)
as `azure-cost-health-check`, not the obsolete `-v3` identity. Its protected
`checksums.json` digest is
`7fae84cfdc0612410dd870104f373193a05bf03278d2ad9af90025d44e88e812`;
the private 32-file protected `SHA256SUMS` digest is
`4053ea1aa490e2c43893a7dfa5dcad8d36e22801b99cda7dbb7c33517e0fef49`.
The package includes its `com.github.copilot/extensions/azure-cost-health-check`
extension, launcher skill, protected `assets/preview.png`, third-party notices,
and mutable `docs/azure-cost-health-check.png` customer screenshot. Its customer
README's conditional `-latest` URL is usable only after a private reviewed
merge and release-tag publication. The source's merged-main
`canvases/azure-cost-health-check/test/import.test.mjs:17` still expects an
obsolete nested extension path (one source test fails); this is disclosed,
not evidence of a failed packaged plugin. The exact merged-main package passed
source `verify:canvas` and isolated offline packaged-browser acceptance.
This private package uses the same repository license and bundled vendor-notice
model as the other marketplace products; the source repository's separate
public-disclosure staging workflow is not part of this release. Private
pre-tag qualification uses local-only synthetic tags; native App installation
remains unverified.

## Build canvas apps

`canvas-authoring` at `plugins/canvas-authoring/plugin.json` is **skill-only**:
it contains one `create-canvas-app` companion skill and no extension or
canvas. It supplies toolkit setup and counter or read-only Azure resource-group
starters to a canvas-capable GitHub Copilot host that **already provides the
native `create-canvas` skill**. It neither replaces that skill nor installs a
running app. Follow the [builder README](../plugins/canvas-authoring/README.md)
after its source-qualified production patch tag is published. A compatible
published `@microsoft/canvas-toolkit` with `@microsoft/canvas-toolkit/build`
is also required. Canonical npmjs.org publishes `0.1.0-preview.2` with that
export; corporate npm mirrors may not yet serve it. The earlier `0.1.0-preview.1`
lacks `/build`. Do not treat a successful plugin install as proof that an app
can build or that native activation was verified.

## Production release gate

The current Hosted Skills 0.5.5 and Azure Resources Query 0.1.5 candidates
were built from [reviewed source main
`bf89cc8f67bf15d7fb538336c5482818b4bb5b01`](https://github.com/coreai-microsoft/canvases-cloud-foundation/commit/bf89cc8f67bf15d7fb538336c5482818b4bb5b01)
with `npm run package:plugin -- --repository=microsoft/azure-dev-tools <product>`.
Their generated customer READMEs and all other emitted package files are
byte-identical to that build. The production package adds only a protected-file
`SHA256SUMS` receipt: [Hosted's 48-entry receipt](../canvases/azure-functions-hosted-skills/SHA256SUMS)
has SHA-256 `01cba2ec84a3599fd6ebc143a2c2679fd90b81f7ad945036eddadede231ed2a8`;
[Resources' 97-entry receipt](../canvases/azure-resources-query/SHA256SUMS)
has SHA-256 `92ff2b34f3ee4aa4a4d25ef5aa17eff4410720555b4af58d044340678668ea8d`.
Their protected `checksums.json` digests are respectively
`2dc198ffa482973c772723e161db8bc5d76e1988f11d1c9480495ad90d7cad4f`
and `e9a448a794d025d2dc48e3234c957293287af7adfd49a7f1ffe82b4de8e1e881`.
The source-qualified `azure-functions-hosted-skills-v0-5-5-bf89cc8` and
`azure-resources-query-v0-1-5-bf89cc8` tags are planned, not published.
Strict verification requires real tags after approval
and the production squash merge.

For historical context, the earlier Hosted Skills 0.5.3 and Azure Resources
Query 0.1.3 candidates were built
from [merged source revision b3551729b5d1e6377283efd1a012fa523e0c8aac](https://github.com/coreai-microsoft/canvases-cloud-foundation/commit/b3551729b5d1e6377283efd1a012fa523e0c8aac)
with `npm run package:plugin -- --repository=microsoft/azure-dev-tools <product>`
in a clean detached checkout. The generated Agent Plugins manifests use
`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, preview images
at `assets/preview.png`, and executable extensions under
`com.github.copilot/extensions/<product>/extension.mjs`. Hosted's
[49-file receipt](https://github.com/microsoft/azure-dev-tools/blob/a873dfa42ce8e4420b77e94ddca896e8771e3b0c/canvases/azure-functions-hosted-skills/SHA256SUMS) has
SHA-256 `264259ca3530ffeeb97bd52fd704ee3767a563eb5c71a0d0e806200cd80225ad`.
Hosted retains the previously released complete customer guide as a
**disclosed README-only documentation overlay**, updated for version 0.5.3
and the namespaced extension URL. Its source-generated README digest is
`55e3be5146879f63e9a208281ce117111ae147c21adefb5eb3f6dbb61b689c82`;
the private README digest is
`01062e9307049145b615e07304f023924f391fa967592d77a19908e8a54232ed`.
The corresponding `checksums.json` digest changes from source
`3cfc3da3519f0bd7e0b33f00dca885a62c8eb7f1e1797ee0790b245bd50970fc`
to private `7ac6a3d8b24083b656066ad3561ff1a485ad7fde2e9b177d9d6c289fe17d97ef`.
All other 47 source-generated Hosted files, including extension runtime,
skills, preview, notices, release metadata and manifest, remain byte-identical;
the private package adds only its in-package `SHA256SUMS`.
ARG's [99-file receipt](https://github.com/microsoft/azure-dev-tools/blob/a873dfa42ce8e4420b77e94ddca896e8771e3b0c/canvases/azure-resources-query/SHA256SUMS) has
SHA-256 `e33be5430a138e6005781c24153e9e434f311b44ebfd1c219ae242e0079ac05b`.
Run `node scripts/verify-plugin-marketplace.mjs --candidate` on a committed
candidate: it verifies the new manifests, complete file receipts, release
inventories, and all historical release tags without inventing new tags.
Without `--candidate`, verification requires the two new immutable tags to
point to the same reviewed merge descending from the Cost Health release.
Neither the candidate command nor a clean build authorizes publication.

The canvas patches come from independently reviewed source export merge
`8af10f8408f69f45fb5137e9b8f5d746f40bc85e`
(reviewed head `cf1776327462b2ca41cec5bfe269ef9d5155df96`;
their Git trees match). Hosted 0.5.2 retains the complete previously
released customer guide as a **private documentation-only overlay**: the
approved source export's shortened README digest was
`ef2bdf45b64844b7e5b25f87576dc783112a5e83d4be0225e55cb3fefcc68bb3`,
while the production README digest is
`1c948c7ea052b7756ed42c1f04781e05dfa331b4dc8b5f694c16704ae0434d5c`.
Only `README.md` and `checksums.json` differ among the approved 48 Hosted
export files; the production package also includes a new in-package
`SHA256SUMS`. The runtime, manifest, skills and templates remain
source-identical. The original source receipt
digest was `7bc1f9cd96bee2b06ccb4b91d145f953b4909309a707a3ed966b35bc5852f7e1`;
the 48-file production receipt digest is
`390ed2a003358a9e9125ec7bf593abaae87e3ff13207a298881b8e997ca76873`.
ARG's 98-file production receipt digest is
`789c6e79c18ebbb988af24b97b63d8ced12267c62623c460a4bc822d0fea68cb`;
the builder's 26-file patch receipt digest is
`d66a82894955dcac9ea072143524c718ea49728d3c947224acdb5fa30fe63c02`.

The original separately reviewed builder came from approved source merge
`23aa6b19a50aca470c759f04f5c657481f6e2d6a` (export receipt
`332cafd2605df299bd4159655b746baeb75a3e7e0392d473e2bae3d2d5c6a7ab`);
the production builder retains 22/26 source files byte-for-byte. Its four
disclosed documentation/provenance overlays are
`plugins/canvas-authoring/README.md` (release hold and toolkit version),
`skills/create-canvas-app/references/toolkit/README.md` (toolkit pin),
`skills/create-canvas-app/references/toolkit/provenance.json` (matching
README checksum), and `skills/create-canvas-app/references/toolkit/quickstart.md`
(release hold and toolkit version), with the latter three paths relative to
`plugins/canvas-authoring/`. The original product PRs and marketplace
catalog are merged and their immutable tags published. That historical patch release
replaced the obsolete builder release hold and corrected the canvas packages'
production install destinations using separately reviewed source exports
plus the disclosed Hosted customer-guide overlay;
its three immutable tags were published only after merge. Each
builder version's 26 plugin bytes have their own pinned receipt in
`docs/canvas-authoring/SHA256SUMS`. Native marketplace/App installation
remains unverified. The test fixture in
`test/fixtures/marketplace.candidate.json` exercises the marketplace candidate shape,
not an installation catalog.

Entries use same-repository `canvases/<product>` or
`plugins/canvas-authoring` paths. This is a **mutable marketplace channel**,
not an immutable pin: later marketplace checkouts follow the then-current
production default branch, and `version` is display metadata. Run
`node --test test/plugin-marketplace.test.mjs` and
`node scripts/verify-plugin-marketplace.mjs`. The validator
requires one source-qualified immutable version tag per product, checks
each tag's source fragment against its independently reviewed full source
SHA, and checks HEAD's protected package files against its tag. The three patch
tags must share the same approved hotfix merge commit, descending from the
original builder release. The original two canvas tags must still identify
the original #6 commit and the original builder tag must still identify its
separate #7 descendant commit.
The canvas checks require their extension (including Cost Health's
`com.github.copilot/extensions/azure-cost-health-check` Agent Plugins layout)
and every companion skill
(including both Hosted Skills skills). The builder check requires one skill,
no extension/canvas, and all 26 files matching its pinned production checksum
receipt. Build-input provenance and the documented safety overlays
remain separate release PR review facts; a source-qualified tag name alone
does not prove the build's origin.
**The default validator fails closed without real production release
tags.** Pre-tag tests with temporary *local-only* tags in a disposable
clone are synthetic candidate qualification, not release verification; never
push those refs or present the result as a published install.

After publication, check the actual GitHub-hosted marketplace with fresh, isolated
`HOME`, `COPILOT_HOME`, and `COPILOT_CACHE_HOME` directories. Confirm that each
installed canvas plugin contains its `extensions/<product>` directory and
declared skills; the builder must contain only its companion skill, **not**
an extension. Compare installed package bytes to the reviewed immutable
tag; an `install` success message alone is insufficient. In CLI 1.0.84-5, a
local-directory marketplace with a remote SHA-pinned plugin source can report
success while leaving no plugin or skill installed. Do not use a personal
profile for smoke tests or mistake that local test for remote App verification.

## Fallbacks

For a reproducible full-plugin CLI install, check out the exact published
source-qualified production version tag in `microsoft/azure-dev-tools` and
install its local `./canvases/<product>` or `./plugins/canvas-authoring`
directory with `copilot plugin install`. Older immutable 0.5.1/0.1.1 package
READMEs retain public source-repository links; use the corrected private
patch READMEs instead.
Direct CLI installs currently warn that this form may be deprecated in a
future release.
The separate App **Customize → Canvases → Install from gist/URL** path is a
canvas-only fallback for the first two products: it installs an extension,
not its plugin skills, and cannot install the builder.
