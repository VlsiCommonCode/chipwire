# impedra.ai

Engineering the Intelligence Between Silicon.

A lightweight editorial site covering RISC-V, SoC architecture, system IP, verification, FPGA, open-source ASIC, and the technologies that connect those layers.

The site continues to deploy from this GitHub repository (`VlsiCommonCode/chipwire`) while the public brand and production domain are **[impedra.ai](https://impedra.ai/)**. GitHub Pages remains compatible at `https://vlsicommoncode.github.io/chipwire/`.

## Repository structure

```text
chipwire/
├── index.html
├── about.html
├── projects.html
├── topics.html
├── verification.html
├── learn.html
├── styles.css
├── app.js
├── CNAME
├── content/          # curated editorial JSON
├── data/             # generated news / GitHub metadata
├── scripts/
│   ├── update_github.py
│   └── update_news.py
└── .github/workflows/
    └── static.yml
```

## GitHub Pages

This repository deploys from `main` using GitHub Actions.

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or run **Actions → Deploy static content to Pages**.

The workflow updates public GitHub metadata, fetches industry headlines, then deploys the repository as a static GitHub Pages site.

## Custom domain

`CNAME` is set to `impedra.ai`. After the domain is registered, configure DNS:

- Apex `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- `CNAME` for `www` → `vlsicommoncode.github.io`
- In **Settings → Pages**, set the custom domain to `impedra.ai` and enable HTTPS

Until DNS is live, the GitHub Pages URL continues to serve the site.

## Adding a project

Add a record to `data/projects.json`:

```json
{
  "name": "Project",
  "repo": "owner/repo",
  "type": "CPU Core",
  "isa": "RV64",
  "rtl": "SystemVerilog",
  "tags": ["Tag1", "Tag2"],
  "desc": "Short editorial description.",
  "github": "https://github.com/owner/repo"
}
```

The next workflow run fetches its public GitHub metadata.
