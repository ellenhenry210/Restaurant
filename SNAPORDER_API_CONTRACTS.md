# SnapOrder REST API Contracts

## API Standards

- **Base URL:** `https://api.snaporder.ng/v1` (production)
- **Format:** JSON
- **Authentication:** Bearer JWT (OAuth 2.0)
- **Rate Limiting:** per-IP (see "Rate Limiting" section below for actual implemented limits — the original "1000/min per API key" here assumed an API-key model that doesn't exist yet; there's no API-key auth, only per-user JWTs)
- **Versioning:** URL-based (`/v1`, `/v2` in future)

---

## Restaurants

Implemented (2026-09-17) — `backend/src/routes/restaurants.js`. **Public — no auth.** New, not in earlier drafts of this doc, which always assumed a client already knows which restaurant it's dealing with (via QR scan). A directory/browse view was worth adding: same public-vs-internal split as the design intent elsewhere (return `name`/`description`/`address`/`logo_url`/`opening_hours` etc., never `email`/`registration_number`/`tax_id`/subscription dates/`max_guest_distance_meters`).

### GET `/v1/restaurants`
List active restaurants.

**Query Params:** `page` (default 1), `per_page` (default 20, max 50 — bounded so this can't become an unbounded "return everything" query as the platform grows)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid", "name": "Tantalizers Nigeria", "description": null,
      "address": null, "city": null, "state": null, "country": "Nigeria",
      "logo_url": null, "primary_color": null, "secondary_color": null,
      "latitude": "6.524400", "longitude": "3.379200",
      "opening_hours": { "monday": { "open": "09:00", "close": "22:00" }, "sunday": null },
      "created_at": "2026-09-17T13:25:06.258Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "per_page": 20 }
}
```

### GET `/v1/restaurants/{id}`
Single restaurant. Same public field set, plus `is_active` — an inactive restaurant is returned (not `404`), so a client can distinguish "temporarily unavailable" from "never existed" and show an appropriate message either way.

**Response (404)** if the id doesn't exist or isn't validly formed.

---

## Authentication Endpoints

Implemented in `backend/src/routes/auth.js`, mounted at `/v1/auth` (as of 2026-09-17 — see the versioning note below). Both routes sit behind `authLimiter` in addition to the global rate limiter (`backend/src/middleware/rateLimit.js`): 10 failed attempts / 15 min per IP.

### POST `/v1/auth/register`
Register a new restaurant, its first (Owner) user account, and the link between them, in one request.

**Request:**
```json
{
  "restaurant_name": "Tantalizers Nigeria",
  "owner_name": "Ada Okafor",
  "email": "admin@tantalizers.ng",
  "phone": "+234 811 234 5678",
  "password": "SecurePassword123!",
  "address": "12 Lagos Street, Lagos Island",
  "registration_number": "RC 123456"
}
```
`restaurant_name`, `owner_name`, `email`, `password` (min 8 characters) are required. `owner_name` was added during implementation — the schema's `restaurant_staff.name` is required and there's no sensible default for a person's name, so it wasn't optional. `phone`/`address`/`registration_number` are optional.

**Response (201):**
```json
{
  "id": "uuid-here",
  "name": "Tantalizers Nigeria",
  "email": "admin@tantalizers.ng",
  "status": "active",
  "created_at": "2025-09-16T10:30:00Z"
}
```

**Response (409)** if the email is already registered (as a `users.email` or a `restaurants.email`):
```json
{ "error": { "code": "CONFLICT", "message": "An account with this email already exists" } }
```

---

### POST `/v1/auth/login`
Restaurant staff login.

**Request:**
```json
{
  "email": "admin@tantalizers.ng",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 21600,
  "user": {
    "id": "uuid-here",
    "name": "Manager Name",
    "email": "admin@tantalizers.ng",
    "role": "manager",
    "restaurant_id": "uuid-here"
  }
}
```
No `refresh_token` — refresh-token issuance/rotation isn't implemented yet (tracked separately as a known gap); omitted rather than returning a fake one. `expires_in` (seconds) is read back from the actual issued token's `exp`/`iat`, so it always matches `JWT_EXPIRY` exactly rather than risking drift from a hardcoded value.

**Response (401)** — deliberately the *same* message whether the email doesn't exist or the password is wrong, so a client can't use this endpoint to enumerate which emails have accounts:
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid email or password" } }
```

