#!/usr/bin/env python3
"""Fetch curated semiconductor headlines into data/industry-news.json/.js."""

import html
import json
import re
import ssl
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Dict, List, Optional, Set
from urllib.parse import urljoin

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / "data" / "industry-news.json"
OUT_JS = BASE / "data" / "industry-news.js"
USER_AGENT = (
    "Mozilla/5.0 (compatible; chipwire.ai-news-bot/1.3; +https://chipwire.ai)"
)

CHANNELS = [
    {"id": "riscv", "label": "RISC-V", "keywords": ["risc-v", "riscv", "openhw", "lowrisc", "sifive", "andes"]},
    {"id": "chiplet", "label": "Chiplet", "keywords": ["chiplet", "3d ic", "2.5d", "ucie", "packaging", "hbm", "die-to-die", "d2d"]},
    {"id": "eda", "label": "EDA", "keywords": ["eda", "verification", "uvm", "formal", "synthesis", "place and route", "openlane", "openroad"]},
    {"id": "foundry", "label": "Foundry", "keywords": ["tsmc", "intel foundry", "samsung foundry", "foundry", "wafer", "sky130", "gf180", "asml"]},
    {"id": "security", "label": "Security", "keywords": ["security", "opentitan", "cheri", "root of trust", "crypto", "secure boot", "tee"]},
    {"id": "automotive", "label": "Automotive", "keywords": ["automotive", "iso 26262", "adas", "vehicle", "auto "]},
]

CATEGORIES = [
    {
        "id": "industry",
        "label": "Industry",
        "description": "Tier-1 semiconductor, foundry, and market coverage.",
    },
    {
        "id": "architecture",
        "label": "Architecture & Design",
        "description": "CPUs, SoCs, EDA, verification, and microarchitecture deep dives.",
    },
    {
        "id": "riscv",
        "label": "RISC-V & Open Hardware",
        "description": "RISC-V International, lowRISC, and open silicon ecosystem news.",
    },
    {
        "id": "ai-silicon",
        "label": "AI Silicon",
        "description": "Accelerators, GPUs, datacenters, and AI infrastructure economics.",
    },
    {
        "id": "manufacturing",
        "label": "Manufacturing",
        "description": "Fabs, equipment, packaging, and the broader SEMI ecosystem.",
    },
    {
        "id": "conferences",
        "label": "Conferences",
        "description": "DVCon and design/verification conference signals.",
    },
    {
        "id": "india",
        "label": "India Semiconductor",
        "description": "India ecosystem coverage — policy, manufacturing, and design.",
    },
]

