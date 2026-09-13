
import json, os, urllib.request, time
from pathlib import Path

base = Path(__file__).resolve().parents[1]
projects = json.loads((base/"data/projects.json").read_text())
token = os.environ.get("GITHUB_TOKEN")
out = {}
for p in projects:
    req = urllib.request.Request(
        "https://api.github.com/repos/" + p["repo"],
        headers={
            "Accept":"application/vnd.github+json",
            "X-GitHub-Api-Version":"2022-11-28",
            "User-Agent":"riscv-systems-hub"
        }
    )
    if token: req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            d=json.load(r)
        out[p["repo"]]={
            "stars":d.get("stargazers_count",0),
            "forks":d.get("forks_count",0),
            "language":d.get("language"),
            "updated_at":d.get("pushed_at"),
            "open_issues":d.get("open_issues_count",0),
            "license":(d.get("license") or {}).get("spdx_id"),
            "archived":d.get("archived",False)
        }
    except Exception as e:
        print("skip",p["repo"],e)
    time.sleep(.15)
(base/"data/github-data.json").write_text(json.dumps(out,indent=2),encoding="utf-8")
