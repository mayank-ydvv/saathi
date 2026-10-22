"""Digest features (contract 4.3): imported as `from backend.digest import ...`."""

from backend.digest.daily import generate_digest
from backend.digest.visitor import describe_visitor
from backend.engine.trends import weekly_trend

__all__ = ["describe_visitor", "generate_digest", "weekly_trend"]