# Curated RSS sources. Sites without reliable public feeds are omitted for now.
SOURCES = [
    # Tier 1 — industry
    {"name": "EE Times", "home": "https://www.eetimes.com/", "feed": "https://www.eetimes.com/feed/", "category": "industry", "tier": 1, "limit": 6},
    {"name": "Semiconductor Engineering", "home": "https://semiengineering.com/", "feed": "https://semiengineering.com/feed/", "category": "architecture", "tier": 1, "limit": 6},
    {"name": "SemiWiki", "home": "https://semiwiki.com/", "feed": "https://semiwiki.com/feed/", "category": "architecture", "tier": 1, "limit": 6},
    {"name": "Tom's Hardware", "home": "https://www.tomshardware.com/", "feed": "https://www.tomshardware.com/feeds/tag/semiconductors", "category": "industry", "tier": 1, "limit": 5},
    {"name": "DigiTimes", "home": "https://www.digitimes.com/", "feed": "https://www.digitimes.com/rss/daily.xml", "category": "manufacturing", "tier": 1, "limit": 5},
    {"name": "SemiAnalysis", "home": "https://semianalysis.com/", "feed": "https://www.semianalysis.com/feed", "category": "ai-silicon", "tier": 1, "limit": 5},
    {"name": "IEEE Spectrum", "home": "https://spectrum.ieee.org/topic/semiconductors/", "feed": "https://spectrum.ieee.org/feeds/topic/semiconductors.rss", "category": "industry", "tier": 1, "limit": 4},
    {"name": "Semiconductor Digest", "home": "https://www.semiconductor-digest.com/", "feed": "https://www.semiconductor-digest.com/feed/", "category": "manufacturing", "tier": 1, "limit": 4},
    # Architecture / design
    {"name": "Chips and Cheese", "home": "https://chipsandcheese.com/", "feed": "https://chipsandcheese.com/feed", "category": "architecture", "tier": 2, "limit": 5},
    {"name": "Electronic Design", "home": "https://www.electronicdesign.com/", "feed": "https://www.electronicdesign.com/rss.xml", "category": "architecture", "tier": 2, "limit": 4},
    {"name": "Design News", "home": "https://www.designnews.com/", "feed": "https://www.designnews.com/rss.xml", "category": "architecture", "tier": 2, "limit": 3},
    {"name": "The Register", "home": "https://www.theregister.com/", "feed": "https://www.theregister.com/headlines.atom", "category": "industry", "tier": 2, "limit": 4, "keywords": ["chip", "cpu", "gpu", "semi", "tsmc", "intel", "amd", "nvidia", "arm", "risc", "foundry", "hbm", "wafer"]},
    # AI silicon / datacenter
    {"name": "ServeTheHome", "home": "https://www.servethehome.com/", "feed": "https://www.servethehome.com/feed/", "category": "ai-silicon", "tier": 2, "limit": 4},
    {"name": "The Next Platform", "home": "https://www.nextplatform.com/", "feed": "https://www.nextplatform.com/feed/", "category": "ai-silicon", "tier": 2, "limit": 4},
    {"name": "Data Center Dynamics", "home": "https://www.datacenterdynamics.com/", "feed": "https://www.datacenterdynamics.com/en/rss/", "category": "ai-silicon", "tier": 2, "limit": 3},
    {"name": "Blocks and Files", "home": "https://blocksandfiles.com/", "feed": "https://blocksandfiles.com/feed/", "category": "ai-silicon", "tier": 2, "limit": 3},
    # RISC-V / open hardware
    {"name": "RISC-V International", "home": "https://riscv.org/", "feed": "https://riscv.org/feed/", "category": "riscv", "tier": 2, "limit": 5},
    {"name": "RISC-V Blog", "home": "https://riscv.org/blog/", "feed": "https://riscv.org/blog/feed/", "category": "riscv", "tier": 2, "limit": 4},
    {"name": "lowRISC", "home": "https://www.lowrisc.org/", "feed": "https://www.lowrisc.org/feed/", "category": "riscv", "tier": 2, "limit": 4},
    # Manufacturing / SEMI
    {"name": "SEMI", "home": "https://www.semi.org/", "feed": "https://www.semi.org/en/blogs/semi-news/rss.xml", "category": "manufacturing", "tier": 2, "limit": 4},
    {"name": "Fabricated Knowledge", "home": "https://www.fabricatedknowledge.com/", "feed": "https://www.fabricatedknowledge.com/feed", "category": "manufacturing", "tier": 2, "limit": 3},
    # India
    {"name": "Electronics For You", "home": "https://www.electronicsforu.com/", "feed": "https://www.electronicsforu.com/feed", "category": "india", "tier": 2, "limit": 5, "keywords": ["semi", "chip", "fab", "vlsi", "risc", "asic", "fpga", "india", "meity", "tsmc", "foundry", "silicon"]},
    {"name": "Google News — India Semi", "home": "https://news.google.com/", "feed": "https://news.google.com/rss/search?q=India+semiconductor+OR+%22India+Semiconductor+Mission%22+OR+MeitY+chip+OR+%22semicon+india%22&hl=en-IN&gl=IN&ceid=IN:en", "category": "india", "tier": 2, "limit": 6},
]

