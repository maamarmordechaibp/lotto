# Edge Function API Reference

Base URL: `${SUPABASE_URL}/functions/v1`

All requests send:
- `apikey: <anon key>`
- `Authorization: Bearer <user JWT | anon key>`
- `Content-Type: application/json`

Admin endpoints require a valid user JWT whose account holds the required role.

---

## POST `/enter-lottery` — Web entry (synchronous)

The frontend collects the card with Sola **iFields** (client-side), yielding
single-use tokens (SUT). It posts those tokens + entrant info here. The backend
authorizes (`cc:authonly` for the range MAX), assigns an unused ticket, captures
the **exact** ticket amount (`cc:capture`), voids on failure (`cc:void`), sends
SMS + email, and returns the ticket — all in one request. **No webhook.**

Request:
```json
{
  "lotteryId": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+15555550100",
  "email": "jane@example.com",
  "address": "optional",
  "cardToken": "<iFields SUT for xCardNum>",
  "cvvToken": "<iFields SUT for xCVV>",
  "exp": "1230",
  "zip": "10001"
}
```

Response `200`:
```json
{ "ticketNumber": 247, "amountDollars": 247, "refNum": "1234567890" }
```

Errors: `VALIDATION_ERROR` (422), `LOTTERY_NOT_FOUND` (404), `LOTTERY_NOT_OPEN` (409),
`RATE_LIMITED` (429), `DUPLICATE_PHONE` (409), `PAYMENT_AUTH_FAILED` (502),
`PAYMENT_DECLINED` (402), `LOTTERY_SOLD_OUT` (409).

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
