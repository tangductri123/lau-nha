"""Outbound synchronization of admin vouchers to the Poke Gateway (SPEC-14)."""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Mapping, Sequence
from urllib import request


class VoucherSyncError(RuntimeError):
    """Raised when the outbound voucher sync is configured but fails."""


def _enabled() -> bool:
    return os.getenv("LAU_NHA_VOUCHER_SYNC_ENABLED", "false").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def normalize_voucher_item(voucher: Mapping[str, Any]) -> dict[str, Any]:
    """Normalize a raw SQLite voucher row or dictionary into the Gateway schema."""
    code = str(voucher.get("code") or "").strip().upper()
    
    # Map discount_type -> kind
    kind = voucher.get("kind")
    if not kind:
        disc_type = str(voucher.get("discount_type") or "").lower()
        kind = "percent" if disc_type in ("percent", "percentage") else "fixed"
    
    # Map discount_value -> value
    value = voucher.get("value")
    if value is None:
        value = float(voucher.get("discount_value") or 0.0)
    else:
        value = float(value)
        
    # Map active
    if "active" in voucher:
        active = bool(voucher["active"])
    elif "is_active" in voucher:
        active = bool(voucher["is_active"] == 1 or voucher["is_active"] is True)
    else:
        active = True
        
    # Map condition
    condition = voucher.get("condition")
    if condition is None and ("min_order_value" in voucher or "max_discount_amount" in voucher):
        condition = {
            "min_order_value": voucher.get("min_order_value"),
            "max_discount_amount": voucher.get("max_discount_amount"),
        }
        
    # Map expires_at
    expires_at = voucher.get("expires_at") or voucher.get("end_date")
    if expires_at and not str(expires_at).strip():
        expires_at = None

    item: dict[str, Any] = {
        "code": code,
        "kind": kind,
        "value": value,
        "condition": condition,
        "active": active,
        "expires_at": expires_at,
    }
    return item


def build_voucher_payload(
    vouchers: Sequence[Mapping[str, Any]], version: int | str | None = None
) -> dict[str, Any]:
    """Build the stable payload accepted by the Gateway sync endpoint."""
    normalized = [normalize_voucher_item(v) for v in vouchers]
    payload: dict[str, Any] = {
        "source": "lau-nha-admin",
        "vouchers": normalized,
    }
    if version is not None:
        payload["version"] = version
    return payload


def sync_vouchers(
    vouchers: Sequence[Mapping[str, Any]], version: int | str | None = None
) -> bool:
    """POST vouchers to the Gateway after the local Admin transaction commits."""
    if not _enabled():
        return False

    token = os.getenv("LAU_NHA_VOUCHER_SYNC_TOKEN", "").strip()
    primary_url = os.getenv("GATEWAY_SYNC_URL", "").strip()
    fallback_url = os.getenv("LAU_NHA_VOUCHER_SYNC_URL", "").strip()
    
    endpoints = []
    if primary_url:
        endpoints.append(primary_url)
    if fallback_url and fallback_url != primary_url:
        endpoints.append(fallback_url)
    if not endpoints:
        # Default fallback to VPS internal gateway
        endpoints.append("http://127.0.0.1:8089/internal/vouchers/sync")

    if not token:
        raise VoucherSyncError("Voucher sync is enabled but LAU_NHA_VOUCHER_SYNC_TOKEN is missing")

    body = json.dumps(build_voucher_payload(vouchers, version)).encode("utf-8")
    
    last_exc = None
    for endpoint in endpoints:
        req = request.Request(
            endpoint,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Voucher-Sync-Token": token,
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=8) as response:
                if 200 <= response.status < 300:
                    print(f"[Voucher Sync SUCCESS] {len(vouchers)} vouchers synced to {endpoint} (HTTP {response.status})")
                    return True
                else:
                    print(f"[Voucher Sync Warning] {endpoint} returned HTTP {response.status}")
        except Exception as exc:
            last_exc = exc
            print(f"[Voucher Sync Warning] {endpoint} failed: {exc}")
            continue

    if last_exc:
        raise VoucherSyncError(f"All voucher sync endpoints failed. Last error: {last_exc}") from last_exc
    return False


def sync_all_vouchers_from_db(db_path: str | None = None) -> bool:
    """Reads all vouchers from brain.db and synchronizes them to the Gateway."""
    path = db_path or os.getenv("LAUNHA_SQLITE_PATH", "/app/My-Brain/brain.db")
    if not os.path.exists(path):
        # Fallback local path
        path = "My-Brain/brain.db"
    if not os.path.exists(path):
        print(f"[Voucher Sync] SQLite DB path not found: {path}")
        return False

    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM vouchers ORDER BY id DESC").fetchall()
        vouchers = [dict(r) for r in rows]
    finally:
        conn.close()

    return sync_vouchers(vouchers)