DVCON_URL = "https://dvcon.org/media/news"
DVCON_LIMIT = 4
HOME_LIMIT = 12
TOTAL_LIMIT = 90


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def fetch(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context()) as resp:
            return resp.read()
    except ssl.SSLError:
        insecure = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=insecure) as resp:
            return resp.read()


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def trim_summary(text: str, limit: int = 180) -> str:
    text = strip_html(text)
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"


def parse_pub_date(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError, IndexError):
        return None


def local_text(node: Optional[ET.Element], tag: str) -> str:
    if node is None:
        return ""
    child = node.find(tag)
    if child is not None and (child.text or child.tail):
        return "".join(child.itertext()).strip()
    for child in list(node):
        if child.tag.endswith("}" + tag) or child.tag == tag:
            return "".join(child.itertext()).strip()
    return ""


def iter_rss_items(root: ET.Element):
    for node in root.findall("./channel/item"):
        yield node
    for node in root.findall("{http://www.w3.org/2005/Atom}entry"):
        yield node
    for node in root.findall("./entry"):
        yield node


def atom_link(node: ET.Element) -> str:
    for link in node.findall("{http://www.w3.org/2005/Atom}link"):
        rel = link.attrib.get("rel", "alternate")
        href = link.attrib.get("href", "").strip()
        if href and rel in ("alternate", ""):
            return href
    for link in node.findall("link"):
        href = (link.attrib.get("href") or (link.text or "")).strip()
        if href:
            return href
    return ""


def assign_channels(item: Dict) -> List[str]:
    blob = " ".join(
        [
            item.get("title") or "",
            item.get("summary") or "",
            item.get("source") or "",
            item.get("category") or "",
        ]
    ).lower()
    hits: List[str] = []
    for channel in CHANNELS:
        if any(k in blob for k in channel["keywords"]):
            hits.append(channel["id"])
    if item.get("category") == "riscv" and "riscv" not in hits:
        hits.append("riscv")
    if item.get("category") == "conferences" and "eda" not in hits:
        hits.append("eda")
    return hits


def matches_keywords(title: str, summary: str, keywords: Optional[List[str]]) -> bool:
    if not keywords:
        return True
    blob = f"{title} {summary}".lower()
    return any(k.lower() in blob for k in keywords)


def parse_rss(source: Dict) -> List[Dict]:
    items: List[Dict] = []
    try:
        raw = fetch(source["feed"])
        # Reject HTML error pages pretending to be feeds.
        head = raw[:200].lower()
        if b"<html" in head and b"<rss" not in head and b"<feed" not in head:
            print("skip feed", source["name"], "html response")
            return items
        root = ET.fromstring(raw)
    except Exception as exc:
        print("skip feed", source["name"], exc)
        return items

    for node in iter_rss_items(root):
        if len(items) >= source["limit"]:
            break
        title = strip_html(local_text(node, "title") or "")
        link = local_text(node, "link").strip() or atom_link(node)
        if not title or not link:
            continue
        summary = trim_summary(
            local_text(node, "description")
            or local_text(node, "summary")
            or local_text(node, "content")
            or ""
        )
        if not matches_keywords(title, summary, source.get("keywords")):
            continue
        published = parse_pub_date(
            local_text(node, "pubDate")
            or local_text(node, "published")
            or local_text(node, "updated")
            or node.findtext("{http://www.w3.org/2005/Atom}published")
            or node.findtext("{http://www.w3.org/2005/Atom}updated")
        )
        items.append(
            {
                "title": title,
                "url": link,
                "source": source["name"],
                "source_url": source["home"],
                "published": published,
                "summary": summary,
                "category": source["category"],
                "tier": source.get("tier", 2),
            }
        )
    print(f"{source['name']}: {len(items)} items")
    return items