A user with no active `restaurant_staff` row gets **403 FORBIDDEN** ("This account has no active restaurant role") instead — they authenticated correctly, but there's nothing for them to do here.

If a user has staff rows at more than one restaurant, login currently just picks the oldest one — there's no "choose which restaurant" step yet. Flagged as a real simplification, not an oversight (see `SNAPORDER_AUTHORIZATION.md` Part 0).

---

### GET `/v1/me`
Not part of the original spec — added alongside the `authenticate` middleware (`backend/src/middleware/auth.js`) as the natural way to verify it end-to-end, and useful in its own right (e.g. a frontend checking "is my stored token still valid" on load).

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{ "user": { "id": "uuid-here", "email": "admin@tantalizers.ng", "created_at": "2025-09-16T10:30:00Z" } }
```
Note this is the base `users` row only (id/email/created_at) — not role or restaurant_id, since `authenticate` is authentication only ("who are you"), not authorization ("what can you do where"). A route that needs role/restaurant context resolves it separately from `restaurant_staff`, scoped to whichever `:restaurantId` the request concerns.

**Response (401)** if the `Authorization` header is missing/malformed, the token is invalid or expired, or the account it names no longer exists.

---

## Guest Session

Implemented 2026-09-17 (`backend/src/routes/guestSession.js`). This is the actual entry point of the guest experience — scanning the table's QR code — and where the product's proximity requirement is enforced: "guests can only have access when in the place or a short distance from it." Not behind `authenticate`/`authorize` — a guest has no identity yet at this point; that's what these routes create.

### POST `/v1/tables/{qrCodeId}/scan`
Scan a table's QR code. Requires the guest's current coordinates (read from the browser's Geolocation API on the frontend) — the request fails if they're too far from the restaurant.

**Request:**
```json
{ "latitude": 6.5244, "longitude": 3.3792 }
```

**Response (201):**
```json
{
  "session_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2026-09-17T18:09:19.000Z",
  "restaurant": { "id": "uuid", "name": "Geo Test Diner" },
  "distance_meters": 50
}
```

**Response (403)** — one of three distinct reasons:
```json
{ "error": { "code": "FORBIDDEN", "message": "You need to be at {restaurant} to order here — you appear to be about {N}m away (max {M}m)." } }
```
or `"This restaurant has not configured its location yet — guest ordering is unavailable until it does"` (fails closed, not open, if the restaurant hasn't set its location), or `"This table is not currently active"`.

**Response (404)** if the QR code doesn't match any table. **Response (400)** if `latitude`/`longitude` are missing or out of range.

### GET `/v1/guest/session`
"Who is this guest session" — the guest counterpart to `GET /v1/me`, and the way to verify a stored session token is still good (e.g. on page reload).

**Headers:** `Authorization: Bearer <session_token>`

**Response (200):**
```json
{
  "session": { "id": "uuid", "table_id": "uuid", "restaurant_id": "uuid", "guest_profile_id": null, "expires_at": "2026-09-17T18:09:19.000Z" },
  "restaurant_name": "Geo Test Diner",
  "table_number": 1
}
```

**Response (401)** if the token is missing, expired, not a guest-type token (e.g. a staff token was used here by mistake), or the session no longer exists — including if it was revoked early (`guest_sessions.expires_at` set into the past), even though the JWT itself hasn't naturally expired yet.

---

## Menu Management

Implemented (2026-09-17): `GET /v1/restaurants/{restaurantId}/menus`, `GET /v1/meals/{id}`, `GET /v1/meals/{id}/ingredients` — `backend/src/routes/menus.js`. **Public — no auth.** `view_menu` (`SNAPORDER_AUTHORIZATION.md` Part 1) has no ABAC condition attached to it, unlike ordering — browsing is intentionally open even though placing an order requires a proximity-verified guest session (see Guest Session, Orders below).

### GET `/v1/restaurants/{restaurantId}/menus`
Get all menus for a restaurant.

**Query Params:**
- `active_only` — defaults to `true` (only `is_active=true` menus); pass `active_only=false` to see everything.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Lunch Menu",
      "description": "Available 12pm-3pm",
      "active_from": "12:00",
      "active_until": "15:00",
      "is_active": true,
      "categories_count": 5,
      "meals_count": 32
    }
  ]
}
```
`categories_count`/`meals_count` come from one `LEFT JOIN` + `GROUP BY` query, not a loop of per-menu queries (N+1) — see the code comments in `menus.js`. `meals_count` only counts `is_available = true` meals.

