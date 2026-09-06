# RISC-V & Systems

Editorial-style open RISC-V / SoC engineering site.

## Deploy

Push this directory to a GitHub repository and enable GitHub Pages from the repository's Actions/Pages settings.

## Automated GitHub metadata

`scripts/update_github.py` reads `data/projects.json`, fetches public repository metadata using the GitHub API, and writes `data/github-data.json`.

The included workflow runs weekly and can also be triggered manually.

The workflow uses GitHub's built-in `GITHUB_TOKEN`; no token is exposed to browser JavaScript.

## Add a project

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

The website will automatically display the new project and the next scheduled workflow will fetch its GitHub metadata.
