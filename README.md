# chipwire.ai

Open silicon, mapped.

A lightweight editorial site covering RISC-V, CPUs, SoCs, verification, FPGA and open-source ASIC projects.

## Repository structure

```text
chipwire/
├── index.html
├── projects.html
├── topics.html
├── verification.html
├── learn.html
├── styles.css
├── app.js
├── CNAME
├── data/
│   ├── projects.json
│   └── github-data.json
├── scripts/
│   └── update_github.py
└── .github/workflows/
    └── deploy.yml
```

## GitHub Pages

This repository is designed to deploy directly from `main` using GitHub Actions.

In GitHub:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or manually run **Actions → Update data and deploy chipwire.ai**.

The workflow updates public GitHub metadata, then deploys the repository as a static GitHub Pages site.

## Custom domain

The repository includes a `CNAME` file for `chipwire.ai`. You must also configure the custom domain under **Settings → Pages** and configure DNS at your domain provider. GitHub Pages supports apex domains such as `chipwire.ai` and `www` subdomains.

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
