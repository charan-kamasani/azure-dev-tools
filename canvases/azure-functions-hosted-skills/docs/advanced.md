# Azure Functions Hosted Skills: alternative installation and maintainer notes

## Install the full plugin

When the `microsoft/azure-dev-tools` marketplace lists Azure Functions Hosted
Skills, use GitHub Copilot **Customize → Plugins → marketplace gear → add
`microsoft/azure-dev-tools` (ID `azure-dev-tools`) → install Azure Functions
Hosted Skills**. This installs the canvas and both launcher skills. Fully quit
and reopen GitHub Copilot, start a fresh chat, and confirm both
`azure-functions-hosted-skills-canvas` and
`azure-functions-hosted-skills-github-daily-digest` are available.

After marketplace publication, the CLI equivalent is:

```sh
copilot plugin marketplace add microsoft/azure-dev-tools
copilot plugin install azure-functions-hosted-skills@azure-dev-tools
```

For an exact version (or if the marketplace is unavailable), choose a
published immutable tag from the
[tag list](https://github.com/microsoft/azure-dev-tools/tags) starting with
`azure-functions-hosted-skills-v`. Copy the complete name, including its
source qualifier, and paste it when prompted. For an exact 0.5.5 pin, wait
until its tag appears in that list; a planned tag is not an installable ref:

```sh
printf 'Paste the full versioned Azure Functions Hosted Skills tag: '
read -r HOSTED_SKILLS_TAG
git ls-remote --exit-code --refs --tags https://github.com/microsoft/azure-dev-tools.git "refs/tags/$HOSTED_SKILLS_TAG" >/dev/null || { printf 'Tag is not published in production\n' >&2; exit 1; }
git clone --depth 1 --branch "$HOSTED_SKILLS_TAG" https://github.com/microsoft/azure-dev-tools.git azure-functions-hosted-skills-plugin
copilot plugin install ./azure-functions-hosted-skills-plugin/canvases/azure-functions-hosted-skills
```

The marketplace follows main rather than an immutable source tag.

> **Canvas-only fallback:** If the full plugin is unavailable, use
> **Customize → Canvases → Install from gist/URL** with the nested
> `https://github.com/microsoft/azure-dev-tools/tree/azure-functions-hosted-skills-latest/canvases/azure-functions-hosted-skills/com.github.copilot/extensions/azure-functions-hosted-skills`
> URL. The `-latest` tag is movable. This installs the canvas only, not the
> routing or daily-digest launcher skills. New apps still receive the required
> `.funcignore` exclusions; unsafe deployment is refused.

The native host discovers
`com.github.copilot/extensions/azure-functions-hosted-skills/extension.mjs`; do not run npm,
bootstrap a second provider, or copy the source folder.

The Azure CLI login remains yours. The canvas does not log in automatically.
Local development still needs the tools reported by Doctor; generating an app
clones the existing daily-digest template repository on explicit request.
New apps restore the bundled `.funcignore` from a visible companion if the
installer omits the hidden file. Deployment refuses missing required
exclusions without rewriting an existing workspace. Runtime user state is
outside this payload and must be preserved during upgrade or rollback.

Reload extensions after an update. If multiple providers are installed, select
the intended host-declared extension ID; never bypass the launcher's occupied
panel guard. Missing native registration is a host installation problem, not a
reason to create a user extension link.

App `package.json` is the version authority; release inventory and checksums
describe the exact bytes, not authenticity or permission to publish.
