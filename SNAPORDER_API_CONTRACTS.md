# SnapOrder REST API Contracts

## API Standards

- **Base URL:** `https://api.snaporder.ng/v1` (production)
- **Format:** JSON
- **Authentication:** Bearer JWT (OAuth 2.0)
- **Rate Limiting:** per-IP (see "Rate Limiting" section below for actual implemented limits — the original "1000/min per API key" here assumed an API-key model that doesn't exist yet; there's no API-key auth, only per-user JWTs)
- **Versioning:** URL-based (`/v1`, `/v2` in future)

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

## Menu Management

### GET `/restaurants/{restaurantId}/menus`
Get all menus for a restaurant.

**Query Params:**
- `active_only=true` — Only return active menus

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
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "per_page": 10
  }
}
```

---

### GET `/restaurants/{restaurantId}/menus/{menuId}/meals`
Get all meals in a menu (for guest ordering).

**Query Params:**
- `category_id=uuid` — Filter by category
- `search=text` — Search meal names
- `available_only=true` — Only available meals

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Grilled Chicken Rice",
      "description": "Fresh chicken grilled with jasmine rice",
      "price": 2500,
      "image_url": "https://...",
      "calories": 450,
      "protein_grams": 28,
      "is_available": true,
      "is_vegan": false,
      "is_vegetarian": false,
      "is_low_calorie": false,
      "is_high_protein": true,
      "estimated_prep_time_minutes": 15,
      "ingredients": [
        {
          "id": "uuid",
          "name": "Chicken breast",
          "can_be_removed": true,
          "allergen_type": "none"
        },
        {
          "id": "uuid",
          "name": "Rice",
          "can_be_removed": false,
          "allergen_type": "none"
        }
      ],
      "addons": [
        {
          "id": "uuid",
          "name": "Extra Chicken",
          "additional_price": 800
        }
      ],
      "reviews": {
        "average_rating": 4.5,
        "total_reviews": 23,
        "recent": [
          {
            "rating": 5,
            "review": "Amazing! So fresh.",
            "has_photo": true,
            "posted_at": "2025-09-15T14:20:00Z"
          }
        ]
      }
    }
  ],
  "pagination": { ... }
}
```

---

### POST `/restaurants/{restaurantId}/menus/{menuId}/meals`
Create a new meal (restaurant admin only).

**Request:**
```json
{
  "name": "Grilled Tilapia",
  "description": "Fresh tilapia with olive oil",
  "category_id": "uuid",
  "base_price": 3500,
  "calories": 350,
  "protein_grams": 35,
  "carbs_grams": 0,
  "fat_grams": 15,
  "is_vegan": false,
  "is_vegetarian": false,
  "is_gluten_free": true,
  "is_high_protein": true,
  "estimated_prep_time_minutes": 12,
  "ingredients": [
    {
      "id": "ingredient_uuid",
      "can_be_removed": false,
      "is_required": true
    }
  ]
}
```

**Response (201):** Returns created meal object

---

## Orders

### POST `/tables/{tableId}/orders`
Place an order (guest).

**Headers:**
```
Content-Type: application/json
X-Guest-Phone: +234 811 234 5678 (or session token)
```

**Request:**
```json
{
  "items": [
    {
      "meal_id": "uuid",
      "quantity": 1,
      "removed_ingredients": ["ingredient_uuid_1"],
      "added_addons": ["addon_uuid_1"],
      "special_request": "No oil, extra spicy"
    }
  ],
  "special_requests": "Table is allergic to peanuts",
  "payment_method": "card"  // or "cash", "bank_transfer"
}
```

**Response (201):**
```json
{
  "id": "order_uuid",
  "order_number": "ORD-2025-00147",
  "table_id": "uuid",
  "status": "placed",
  "items": [ ... ],
  "subtotal": 6500,
  "tax": 650,
  "total_amount": 7150,
  "currency": "NGN",
  "estimated_ready_time_minutes": 15,
  "placed_at": "2025-09-16T10:30:00Z",
  "payment_required": true,
  "payment_url": "https://paystack.com/pay/xyz123"  // if payment_method="card"
}
```

---

### GET `/orders/{orderId}`
Get order details (guest can track, restaurant can fulfill).

**Response (200):**
```json
{
  "id": "order_uuid",
  "order_number": "ORD-2025-00147",
  "status": "preparing",
  "items": [
    {
      "id": "item_uuid",
      "meal_name": "Grilled Chicken Rice",
      "quantity": 1,
      "status": "preparing",
      "estimated_minutes_left": 8,
      "special_request": "No oil"
    }
  ],
  "total_amount": 7150,
  "placed_at": "2025-09-16T10:30:00Z",
  "estimated_ready_at": "2025-09-16T10:45:00Z",
  "updates": [
    {
      "status": "confirmed",
      "timestamp": "2025-09-16T10:31:00Z",
      "message": "Your order is confirmed. Preparing now."
    },
    {
      "status": "preparing",
      "timestamp": "2025-09-16T10:32:00Z",
      "message": "Your chicken is grilling. 13 minutes left."
    }
  ]
}
```

---

### PATCH `/orders/{orderId}/status`
Update order status (restaurant staff).

**Request:**
```json
{
  "status": "ready",
  "message": "Order ready for collection at Table 5"
}
```

**Response (200):** Updated order object

---

### POST `/orders/{orderId}/items/{itemId}/status`
Update individual meal status (kitchen).

**Request:**
```json
{
  "status": "ready",
  "estimated_minutes_left": 0
}
```

**Response (200):** Updated item object

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

**API Version:** 1.2 — Authentication Endpoints rewritten to match the actual implementation: routes now live under `/v1/auth`, `owner_name` added to register, `restaurant_id` added to login's user object, no `refresh_token` (not built), added `GET /v1/me`
**Last Updated:** Sept 17, 2026  
**Status:** Ready for implementation  
**Protocol:** REST with WebSocket for KDS