---

### GET `/v1/meals/{id}`
Meal details, with ingredients and addons joined in. **Not yet built:** listing all meals in a specific menu (`GET /restaurants/{restaurantId}/menus/{menuId}/meals` from an earlier draft of this doc) — meals are currently only fetched one at a time by id.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Grilled Chicken Rice",
  "description": "Fresh chicken grilled with jasmine rice",
  "base_price": "2500.00",
  "currency": "NGN",
  "calories": 450,
  "protein_grams": 28,
  "is_available": true,
  "category_name": "Mains",
  "ingredients": [
    { "id": "uuid", "name": "Chicken breast", "allergen_type": "none", "removal_policy": "can_remove", "removal_policy_reason": null, "is_required": false },
    { "id": "uuid", "name": "Rice", "allergen_type": "none", "removal_policy": "cannot_remove", "removal_policy_reason": "Cooked together, can't be separated" }
  ],
  "addons": [
    { "id": "uuid", "name": "Extra Chicken", "additional_price": "800.00", "max_quantity": 1 }
  ]
}
```
Note: `removal_policy` (3-state: `can_remove`/`caution`/`cannot_remove`) replaces an earlier draft's boolean `can_be_removed` shown in this doc previously — that boolean was never accurate once `SNAPORDER_DATABASE_SCHEMA.md`'s allergen policy engine (table 8) landed; this section just hadn't been updated to match until now. No `reviews` aggregate yet (`guest_reviews` querying isn't wired to this endpoint).

**Response (404)** if the meal doesn't exist.

---

### GET `/v1/meals/{id}/ingredients`
Just the ingredient list from the endpoint above, as its own lighter-weight fetch (e.g. an allergen-check UI that doesn't need the rest of the meal payload).

**Response (200):** `{ "data": [ ...same ingredient objects as above... ] }`

---

### POST `/restaurants/{restaurantId}/menus/{menuId}/meals`
Create a new meal (restaurant admin only). **Not implemented** — menu/meal data is currently seeded directly via SQL; no write endpoint exists yet. Kept here as the design target for when one is built.

---

## Orders

Implemented (2026-09-17): `POST /v1/orders`, `GET /v1/orders/{id}` — `backend/src/routes/orders.js`. Both behind `authenticateGuest` — this **supersedes an earlier draft** of this section that used `POST /tables/{tableId}/orders` with an `X-Guest-Phone` header, which predates the guest-session work (`SNAPORDER_AUTHORIZATION.md` Part 2 condition 6) and no longer reflects how guest identity actually works. `guest_profiles` are created here, on first order, exactly as the product design always specified — not at scan time.

### POST `/v1/orders`
Place an order.

**Headers:** `Authorization: Bearer <guest session_token>` (from `POST /v1/tables/{qrCodeId}/scan`)

**Request:**
```json
{
  "phone_number": "+234 811 234 5678",
  "guest_name": "Adeola K.",
  "items": [
    {
      "meal_id": "uuid",
      "quantity": 1,
      "removed_ingredients": ["ingredient_uuid_1"],
      "allergen_caution_acknowledged": false,
      "added_addons": ["addon_uuid_1"],
      "special_request": "No oil, extra spicy"
    }
  ],
  "special_requests": "Table is allergic to peanuts"
}
```
`removed_ingredients` are checked against each ingredient's `removal_policy` (`SNAPORDER_AUTHORIZATION.md` Part 3) for **every** item before anything is written:
- `cannot_remove` → whole order rejected, **403**, no partial order created.
- `caution` → requires that item's `allergen_caution_acknowledged: true`, else **400** asking for it.
- `can_remove` → honored silently.

`table_id`/`restaurant_id` are NOT in the request body — they come from the authenticated guest session, so a guest can only ever order for the table they actually scanned.

**Response (201):**
```json
{
  "id": "order_uuid",
  "order_number": "ORD-2026-00147",
  "status": "placed",
  "subtotal": "6600.00",
  "total_amount": "6600.00",
  "currency": "NGN",
  "placed_at": "2026-09-17T10:30:00Z",
  "items": [
    { "id": "item_uuid", "meal_id": "uuid", "meal_name": "Grilled Chicken Rice", "meal_price": "3300.00", "quantity": 2, "status": "pending" }
  ]
}
```
`meal_price` on each item is `base_price + sum(addon prices)` — a **snapshot** at order time, so a later menu price change never retroactively changes an already-placed order. **No `tax`/`service_charge`/`payment_url`** — not implemented (no tax rate is defined anywhere in the schema/design), so `total_amount` currently equals `subtotal` exactly; flagged rather than a made-up percentage. No payment integration either (see known gaps).

**Response (400)** for a meal that doesn't exist/isn't at this restaurant, an unavailable meal, an addon that isn't valid for the meal, or a missing `caution` acknowledgment. **Response (403)** for a blocked (`cannot_remove`) ingredient removal.

---

### GET `/v1/orders/{id}`
Get order status. Ownership is table-based: the order's `table_id` must match the authenticated guest session's `table_id` — see `orders.js` for why this is more correct than matching on `guest_profile_id` (a re-scan starts a new session whose `guest_profile_id` is null again until it orders).

**Headers:** `Authorization: Bearer <guest session_token>`

**Response (200):**
```json
{
  "id": "order_uuid",
  "order_number": "ORD-2026-00147",
  "status": "placed",
  "placed_at": "2026-09-17T10:30:00Z",
  "confirmed_at": null,
  "ready_at": null,
  "total_amount": "6600.00",
  "items": [
    { "id": "item_uuid", "meal_name": "Grilled Chicken Rice", "quantity": 2, "status": "pending", "special_request": "Extra spicy" }
  ]
}
```

**Response (403)** `"This order does not belong to your table"` if the order exists but belongs to a different table. **Response (404)** if it doesn't exist at all — verified live that these two cases are distinguishable to a legitimate caller.

**Not yet implemented — staff/kitchen side:** `PATCH /orders/{id}/status` (restaurant staff advancing an order's status) and updating individual item status (kitchen). Guests can create and check their own orders; nothing on the restaurant side can act on them yet. `view_all_orders`, `cancel_order`, `modify_order` (`SNAPORDER_AUTHORIZATION.md` Part 1) remain unenforced — no routes exist for them.

---

## Inventory Management

### GET `/restaurants/{restaurantId}/inventory`
Get current inventory levels.

**Response (200):**
```json
{
  "data": [
    {
      "id": "ingredient_uuid",
      "name": "Chicken breast",
      "current_stock": 15,
      "unit_of_measure": "kg",
      "reorder_level": 5,
      "status": "sufficient",  // "sufficient", "low", "out_of_stock"
      "last_updated": "2025-09-16T09:00:00Z"
    }
  ]
}
```

---

### PATCH `/restaurants/{restaurantId}/inventory/{ingredientId}`
Update ingredient stock.

**Request:**
```json
{
  "current_stock": 12,
  "reason": "used_in_orders"  // or "restocked", "waste", "adjustment"
}
```

**Response (200):** Updated ingredient object

---

### POST `/restaurants/{restaurantId}/meals/{mealId}/toggle-availability`
Toggle meal availability (quick restaurant action).

**Request:**
```json
{
  "is_available": false,
  "reason": "out_of_stock"  // or "maintenance", "not_ready"
}
```

**Response (200):**
```json
{
  "id": "meal_uuid",
  "is_available": false,
  "status_message": "Out of stock — back in 10 minutes"
}
```

---

## Staff Management

Implemented (as of 2026-09-17): `GET /v1/restaurants/{restaurantId}/staff` — `backend/src/routes/staff.js`. First real route behind `authorize()` (`SNAPORDER_AUTHORIZATION.md` Part 4) — the rest of this section's permission matrix (`edit_menu`, `issue_refund`, etc.) is designed but not wired to routes yet.

### GET `/v1/restaurants/{restaurantId}/staff`
List a restaurant's staff. Requires the `view_staff` permission (Manager/Owner/System Admin — see the RBAC matrix) **at this specific restaurant** — a token that's valid for a different restaurant gets `403`, not `404`, since the caller is authenticated, just not authorized for this resource.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
  "data": [
    { "id": "uuid", "name": "Ada Okafor", "role": "owner", "is_active": true, "created_at": "2026-09-17T12:58:14.604Z" }
  ]
}
```

