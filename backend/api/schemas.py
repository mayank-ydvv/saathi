"""Pydantic response/request models that pin the REST shapes to contract 4.6 exactly."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Health(BaseModel):
    ok: bool = True


class Ok(BaseModel):
    ok: bool = True


class Contact(BaseModel):
    role: Literal["family", "neighbour"]
    name: str


class HomeOut(BaseModel):
    home_id: str
    parent_name: str
    city: str
    zones: list[str]
    contacts: list[Contact] = []
    parent_phone: str | None = None


class LastSeen(BaseModel):
    zone: str
    ts: str


class StatusOut(BaseModel):
    home_id: str
    status: Literal["green", "yellow", "red"]
    reason: str | None
    last_seen: LastSeen | None
    active_alert_id: str | None


class TimelineEvent(BaseModel):
    event_id: str
    ts: str
    zone: str
    type: str
    snapshot_url: str | None
    visitor: dict[str, Any] | None


class TimelineOut(BaseModel):
    date: str
    events: list[TimelineEvent]


class Step(BaseModel):
    state: str
    at: str


class AckedBy(BaseModel):
    by: Literal["parent", "family", "neighbour"]
    name: str


class AlertOut(BaseModel):
    alert_id: str
    home_id: str
    kind: str
    zone: str | None
    reason: str
    state: str
    created_at: str
    resolved_at: str | None
    acked_by: AckedBy | None
    steps: list[Step]


class AlertsOut(BaseModel):
    alerts: list[AlertOut]


class AckIn(BaseModel):
    by: Literal["parent", "family", "neighbour"]
    name: str = Field(min_length=1, max_length=80)


class AckOut(BaseModel):
    alert_id: str
    state: Literal["RESOLVED"]


class DigestOut(BaseModel):
    date: str
    text: str
    generated_at: str


class ZoneRoutine(BaseModel):
    zone: str
    usual_first: str | None
    hist: list[int] = Field(min_length=96, max_length=96)
    days_seen: int


class RoutineOut(BaseModel):
    zones: list[ZoneRoutine]


class NudgeOut(BaseModel):
    active: bool
    alert_id: str | None
    message: str | None
    audio_url: str | None
