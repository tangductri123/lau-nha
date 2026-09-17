# SPEC-14: Field Ownership and Bridge Data Contract

This document defines the contract for the next Order/Payment bridge phase. It does not change the existing SQLite schema or payment flow.

## Ownership

The Lẩu Nhà Admin owns order-detail fields:

- customer_name
- phone
- address
- items
- quantities
- delivery_note
- discount_code
- internal_note

SePay owns payment fields:

- payment_status
- paid_amount
- currency
- provider
- provider_transaction_id
- payment_verified
- paid_at
- refunded_at

The Gateway must merge these field groups rather than replacing the entire order row.

## Gateway tables

```sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    source_order_id TEXT NOT NULL UNIQUE,
    customer_name TEXT,
    phone TEXT,
    address TEXT,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    quantities_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    delivery_note TEXT,
    discount_code TEXT,
    internal_note TEXT,
    admin_version BIGINT NOT NULL DEFAULT 0,
    admin_updated_at TIMESTAMPTZ,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    paid_amount NUMERIC(12, 2),
    currency TEXT,
    payment_provider TEXT,
    provider_transaction_id TEXT,
    payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    payment_version BIGINT NOT NULL DEFAULT 0,
    payment_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_events (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payment_status TEXT,
    amount NUMERIC(12, 2),
    currency TEXT,
    occurred_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload_json JSONB NOT NULL,
    processed_at TIMESTAMPTZ
);

CREATE TABLE order_audit_log (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    source TEXT NOT NULL CHECK (source IN ('admin', 'sepay', 'gateway')),
    changed_fields JSONB NOT NULL,
    old_values JSONB,
    new_values JSONB,
    actor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Merge rules

1. Admin updates only order-detail columns and increments `admin_version`.
2. SePay updates only payment columns and increments `payment_version`.
3. Every SePay webhook is idempotent through `provider_event_id`.
4. Payment transitions are validated as a state machine; an old event cannot downgrade a verified payment.
5. Each source writes an audit record in the same database transaction.
6. The Order/Payment bridge is a follow-up phase after the voucher PR is accepted; this document is planning-only.

## Rollout order

1. Accept and deploy the voucher client and environment contract.
2. Confirm the Gateway PostgreSQL `DATABASE_URL` and create the tables through a reviewed migration.
3. Add the Gateway inbound Order/Payment endpoints.
4. Add Lẩu Nhà outbound Order and SePay event adapters separately.
5. Test concurrent Admin and SePay updates with idempotency and stale-event cases.
6. Enable production sync behind feature flags.