**Response (403)** — one of several distinct reasons, each also written to `audit_log`:
```json
{ "error": { "code": "FORBIDDEN", "message": "You have no role at this restaurant" } }
```
or `"Role 'waiter' cannot 'view_staff'"`, or `"Your access to this restaurant has been deactivated"`.

**Response (400)** if `restaurantId` isn't a valid UUID; **401** if the token is missing/invalid (from `authenticate`, before `authorize` even runs).

---

## Guest Health Profiles

### POST `/guest-profiles`
Create/update guest health profile (on first order).

**Request:**
```json
{
  "phone_number": "+234 811 234 5678",
  "guest_name": "Adeola K.",
  "allergies": ["peanuts", "shellfish"],
  "health_goals": ["low_calorie", "high_protein"],
  "is_vegan": false,
  "is_vegetarian": false,
  "is_gluten_free": false,
  "spice_level": "medium"
}
```

**Response (201/200):**
```json
{
  "id": "guest_uuid",
  "phone_number": "+234 811 234 5678",
  "guest_name": "Adeola K.",
  "allergies": ["peanuts", "shellfish"],
  "health_goals": ["low_calorie", "high_protein"],
  "total_orders": 5,
  "last_order_at": "2025-09-15T18:45:00Z"
}
```

---

### GET `/guest-profiles/{guestId}`
Get guest profile (used for recommendations).