def parse_dvcon_date(raw: str) -> Optional[str]:
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            dt = datetime.strptime(raw.strip(), fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return None


def fetch_page_title(url: str) -> str:
    try:
        page = fetch(url).decode("utf-8", errors="replace")
    except Exception:
        return ""
    m = re.search(r"<title[^>]*>(.*?)</title>", page, re.I | re.S)
    if not m:
        return ""
    title = strip_html(m.group(1))
    return re.sub(r"\s*[|\-–—]\s*DVCon.*$", "", title, flags=re.I).strip()


def parse_dvcon() -> List[Dict]:
    items: List[Dict] = []
    try:
        page = fetch(DVCON_URL).decode("utf-8", errors="replace")
    except Exception as exc:
        print("skip DVCon", exc)
        return items

    pattern = re.compile(
        r"(\w+ \d{1,2}, \d{4})\s*-\s*<a[^>]+href=\"([^\"]+)\"[^>]*>([^<]+)</a>",
        re.IGNORECASE,
    )
    seen: Set[str] = set()
    for match in pattern.finditer(page):
        date_raw, url, label = match.groups()
        url = html.unescape(url.strip())
        if not url.startswith("http"):
            url = urljoin("https://dvcon.org/", url)
        if url in seen or "/media/photos" in url:
            continue
        seen.add(url)
        label = strip_html(label)
        title = fetch_page_title(url) if "dvcon.org" in url else ""
        if not title:
            title = f"DVCon — {label} ({date_raw})"
        items.append(
            {
                "title": title,
                "url": url,
                "source": "DVCon",
                "source_url": "https://dvcon.org/",
                "published": parse_dvcon_date(date_raw),
                "summary": "Design and verification conference news, press releases, and industry coverage.",
                "category": "conferences",
                "tier": 2,
            }
        )
        if len(items) >= DVCON_LIMIT:
            break
    print(f"DVCon: {len(items)} items")
    return items


def sort_key(item: Dict) -> datetime:
    raw = item.get("published")
    if not raw:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def diversify(items: List[Dict], total: int) -> List[Dict]:
    """Keep newest items while ensuring every category stays represented."""
    if len(items) <= total:
        return items
    by_cat: Dict[str, List[Dict]] = {}
    for item in items:
        by_cat.setdefault(item.get("category") or "industry", []).append(item)

    chosen: List[Dict] = []
    seen: Set[str] = set()

    # Seed each category with its newest articles.
    for cat_items in by_cat.values():
        for item in cat_items[:3]:
            url = item["url"]
            if url in seen:
                continue
            seen.add(url)
            chosen.append(item)

    # Fill remaining slots with global newest.
    for item in items:
        if len(chosen) >= total:
            break
        url = item["url"]
        if url in seen:
            continue
        seen.add(url)
        chosen.append(item)

    chosen.sort(key=sort_key, reverse=True)
    return chosen[:total]


def main() -> None:
    items: List[Dict] = []
    for source in SOURCES:
        items.extend(parse_rss(source))
    items.extend(parse_dvcon())

    seen: Set[str] = set()
    unique: List[Dict] = []
    for item in items:
        url = item.get("url") or ""
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(item)

    unique.sort(key=sort_key, reverse=True)
    selected = diversify(unique, TOTAL_LIMIT)
    for item in selected:
        item["channels"] = assign_channels(item)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "home_limit": HOME_LIMIT,
        "categories": CATEGORIES,
        "channels": [{"id": c["id"], "label": c["label"]} for c in CHANNELS],
        "items": selected,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, indent=2)
    OUT.write_text(body + "\n", encoding="utf-8")
    OUT_JS.write_text(f"window.CHIPWIRE_NEWS = {body};\n", encoding="utf-8")

    counts: Dict[str, int] = {}
    for item in selected:
        counts[item["category"]] = counts.get(item["category"], 0) + 1
    print(f"wrote {len(selected)} items to {OUT.relative_to(BASE)}")
    print(f"wrote {OUT_JS.relative_to(BASE)}")
    print("by category:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    if not selected:
        raise SystemExit("no industry news items fetched")


if __name__ == "__main__":
    main()
