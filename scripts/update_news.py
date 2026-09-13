#!/usr/bin/env python3
"""Fetch top semiconductor industry headlines into data/industry-news.json."""

import html
import json
import re
import ssl
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / "data" / "industry-news.json"
OUT_JS = BASE / "data" / "industry-news.js"
USER_AGENT = (
    "Mozilla/5.0 (compatible; chipwire.ai-news-bot/1.1; +https://chipwire.ai)"
)

SOURCES = [
    {
        "name": "SemiWiki",
        "home": "https://semiwiki.com/",
        "feed": "https://semiwiki.com/feed/",
        "limit": 6,
    },
    {
        "name": "EE Times",
        "home": "https://www.eetimes.com/",
        "feed": "https://www.eetimes.com/feed/",
        "limit": 6,
    },
]

DVCON_URL = "https://dvcon.org/media/news"
DVCON_LIMIT = 4


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        return ctx


def fetch(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context()) as resp:
            return resp.read()
    except ssl.SSLError:
        # Local Python installs sometimes lack CA roots; still allow CI-safe retry.
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
    # Namespaced fallback, e.g. {http://purl.org/dc/elements/1.1/}...
    for child in list(node):
        if child.tag.endswith("}" + tag) or child.tag == tag:
            return "".join(child.itertext()).strip()
    return ""


def iter_rss_items(root: ET.Element):
    # RSS 2.0
    for node in root.findall("./channel/item"):
        yield node
    # Atom
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


def parse_rss(source: Dict) -> List[Dict]:
    items: List[Dict] = []
    try:
        raw = fetch(source["feed"])
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
        published = parse_pub_date(
            local_text(node, "pubDate")
            or local_text(node, "published")
            or local_text(node, "updated")
            or node.findtext("{http://www.w3.org/2005/Atom}published")
            or node.findtext("{http://www.w3.org/2005/Atom}updated")
        )
        summary = trim_summary(
            local_text(node, "description")
            or local_text(node, "summary")
            or local_text(node, "content")
            or ""
        )
        items.append(
            {
                "title": title,
                "url": link,
                "source": source["name"],
                "source_url": source["home"],
                "published": published,
                "summary": summary,
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
    title = re.sub(r"\s*[|\-–—]\s*DVCon.*$", "", title, flags=re.I).strip()
    return title


def parse_dvcon() -> List[Dict]:
    items: List[Dict] = []
    try:
        page = fetch(DVCON_URL).decode("utf-8", errors="replace")
    except Exception as exc:
        print("skip DVCon", exc)
        return items

    # Current DVCon markup:
    # December 18, 2025 - <a href="https://dvcon.org/media/news/...">Press Release</a>
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
        if url in seen:
            continue
        # Skip pure navigation noise
        if "/media/photos" in url:
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


def main() -> None:
    items: List[Dict] = []
    for source in SOURCES:
        items.extend(parse_rss(source))
    items.extend(parse_dvcon())

    # De-dupe by URL while preserving sort order later.
    seen: Set[str] = set()
    unique: List[Dict] = []
    for item in items:
        url = item.get("url") or ""
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(item)

    unique.sort(key=sort_key, reverse=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": unique[:18],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, indent=2)
    OUT.write_text(body + "\n", encoding="utf-8")
    # JS bundle so the homepage works over file:// and before fetch resolves.
    OUT_JS.write_text(f"window.CHIPWIRE_NEWS = {body};\n", encoding="utf-8")
    print(f"wrote {len(payload['items'])} items to {OUT.relative_to(BASE)}")
    print(f"wrote {OUT_JS.relative_to(BASE)}")
    if not payload["items"]:
        raise SystemExit("no industry news items fetched")


if __name__ == "__main__":
    main()