**Response (200):** Guest profile object

---

## Reviews & Feedback

### POST `/orders/{orderId}/reviews`
Submit meal reviews (guest).

**Request:**
```json
{
  "meal_id": "meal_uuid",
  "rating": 5,
  "review_text": "Amazing! Fresh and flavorful.",
  "photo_base64": "data:image/jpeg;base64,...",  // Optional
  "has_allergen_issue": false,
  "allergen_issue_description": null
}
```

**Response (201):**
```json
{
  "id": "review_uuid",
  "meal_id": "meal_uuid",
  "rating": 5,
  "review_text": "Amazing! Fresh and flavorful.",
  "photo_url": "https://snaporder-cdn.s3.../review-123.jpg",
  "is_public": true,
  "created_at": "2025-09-16T14:30:00Z"
}
```

---

### GET `/meals/{mealId}/reviews`
Get all reviews for a meal (shown in menu).

**Query Params:**
- `limit=5` — Most recent 5 reviews
- `sort_by=helpful` — Sort by helpfulness

**Response (200):**
```json
{
  "data": [
    {
      "id": "review_uuid",
      "guest_name": "Adeola K.",
      "rating": 5,
      "review_text": "Amazing!",
      "photo_url": "...",
      "helpful_count": 7,
      "posted_at": "2025-09-15T14:20:00Z",
      "restaurant_response": {
        "text": "Thank you! We're glad you enjoyed it.",
        "posted_at": "2025-09-15T16:00:00Z"
      }
    }
  ]
}
```

---

### POST `/reviews/{reviewId}/respond`
Restaurant response to review.

**Request:**
```json
{
  "response_text": "Thank you for the feedback! We're always improving."
}
```

**Response (201):** Restaurant response object

---

## Analytics Dashboard

### GET `/restaurants/{restaurantId}/analytics/daily`
Daily metrics for restaurant dashboard.

**Query Params:**
- `date=2025-09-16` — Optional, defaults to today
- `days=7` — Last N days

**Response (200):**
```json
{
  "date": "2025-09-16",
  "metrics": {
    "total_orders": 42,
    "total_revenue": 142500,
    "average_order_value": 3393,
    "meals_sold": 67,
    "top_meals": [
      {
        "meal_id": "uuid",
        "name": "Jollof Rice",
        "quantity_sold": 12,
        "revenue": 30000
      }
    ],
    "customer_health_trends": {
      "low_calorie_orders": 18,
      "high_protein_orders": 22,
      "vegan_orders": 5
    },
    "average_prep_time_minutes": 14,
    "guest_satisfaction_rating": 4.3
  }
}
```

