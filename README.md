# Azure Developer Tools

Install Azure-focused GitHub Copilot plugins that help you build Hosted Skills,
inspect Azure resources, diagnose apps with SRE Agent, review cost health,
browse Azure Storage, and create canvas apps.

## Install a plugin

Add the production marketplace once:

```sh
copilot plugin marketplace add microsoft/azure-dev-tools
```

Then install the plugin you need:

```sh
copilot plugin install azure-functions-hosted-skills@azure-dev-tools
copilot plugin install azure-resources-query@azure-dev-tools
copilot plugin install azure-cost-health-check@azure-dev-tools
copilot plugin install azure-sre-agent@azure-dev-tools
copilot plugin install azure-storage-canvas@azure-dev-tools
copilot plugin install canvas-authoring@azure-dev-tools
```

You can also open GitHub Copilot **Customize > Plugins**, use the marketplace
gear to add `microsoft/azure-dev-tools` (marketplace ID `azure-dev-tools`), and
select a plugin. Fully quit and reopen GitHub Copilot after installation, then
start a fresh chat.

The marketplace follows this repository's default branch. Immutable tags are
the reproducible install points:

| Plugin | What it does | Production status |
| --- | --- | --- |
| [Azure Functions Hosted Skills](canvases/azure-functions-hosted-skills/) | Build and run local Hosted Skills or invoke supported functions in an existing Function App. | 0.5.5 is tagged; `azure-functions-hosted-skills-latest` points to that release. |
| [Azure Resources Query](canvases/azure-resources-query/) | Find and inspect Azure resources with read-only Resource Graph queries. | 0.1.5 is tagged; `azure-resources-query-latest` points to that release. |
| [Canvas Authoring](plugins/canvas-authoring/) | Add toolkit setup and starter apps to the native `create-canvas` workflow. | 0.1.1 is tagged; `canvas-authoring-latest` points to that release. Skill-only plugin, with no canvas panel. |
| [Azure Cost Health Check](canvases/azure-cost-health-check/) | Review spend, forecasts, budgets, alerts, recommendations, and AI billing. | 0.4.5 is tagged; `azure-cost-health-check-latest` points to that release. |
| [Azure SRE Agent](canvases/azure-sre-agent/) | Connect to your SRE Agent, diagnose failing apps, and investigate incident threads. | 0.2.7 is tagged; `azure-sre-agent-latest` points to that release. |
| [Azure Storage canvas](canvases/azure-storage-canvas/) | Browse blobs, inspect statistics, download files, and plan storage transfers with Copilot. | 0.1.1 candidate; production release tags are pending independent review and merge. |

Native App marketplace installation has not been verified for every product;
a source package or direct CLI install alone does not establish that the
native listing is live.

## Start with a useful prompt

**Hosted Skills**

> Open Azure Functions Hosted Skills canvas so I can try a daily GitHub
> repository digest for octocat/Hello-World with the Timer trigger.

**Resources Query**

> Show my Function Apps in Development.

**Cost Health Check**

> Open Azure Cost Health Check in real mode for my subscription.

**Azure SRE Agent**

> My app is failing. Open SRE Agent Canvas so I can investigate it.

**Canvas Authoring**

> Use the native create-canvas skill and the create-canvas-app companion to
> build a counter canvas.

**Azure Storage**

> Open Azure Storage canvas.

Each product README lists its prerequisites, safe prompts, first-run workflow,
version-pinned installation options, and product-specific safety behavior.

## Get involved

See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute. For help or feedback, see
[SUPPORT.md](SUPPORT.md). To report a security vulnerability, follow
[SECURITY.md](SECURITY.md). This repository is licensed under the
[MIT License](LICENSE).
