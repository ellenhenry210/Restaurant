# SnapOrder REST API Contracts

## API Standards

- **Base URL:** `https://api.snaporder.ng/v1` (production)
- **Format:** JSON
- **Authentication:** Bearer JWT (OAuth 2.0)
- **Rate Limiting:** 1000 requests/minute per API key
- **Versioning:** URL-based (`/v1`, `/v2` in future)

---

## Authentication Endpoints

### POST `/auth/register`
Register a new restaurant.

**Request:**
```json
{
  "restaurant_name": "Tantalizers Nigeria",
  "email": "admin@tantalizers.ng",
  "phone": "+234 811 234 5678",
  "password": "SecurePassword123!",
  "address": "12 Lagos Street, Lagos Island",
  "registration_number": "RC 123456"
}
```

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

---

### POST `/auth/login`
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
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "user": {
    "id": "uuid-here",
    "name": "Manager Name",
    "email": "admin@tantalizers.ng",
    "role": "manager"
  }
}
```

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

**Headers in Response:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1694868000
```

---

**API Version:** 1.0  
**Last Updated:** Sept 16, 2025  
**Status:** Ready for implementation  
**Protocol:** REST with WebSocket for KDS