---

### GET `/restaurants/{restaurantId}/analytics/revenue`
Revenue reports (daily, weekly, monthly).

**Query Params:**
- `period=monthly` — "daily", "weekly", "monthly", "yearly"
- `start_date=2025-09-01`
- `end_date=2025-09-30`

**Response (200):**
```json
{
  "period": "monthly",
  "start_date": "2025-09-01",
  "end_date": "2025-09-30",
  "summary": {
    "total_revenue": 2850000,
    "average_daily_revenue": 95000,
    "total_orders": 840,
    "average_order_value": 3393
  },
  "breakdown_by_day": [
    {
      "date": "2025-09-16",
      "revenue": 142500,
      "orders": 42
    }
  ]
}
```

---

## Kitchen Display System (KDS)

### WebSocket Connection
Connect to live kitchen display stream.

**Endpoint:** `wss://api.snaporder.ng/v1/ws/kitchen/{restaurantId}`

**Authentication:** Bearer token in query params

**Messages:**

**New Order (sent from server):**
```json
{
  "type": "new_order",
  "data": {
    "order_id": "uuid",
    "order_number": "ORD-2025-00147",
    "table_number": 5,
    "items": [
      {
        "id": "item_uuid",
        "meal_name": "Grilled Chicken Rice",
        "quantity": 1,
        "special_request": "No oil",
        "allergen_warnings": "Peanut-free",
        "priority": "high"  // "normal", "high" (allergen)
      }
    ],
    "placed_at": "2025-09-16T10:30:00Z"
  }
}
```

**Order Update (client → server):**
```json
{
  "type": "update_item_status",
  "data": {
    "order_id": "uuid",
    "item_id": "item_uuid",
    "status": "preparing",  // or "ready"
    "estimated_minutes_left": 8
  }
}
```

**Order Ready (client → server):**
```json
{
  "type": "order_ready",
  "data": {
    "order_id": "uuid",
    "message": "Order ready for Table 5"
  }
}
```

---

## Errors

All errors follow this format:

**Response (4xx, 5xx):**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Customer phone number is required",
    "details": {
      "field": "phone_number",
      "reason": "required"
    }
  }
}
```

**Common Error Codes:**
- `INVALID_REQUEST` (400) — Malformed request
- `UNAUTHORIZED` (401) — Missing/invalid token
- `FORBIDDEN` (403) — Insufficient permissions
- `NOT_FOUND` (404) — Resource not found
- `CONFLICT` (409) — Duplicate/conflicting resource
- `INTERNAL_ERROR` (500) — Server error
- `RATE_LIMITED` (429) — Too many requests

---

## Rate Limiting

Implemented via `express-rate-limit` in `backend/src/middleware/rateLimit.js` (as of 2026-09-17). Two limiters, both keyed per-IP:

- **General** (`generalLimiter`, applied to the whole API): 300 requests / 15 min. Skips `/health`.
- **Auth** (`authLimiter`, applied to `/v1/auth/*`): 10 *failed* attempts / 15 min. Successful requests don't count against it, so a legitimate user's own logins never trigger it — only repeated failures do.

**Headers in Response** — IETF draft-7 (`standardHeaders: 'draft-7'`), not the older `X-RateLimit-*` style:
```
RateLimit: limit=300, remaining=299, reset=900
RateLimit-Policy: 300;w=900
```
`reset` and the `w` (window) value are both in seconds. When a limit is hit, the response is `429` with the standard error body (`RATE_LIMITED`, see above).

Rate-limit state is in-memory (the library's default store) — correct for a single backend instance. If this ever runs as multiple instances behind a load balancer, it needs a shared store (e.g. Redis, already a project dependency) so the limit is enforced across instances rather than reset per-instance.

---

**API Version:** 1.5 — added Restaurants section (new); rewrote Menu Management and Orders to match the real implementation (`removal_policy` 3-state replacing a stale boolean, guest-session-based order creation replacing the old `X-Guest-Phone` draft, no fake `tax`/`payment_url`)
**Last Updated:** Sept 17, 2026  
**Status:** Ready for implementation  
**Protocol:** REST with WebSocket for KDS
