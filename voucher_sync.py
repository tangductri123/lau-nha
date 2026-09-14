"""Outbound synchronization of admin vouchers to the Poke Gateway.

This module is intentionally independent of the SQLite schema and Admin flow.
The caller supplies normalized voucher dictionaries after a successful commit.
"""

from __future__ import annotations

import json
import os
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


def build_voucher_payload(
    vouchers: Sequence[Mapping[str, Any]], version: int | str | None = None
) -> dict[str, Any]:
    """Build the stable payload accepted by the Gateway sync endpoint."""
    normalized = []
    for voucher in vouchers:
        item = {
            "code": voucher.get("code"),
            "kind": voucher.get("kind"),
            "value": voucher.get("value"),
            "condition": voucher.get("condition"),
        }
        if "active" in voucher:
            item["active"] = voucher["active"]
        if "expires_at" in voucher:
            item["expires_at"] = voucher["expires_at"]
        normalized.append(item)

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
    """POST vouchers to the Gateway after the local Admin transaction commits.

    Sync is opt-in. When disabled or unconfigured, this is a no-op so existing
    Admin behavior remains unchanged. Network errors are raised only when sync
    is explicitly enabled, allowing the caller to log/retry without rolling
    back the already-committed local transaction.
    """
    if not _enabled():
        return False

    endpoint = os.getenv("LAU_NHA_VOUCHER_SYNC_URL", "").strip()
    token = os.getenv("LAU_NHA_VOUCHER_SYNC_TOKEN", "").strip()
    if not endpoint or not token:
        raise VoucherSyncError(
            "Voucher sync is enabled but LAU_NHA_VOUCHER_SYNC_URL or "
            "LAU_NHA_VOUCHER_SYNC_TOKEN is missing"
        )

    body = json.dumps(build_voucher_payload(vouchers, version)).encode("utf-8")
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
        with request.urlopen(req, timeout=10) as response:
            if response.status < 200 or response.status >= 300:
                raise VoucherSyncError(f"Gateway returned HTTP {response.status}")
    except Exception as exc:
        if isinstance(exc, VoucherSyncError):
            raise
        raise VoucherSyncError(f"Voucher sync request failed: {exc}") from exc
    return True
