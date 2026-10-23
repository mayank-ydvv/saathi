"""DynamoDB + S3 Store (STORAGE=dynamo), table design from contract 4.5.

- saathi-events  : PK home_id, SK ts = "<ISO ts>#<event_id>"; conditional put = idempotent.
- saathi-routine : PK pk = "<home_id>#<zone>"; BatchGetItem over the known zones.
- saathi-alerts  : PK home_id, SK alert_id (time-sortable), newest-first Query with Limit.
- saathi-homes   : PK home_id. Also holds small marker items next to each home:
                   "<home>#open-alert" (H10) and "<home>#digest#<day>" (H5).
- Event idempotency (H6): an "id#<event_id>" item in saathi-events, written in the same
  transaction as the event, so a redelivery dedups even if its (demo-shifted) ts differs.
Digests, snapshots and audio live in S3 and are served through presigned URLs.
Only GetItem / PutItem / UpdateItem / Query / BatchGetItem are used: never Scan.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from backend.common.config import ZONES, Settings
from backend.common.events import event_sort_key
from backend.common.store import Record, digest_blob_key
from backend.common.timeutil import to_iso

PRESIGN_SECONDS = 3600

TABLE_KEYS: dict[str, list[tuple[str, str]]] = {
    "events": [("home_id", "HASH"), ("ts", "RANGE")],
    "routine": [("pk", "HASH")],
    "alerts": [("home_id", "HASH"), ("alert_id", "RANGE")],
    "homes": [("home_id", "HASH")],
}


def create_tables(resource: Any, settings: Settings) -> None:
    """Create the four tables (on-demand). For tests and local DynamoDB; SAM does it on AWS."""
    for name, keys in TABLE_KEYS.items():
        resource.create_table(
            TableName=settings.table(name),
            KeySchema=[{"AttributeName": a, "KeyType": t} for a, t in keys],
            AttributeDefinitions=[{"AttributeName": a, "AttributeType": "S"} for a, _ in keys],
            BillingMode="PAY_PER_REQUEST",
        )


def _plain(value: Any) -> Any:
    """DynamoDB returns numbers as Decimal: turn them back into int (or float), recursively."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def _dynamo_safe(value: Any) -> Any:
    """Floats aren't allowed by the serializer: send them as Decimal, recursively."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _dynamo_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_dynamo_safe(v) for v in value]
    return value


def _cancelled_by_condition(exc: ClientError) -> bool:
    if exc.response.get("Error", {}).get("Code") != "TransactionCanceledException":
        return False
    reasons = exc.response.get("CancellationReasons") or []
    return not reasons or any(r.get("Code") == "ConditionalCheckFailed" for r in reasons)


def _conditional_failed(exc: ClientError) -> bool:
    return exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException"


def _is_missing(exc: ClientError) -> bool:
    return exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404", "NotFound"}


class DynamoStore:
    def __init__(self, settings: Settings, resource: Any = None, s3: Any = None) -> None:
        self._settings = settings
        self._ddb = resource or boto3.resource("dynamodb", region_name=settings.aws_region)
        self._s3 = s3 or boto3.client("s3", region_name=settings.aws_region)
        self._bucket = settings.blob_bucket
        self._events = self._ddb.Table(settings.table("events"))
        self._routine = self._ddb.Table(settings.table("routine"))
        self._alerts = self._ddb.Table(settings.table("alerts"))
        self._homes = self._ddb.Table(settings.table("homes"))

    # events --------------------------------------------------------------
    def put_event_if_new(self, event: Record) -> bool:
        """One transaction of two conditional puts: O(1). The "id#<event_id>" marker makes
        the dedupe depend on event_id alone, not on the (demo-shifted) ts (H6)."""
        table = self._settings.table("events")
        item = {**event, "ts": event_sort_key(event)}
        marker = {"home_id": event["home_id"], "ts": f"id#{event['event_id']}"}
        cond = {
            "ConditionExpression": "attribute_not_exists(#sk)",
            "ExpressionAttributeNames": {"#sk": "ts"},
        }
        try:
            # The resource's client serialises plain Python values itself (Decimal for floats).
            self._ddb.meta.client.transact_write_items(
                TransactItems=[
                    {"Put": {"TableName": table, "Item": _dynamo_safe(marker), **cond}},
                    {"Put": {"TableName": table, "Item": _dynamo_safe(item), **cond}},
                ]
            )
        except ClientError as exc:
            if _cancelled_by_condition(exc):
                return False
            raise
        return True

    def update_event(self, home_id: str, ts: str, event_id: str, fields: Record) -> None:
        if not fields:
            return
        names = {f"#f{i}": k for i, k in enumerate(fields)} | {"#sk": "ts"}
        values = {f":v{i}": v for i, v in enumerate(fields.values())}
        self._events.update_item(
            Key={"home_id": home_id, "ts": f"{ts}#{event_id}"},
            UpdateExpression="SET " + ", ".join(f"#f{i} = :v{i}" for i in range(len(fields))),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(#sk)",
        )

    def query_events(self, home_id: str, start: datetime, end: datetime) -> list[Record]:
        """Query with a sort-key range: O(log n + k). `between` on the bare ISO bounds gives
        [start, end) because every stored key carries a "#event_id" suffix."""
        cond = Key("home_id").eq(home_id) & Key("ts").between(to_iso(start), to_iso(end))
        out: list[Record] = []
        kwargs: dict[str, Any] = {"KeyConditionExpression": cond}
        while True:
            page = self._events.query(**kwargs)
            for item in page.get("Items", []):
                item = _plain(item)
                item["ts"] = item["ts"].split("#", 1)[0]
                out.append(item)
            if "LastEvaluatedKey" not in page:
                return out
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    # routines ------------------------------------------------------------
    def get_routine(self, home_id: str, zone: str) -> Record | None:
        item = self._routine.get_item(Key={"pk": f"{home_id}#{zone}"}).get("Item")
        return self._routine_out(item) if item else None

    def put_routine(self, routine: Record, expected_rev: int | None = None) -> bool:
        """PutItem that bumps `rev`; with `expected_rev`, conditional on nobody writing since
        (H9: ingest and the tick both read-modify-write routines). O(1)."""
        rev = int(routine.get("rev", 0)) if expected_rev is None else expected_rev
        item = {**routine, "pk": f"{routine['home_id']}#{routine['zone']}", "rev": rev + 1}
        if expected_rev is None:
            self._routine.put_item(Item=item)
            return True
        condition = (  # rev 0 = never written, or written before routines had a rev
            "attribute_not_exists(pk) OR attribute_not_exists(rev) OR rev = :rev"
            if expected_rev == 0
            else "rev = :rev"
        )
        try:
            self._routine.put_item(
                Item=item,
                ConditionExpression=condition,
                ExpressionAttributeValues={":rev": expected_rev},
            )
        except ClientError as exc:
            if _conditional_failed(exc):
                return False
            raise
        return True

    def get_routines(self, home_id: str) -> dict[str, Record]:
        """One BatchGetItem over the contract zones: O(zones)."""
        name = self._settings.table("routine")
        request = {name: {"Keys": [{"pk": f"{home_id}#{z}"} for z in ZONES]}}
        out: dict[str, Record] = {}
        while request:
            resp = self._ddb.batch_get_item(RequestItems=request)
            for item in resp.get("Responses", {}).get(name, []):
                routine = self._routine_out(item)
                out[routine["zone"]] = routine
            request = resp.get("UnprocessedKeys") or {}
        return out

    @staticmethod
    def _routine_out(item: Record) -> Record:
        routine = _plain(item)
        routine.pop("pk", None)
        return routine

    # alerts --------------------------------------------------------------
    def put_alert(self, alert: Record, expected_state: str | None = None) -> bool:
        """PutItem, conditional on the stored state when `expected_state` is given."""
        if expected_state is None:
            self._alerts.put_item(Item=alert)
            return True
        try:
            self._alerts.put_item(
                Item=alert,
                ConditionExpression="#s = :expected",
                ExpressionAttributeNames={"#s": "state"},
                ExpressionAttributeValues={":expected": expected_state},
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False
            raise
        return True

    def get_alert(self, home_id: str, alert_id: str) -> Record | None:
        item = self._alerts.get_item(Key={"home_id": home_id, "alert_id": alert_id}).get("Item")
        return _plain(item) if item else None

    def find_alert(self, alert_id: str) -> Record | None:
        """O(H) GetItems over the configured homes (H = len(HOME_IDS), 1 for the demo)."""
        for home_id in self._settings.home_ids:
            alert = self.get_alert(home_id, alert_id)
            if alert is not None:
                return alert
        return None

    def list_alerts(self, home_id: str, limit: int = 20) -> list[Record]:
        """Newest-first Query with Limit: O(limit)."""
        if limit <= 0:
            return []
        resp = self._alerts.query(
            KeyConditionExpression=Key("home_id").eq(home_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        return [_plain(i) for i in resp.get("Items", [])]

    def get_open_alert(self, home_id: str) -> Record | None:
        """O(1): follows the home's open-alert pointer (H3/H10); older data without a
        pointer falls back to "the newest, if open"."""
        pointer = self._pointer(home_id)
        if not pointer:
            newest = self.list_alerts(home_id, 1)
            return newest[0] if newest and newest[0]["state"] != "RESOLVED" else None
        alert = self.get_alert(home_id, pointer)
        return alert if alert is not None and alert["state"] != "RESOLVED" else None

    def _pointer(self, home_id: str) -> str:
        item = self._homes.get_item(Key={"home_id": f"{home_id}#open-alert"}).get("Item")
        return str(item["alert_id"]) if item else ""

    def claim_open_alert(self, home_id: str, alert_id: str) -> bool:
        """Conditional put of the pointer, so only one alert opens per home (H10). O(1)."""
        if self.get_open_alert(home_id) is not None:
            return False
        old = self._pointer(home_id)
        try:
            if old:
                self._homes.put_item(
                    Item={"home_id": f"{home_id}#open-alert", "alert_id": alert_id},
                    ConditionExpression="alert_id = :old",
                    ExpressionAttributeValues={":old": old},
                )
            else:
                self._homes.put_item(
                    Item={"home_id": f"{home_id}#open-alert", "alert_id": alert_id},
                    ConditionExpression="attribute_not_exists(home_id)",
                )
        except ClientError as exc:
            if _conditional_failed(exc):
                return False
            raise
        return True

    def release_open_alert(self, home_id: str, alert_id: str) -> None:
        try:
            self._homes.delete_item(
                Key={"home_id": f"{home_id}#open-alert"},
                ConditionExpression="alert_id = :id",
                ExpressionAttributeValues={":id": alert_id},
            )
        except ClientError as exc:
            if not _conditional_failed(exc):  # a newer alert's pointer: leave it alone
                raise

    # homes ---------------------------------------------------------------
    def get_home(self, home_id: str) -> Record | None:
        item = self._homes.get_item(Key={"home_id": home_id}).get("Item")
        return _plain(item) if item else None

    def put_home(self, home: Record) -> None:
        self._homes.put_item(Item=home)

    # digests -------------------------------------------------------------
    def put_digest(self, home_id: str, day: date, text: str, generated_at: str) -> Record:
        record = {"date": day.isoformat(), "text": text, "generated_at": generated_at}
        self.save_blob(
            digest_blob_key(home_id, day), json.dumps(record).encode(), "application/json"
        )
        return record

    def get_digest(self, home_id: str, day: date) -> Record | None:
        blob = self.get_blob(digest_blob_key(home_id, day))
        return json.loads(blob[0]) if blob else None

    def claim_digest(self, home_id: str, day: date) -> bool:
        """Conditional put of a per-day marker, so the 21:00 Lambda and the tick can't both
        send the digest (H5). O(1)."""
        try:
            self._homes.put_item(
                Item={"home_id": f"{home_id}#digest#{day.isoformat()}"},
                ConditionExpression="attribute_not_exists(home_id)",
            )
        except ClientError as exc:
            if _conditional_failed(exc):
                return False
            raise
        return True

    def release_digest(self, home_id: str, day: date) -> None:
        """Undo a claim whose digest failed, so a later tick can retry (H4)."""
        self._homes.delete_item(Key={"home_id": f"{home_id}#digest#{day.isoformat()}"})

    # blobs ---------------------------------------------------------------
    def save_blob(self, key: str, data: bytes, content_type: str) -> str:
        self._s3.put_object(Bucket=self._bucket, Key=key, Body=data, ContentType=content_type)
        return self.blob_url(key)

    def blob_url(self, key: str) -> str:
        return self._s3.generate_presigned_url(
            "get_object", Params={"Bucket": self._bucket, "Key": key}, ExpiresIn=PRESIGN_SECONDS
        )

    def get_blob(self, key: str) -> tuple[bytes, str] | None:
        try:
            obj = self._s3.get_object(Bucket=self._bucket, Key=key)
        except ClientError as exc:
            if _is_missing(exc):
                return None
            raise
        return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")
