"""Doorbell visitor description: Bedrock vision reports visible facts, Python decides caution."""

from __future__ import annotations

import json
import re

from backend.digest import bedrock

SYSTEM = """You describe a doorbell camera snapshot for a family safety app.
Report ONLY what is plainly visible. Never guess identity, name, age, gender, religion, \
ethnicity or intent. No face recognition. If unsure, say so in the summary and use false/0.
Reply with ONLY one JSON object, no prose, no code fences:
{"summary": "<one neutral sentence, max 20 words>", "person_count": <int>, \
"uniform_or_badge": <true if a delivery/service uniform, ID badge or company logo is visible>, \
"carrying_package": <true if a parcel, box or delivery bag is visible>}"""

DEFAULT = {
    "summary": "Visitor at the door",
    "person_count": 1,
    "uniform_or_badge": False,
    "carrying_package": False,
    "caution": False,
    "caution_reason": "",
}
_MAGIC = [(b"\xff\xd8\xff", "jpeg"), (b"\x89PNG", "png"), (b"GIF8", "gif")]


def image_format(data: bytes) -> str | None:
    """Bedrock image format from magic bytes. "RIFF" alone is also WAV/AVI, so WebP needs
    "WEBP" at bytes 8-12 (M4)."""
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return next((f for sig, f in _MAGIC if data.startswith(sig)), None)


def describe_visitor(image_bytes: bytes) -> dict:
    """Contract 4.3 visitor dict. Safe default on any failure or malformed answer.

    `caution` is computed here, not by the model: no uniform/badge and no package. The time
    of day is not part of this signature, so callers can ignore caution outside waking hours.
    """
    fmt = image_format(image_bytes)
    if fmt is None:
        return dict(DEFAULT)
    content = [
        {"image": {"format": fmt, "source": {"bytes": image_bytes}}},
        {"text": "Describe the visitor in this doorbell snapshot as JSON."},
    ]
    parsed = parse_visitor(bedrock.converse(SYSTEM, content, max_tokens=200))
    if parsed is None:
        return dict(DEFAULT)
    caution = parsed["person_count"] > 0 and not (
        parsed["uniform_or_badge"] or parsed["carrying_package"]
    )
    parsed["caution"] = caution
    parsed["caution_reason"] = "No uniform, badge or package visible" if caution else ""
    return parsed


def parse_visitor(text: str | None) -> dict | None:
    """Strictly validate the model's JSON; None if anything is off."""
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.DOTALL)  # tolerate stray code fences
    try:
        d = json.loads(match.group(0)) if match else None
    except json.JSONDecodeError:
        return None
    if not isinstance(d, dict):
        return None
    summary, count = d.get("summary"), d.get("person_count")
    uniform, package = d.get("uniform_or_badge"), d.get("carrying_package")
    if not (isinstance(summary, str) and summary.strip()):
        return None
    if not (isinstance(count, int) and not isinstance(count, bool) and 0 <= count <= 20):
        return None
    if not (isinstance(uniform, bool) and isinstance(package, bool)):
        return None
    return {
        "summary": summary.strip()[:200],
        "person_count": count,
        "uniform_or_badge": uniform,
        "carrying_package": package,
    }
