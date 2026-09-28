# Azure SRE Agent: alternative installation and operational notes

Diagnose failing Azure applications with an existing Azure SRE Agent.

## Install the full plugin

Azure SRE Agent 0.2.6 is published at the immutable production tag
[`azure-sre-agent-v0-2-6-0a0c03b`](https://github.com/microsoft/azure-dev-tools/tree/azure-sre-agent-v0-2-6-0a0c03b).
To try the full plugin, go to
**Customize → Plugins → marketplace gear**, add `microsoft/azure-dev-tools`
(marketplace ID `azure-dev-tools`), and install **Azure SRE Agent**. The full
plugin includes both the canvas and its `azure-sre-agent-canvas` routing skill.

Fully quit and reopen GitHub Copilot, start a fresh chat, and try this exact
prompt:

```text
Open SRE Agent Canvas
```

Confirm the canvas opens and the routing skill appears in your host. This
full-plugin marketplace path, fresh-chat prompt routing, and live Azure
behavior still require manual verification. The marketplace follows the
current public catalog, not an exact version pin. If the plugin is not listed,
use the published versioned tag for the full plugin below, or the direct
canvas-only installation path at the end.

## Optional: pin the full plugin to an exact release

For a reproducible 0.2.6 full-plugin install, use the published versioned and
source-qualified tag. In a terminal with Git and Copilot CLI, run:

```bash
git clone --depth 1 --branch azure-sre-agent-v0-2-6-0a0c03b \
  https://github.com/microsoft/azure-dev-tools.git azure-sre-agent-plugin &&
  copilot plugin install ./azure-sre-agent-plugin/canvases/azure-sre-agent
```

The `azure-sre-agent-latest` tag currently points to the same
[production commit](https://github.com/microsoft/azure-dev-tools/commit/9f22e637c0289257ff1a3b9cbc3eac73d9403fa9),
but it can move and does not pin a version. The immutable checkout includes
the canvas and routing skill without relying on the current marketplace
listing. Fully quit and reopen GitHub Copilot, start a fresh chat, and retry
the prompt above. If your host does not expose CLI-installed plugins, check
its plugin status. The CLI currently warns that local-path plugin installation
may be deprecated in a future version.

## Direct canvas-only installation

If the full plugin is unavailable, go to
**Customize → Canvases → Install from gist/URL**, paste the
[immutable Azure SRE Agent 0.2.6 canvas-only URL](https://github.com/microsoft/azure-dev-tools/tree/azure-sre-agent-v0-2-6-0a0c03b/canvases/azure-sre-agent/com.github.copilot/extensions/azure-sre-agent),
and install. This exact nested URL was accepted by the GitHub App installer in
an isolated session. That acceptance covers direct canvas installation only.
It does not install the `azure-sre-agent-canvas` routing skill or verify
full-plugin marketplace consumption, fresh-chat routing, or live Azure
behavior. The equivalent
[`azure-sre-agent-latest` URL](https://github.com/microsoft/azure-dev-tools/tree/azure-sre-agent-latest/canvases/azure-sre-agent/com.github.copilot/extensions/azure-sre-agent)
is movable. Fully quit and reopen GitHub Copilot. Open **Azure SRE Agent** from
your installed canvases rather than relying on prompt routing. Do not install
a second provider to work around a missing canvas.

## Prerequisites

- A Copilot host that supports the installation path you choose and Node 22
  or later.
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
  installed and signed in with `az login`.
- Access to an Azure subscription containing an existing Azure SRE Agent, with
  permission to view and use it. This plugin does not create the agent resource.

If the canvas reports `fetch failed`, a network restriction may be preventing
access to Azure or the agent endpoint. Check your VPN and network connection,
then retry. This error alone does not establish that your Azure login or RBAC
needs changing.

## Use and safety

You can also ask:

```text
Investigate this failure
Investigate issues in <yourappname>
Investigate why Function App orders-api returns 503 after deployment
```

Choose your subscription and SRE Agent in **Azure Configuration**, then open
**Apps** to diagnose a failing resource. Select a thread in **Threads** to
inspect its evidence and status in **Active thread**. Choose
**Focus this thread** before operational follow-ups in chat, then **Unfocus**
when finished.

For an external or shared SRE Agent, paste its `sre.azure.com` share link or
Azure resource ID into **Open an agent by URL or resource ID** and choose
**Connect to agent**. Use **Save connected agent** to add it to **Favorites**;
select the saved agent later to reconnect without repeating the lookup.

The canvas uses your Azure CLI identity. Its read and write actions are
registered; mutating operations require an explicit action or host
confirmation. One-time execution authorization is separate from durable role
assignment. Delegated private-connector mutations require
`ALLOW_PRIVATE_CONNECTORS=true` and must not be used for production or
multi-user private connector isolation without verified per-invocation
ownership.

If the canvas is missing, fully quit and reopen GitHub Copilot, start a fresh
chat, and retry the exact prompt. Check plugin and extension status rather
than installing a second provider; reinstall via the same path you chose
(canvas extension or full plugin). If agents do not appear, check
`az account show`, your selected subscription, and your agent permissions.
