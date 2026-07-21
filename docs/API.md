# Edge Function API Reference

Base URL: `${SUPABASE_URL}/functions/v1`

All requests send:
- `apikey: <anon key>`
- `Authorization: Bearer <user JWT | anon key>`
- `Content-Type: application/json`

Admin endpoints require a valid user JWT whose account holds the required role.

---

## POST `/enter-lottery` — Web entry (Step 1)

Creates a Sola hosted checkout session. The frontend redirects the browser to
`checkoutUrl`. Ticket assignment + capture happen later via `/sola-webhook`.

Request:
```json
{
  "lotteryId": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+15555550100",
  "email": "jane@example.com",
  "address": "optional"
}
```

Response `200`:
```json
{ "sessionId": "sess_...", "checkoutUrl": "https://checkout.sola...", "expiresAt": "..." }
```

Errors: `VALIDATION_ERROR` (422), `LOTTERY_NOT_FOUND` (404), `LOTTERY_NOT_OPEN` (409),
`RATE_LIMITED` (429), `DUPLICATE_PHONE` (409), `PAYMENT_SESSION_FAILED` (502).

---

## POST `/sola-webhook` — Sola payment webhook

Called by Sola. Verifies the `x-sola-signature` HMAC. On
`authorization.succeeded` it assigns a ticket, captures the exact ticket
amount, and sends SMS + email. Idempotent per `session_id`.

Headers: `x-sola-signature: sha256=<hmac>`

Response `200`: `{ "received": true, "ticketNumber": 247 }`
Errors: `INVALID_SIGNATURE` (401), `BAD_PAYLOAD` (400).

---

## POST `/signalwire-voice` — Inbound voice IVR (PRIMARY)

SignalWire posts form-encoded call data. Responds with LaML XML. Driven by a
`?step=` query param (`welcome → confirm → collect → payment → finalize →
goodbye`). See [SIGNALWIRE.md](SIGNALWIRE.md).

Response: `application/xml` (LaML).

---

## POST `/draw-winner` — Draw a winner (admin)

Role: `super_admin` | `lottery_manager`.

Request: `{ "lotteryId": "uuid" }`

Response `200`:
```json
{
  "drawingId": "uuid",
  "ticketNumber": 247,
  "amountDollars": 247,
  "winner": { "firstName": "Jane", "lastName": "Doe", "phone": "+1..." }
}
```

Errors: `FORBIDDEN` (403), `DRAWING_ALREADY_EXISTS` (409),
`NO_ELIGIBLE_TICKETS` (409).

---

## POST `/refund-payment` — Issue a refund (admin)

Role: `super_admin` | `lottery_manager`.

Request: `{ "paymentId": "uuid", "amountCents": 12300 }` (amount optional → full).

Response `200`: `{ "status": "refunded" | "partially_refunded", "refundedCents": 12300 }`

Errors: `PAYMENT_NOT_FOUND` (404), `NOT_REFUNDABLE` (409), `INVALID_AMOUNT` (422),
`REFUND_FAILED` (502).

---

## Error envelope

All non-2xx JSON responses use:
```json
{ "error": { "code": "MACHINE_CODE", "message": "Human readable" } }
```
