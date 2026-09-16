# SnapOrder Database Schema

## Database: PostgreSQL

**Design Principle:** Relational model, normalized to 3NF, with thoughtful indexes for real-time queries.

---

## Core Tables

### 1. `restaurants`
Restaurants using SnapOrder.

```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Nigeria',
  
  -- Business details
  registration_number VARCHAR(50) UNIQUE,  -- RC number (Eden Acres: RC 9597708)
  tax_id VARCHAR(50),
  
  -- Customization (White-label)
  logo_url TEXT,
  primary_color VARCHAR(7),  -- Hex color
  secondary_color VARCHAR(7),
  custom_domain VARCHAR(255),
  
  -- Billing
  plan_type ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
  subscription_start_date DATE,
  subscription_end_date DATE,
  
  -- Operational
  timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_colors CHECK (
    primary_color ~* '^#[0-9A-Fa-f]{6}$' OR primary_color IS NULL
  )
);

CREATE INDEX idx_restaurants_email ON restaurants(email);
CREATE INDEX idx_restaurants_custom_domain ON restaurants(custom_domain);
```

---

### 2. `restaurant_staff`
Staff members with roles (manager, chef, waiter, etc.).

```sql
CREATE TABLE restaurant_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  
  role ENUM('manager', 'chef', 'waiter', 'inventory_manager') NOT NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_restaurant_email UNIQUE (restaurant_id, email)
);

CREATE INDEX idx_staff_restaurant ON restaurant_staff(restaurant_id);
CREATE INDEX idx_staff_role ON restaurant_staff(restaurant_id, role);
```

---

### 3. `tables` (Physical Tables)
Physical restaurant tables with QR codes.

```sql
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  table_number INT NOT NULL,
  qr_code_unique_id VARCHAR(100) NOT NULL,  -- Maps QR to table
  qr_code_url TEXT,  -- Generated QR image
  
  capacity INT,  -- Seats
  location VARCHAR(255),  -- "Corner", "Window", "VIP area"
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_table_number UNIQUE (restaurant_id, table_number),
  CONSTRAINT unique_qr_code UNIQUE (qr_code_unique_id)
);

CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX idx_tables_qr_code ON tables(qr_code_unique_id);
```

---

### 4. `menus`
Menu configurations per restaurant.

```sql
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,  -- "Lunch Menu", "Dinner Menu"
  description TEXT,
  
  is_active BOOLEAN DEFAULT TRUE,
  active_from TIME,  -- Menu available from 12:00 PM
  active_until TIME,  -- Menu available until 10:00 PM
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_menus_restaurant ON menus(restaurant_id);
CREATE INDEX idx_menus_active ON menus(restaurant_id, is_active);
```

---

### 5. `meal_categories`
Meal categories (Breakfast, Main Course, Desserts, etc.).

```sql
CREATE TABLE meal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,  -- "Main Course"
  description TEXT,
  icon_emoji VARCHAR(10),  -- "🍲"
  sort_order INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_menu ON meal_categories(menu_id);
```

---

### 6. `meals`
Individual meal items.

```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES meal_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,  -- "Grilled Chicken Rice"
  description TEXT,
  image_url TEXT,
  
  -- Pricing
  base_price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  
  -- Nutritional Info
  calories INT,
  protein_grams DECIMAL(5, 1),
  carbs_grams DECIMAL(5, 1),
  fat_grams DECIMAL(5, 1),
  fiber_grams DECIMAL(5, 1),
  sodium_mg INT,
  
  -- Health tags
  is_vegan BOOLEAN DEFAULT FALSE,
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_gluten_free BOOLEAN DEFAULT FALSE,
  is_low_calorie BOOLEAN DEFAULT FALSE,  -- < 500 cal
  is_high_protein BOOLEAN DEFAULT FALSE,  -- > 25g protein
  
  -- Availability
  is_available BOOLEAN DEFAULT TRUE,
  estimated_prep_time_minutes INT,  -- How long to prepare
  
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meals_category ON meals(category_id);
CREATE INDEX idx_meals_restaurant ON meals(restaurant_id);
CREATE INDEX idx_meals_available ON meals(restaurant_id, is_available);
CREATE INDEX idx_meals_health_tags ON meals(is_vegan, is_vegetarian, is_gluten_free);
```

---

### 7. `ingredients`
Individual ingredients used in meals.

```sql
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,  -- "Chicken breast", "Rice"
  
  -- Allergen info
  allergen_type ENUM(
    'peanuts', 'tree_nuts', 'shellfish', 'fish',
    'milk', 'eggs', 'soy', 'wheat', 'sesame',
    'sulfites', 'mustard', 'celery', 'none'
  ) DEFAULT 'none',
  
  is_allergen BOOLEAN DEFAULT FALSE,
  
  -- Stock tracking
  current_stock INT DEFAULT 0,
  unit_of_measure VARCHAR(50),  -- "kg", "liter", "pieces"
  reorder_level INT,  -- Alert when stock < this
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ingredients_restaurant ON ingredients(restaurant_id);
CREATE INDEX idx_ingredients_allergen ON ingredients(allergen_type);
```

---

### 8. `meal_ingredients`
Mapping of ingredients to meals (many-to-many with options).

```sql
CREATE TABLE meal_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  
  -- Customization
  can_be_removed BOOLEAN DEFAULT TRUE,  -- Can guest remove this ingredient?
  is_required BOOLEAN DEFAULT FALSE,  -- Must this ingredient be in meal?
  
  quantity DECIMAL(8, 2),  -- How much of ingredient in base meal
  unit_of_measure VARCHAR(50),  -- "grams", "ml", "pieces"
  
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_meal_ingredient UNIQUE (meal_id, ingredient_id)
);

CREATE INDEX idx_meal_ingredients_meal ON meal_ingredients(meal_id);
```

---

### 9. `meal_addons`
Optional add-ons (extra protein, extra sauce, etc.).

```sql
CREATE TABLE meal_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,  -- "Extra Chicken", "Extra Sauce"
  description TEXT,
  
  additional_price DECIMAL(10, 2) NOT NULL,  -- + ₦800
  
  max_quantity INT DEFAULT 1,  -- How many can guest add?
  
  is_available BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addons_meal ON meal_addons(meal_id);
```

---

### 10. `guest_profiles`
Guest health/dietary profiles.

```sql
CREATE TABLE guest_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  phone_number VARCHAR(20) NOT NULL,  -- Primary identifier (Nigerian phone)
  guest_name VARCHAR(255),
  
  -- Allergies
  allergies TEXT[],  -- Array: ['peanuts', 'shellfish', 'milk']
  
  -- Health goals
  health_goals TEXT[],  -- Array: ['low_calorie', 'high_protein', 'vegan']
  
  -- Dietary restrictions
  is_vegan BOOLEAN DEFAULT FALSE,
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_gluten_free BOOLEAN DEFAULT FALSE,
  
  -- Preferences
  spice_level ENUM('mild', 'medium', 'hot') DEFAULT 'medium',
  
  -- Engagement
  total_orders INT DEFAULT 0,
  last_order_at TIMESTAMP,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_guest_per_restaurant UNIQUE (restaurant_id, phone_number)
);

CREATE INDEX idx_guest_profiles_phone ON guest_profiles(phone_number);
CREATE INDEX idx_guest_profiles_restaurant ON guest_profiles(restaurant_id);
```

---

### 11. `orders`
Guest orders.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE SET NULL,
  guest_profile_id UUID REFERENCES guest_profiles(id) ON DELETE SET NULL,
  
  order_number VARCHAR(50) UNIQUE NOT NULL,  -- "ORD-2025-00147"
  
  -- Status
  status ENUM(
    'placed', 'confirmed', 'preparing', 
    'ready', 'served', 'cancelled'
  ) DEFAULT 'placed',
  
  -- Timing
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  ready_at TIMESTAMP,
  served_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  estimated_ready_time INT,  -- Minutes from placement
  
  -- Pricing
  subtotal DECIMAL(10, 2),
  tax DECIMAL(10, 2),
  service_charge DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'NGN',
  
  -- Payment
  payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  payment_method ENUM('card', 'bank_transfer', 'mobile_money', 'cash') DEFAULT 'cash',
  payment_reference VARCHAR(255),
  
  -- Tipping
  tip_amount DECIMAL(10, 2),
  
  -- Special notes
  special_requests TEXT,
  allergen_warnings TEXT,  -- Stored for safety
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_date ON orders(placed_at);
CREATE INDEX idx_orders_guest ON orders(guest_profile_id);
```

---

### 12. `order_items`
Individual items in an order (many meals per order).

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id),
  
  meal_name VARCHAR(255),  -- Snapshot of meal name
  meal_price DECIMAL(10, 2),  -- Price at time of order
  quantity INT DEFAULT 1,
  
  -- Customization snapshot
  removed_ingredients UUID[],  -- Array of ingredient IDs removed
  added_addons UUID[],  -- Array of addon IDs added
  special_request TEXT,  -- "No oil", "Extra spicy"
  
  -- Status
  status ENUM(
    'pending', 'preparing', 
    'ready', 'served', 'cancelled'
  ) DEFAULT 'pending',
  
  prepared_by_staff_id UUID REFERENCES restaurant_staff(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_meal ON order_items(meal_id);
```

---

### 13. `guest_reviews`
Guest reviews and feedback.

```sql
CREATE TABLE guest_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  guest_profile_id UUID NOT NULL REFERENCES guest_profiles(id) ON DELETE CASCADE,
  
  rating INT NOT NULL,  -- 1-5 stars
  review_text TEXT,  -- Optional written review
  photo_url TEXT,  -- Optional meal photo
  
  -- Issue flags
  has_allergen_issue BOOLEAN DEFAULT FALSE,
  allergen_issue_description TEXT,
  
  -- Helpfulness
  helpful_count INT DEFAULT 0,
  
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_meal ON guest_reviews(meal_id);
CREATE INDEX idx_reviews_guest ON guest_reviews(guest_profile_id);
CREATE INDEX idx_reviews_public ON guest_reviews(is_public);
```

---

### 14. `restaurant_responses`
Restaurant responses to guest reviews.

```sql
CREATE TABLE restaurant_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES guest_reviews(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES restaurant_staff(id),
  
  response_text TEXT NOT NULL,
  
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_responses_review ON restaurant_responses(review_id);
```

---

### 15. `feature_suggestions`
Community-suggested features with voting.

```sql
CREATE TABLE feature_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  category ENUM('guest', 'restaurant', 'both') DEFAULT 'both',
  
  upvote_count INT DEFAULT 0,
  is_implemented BOOLEAN DEFAULT FALSE,
  implemented_date DATE,
  
  created_by_guest_id UUID REFERENCES guest_profiles(id) ON DELETE SET NULL,
  created_by_staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL,
  
  status ENUM('proposed', 'planned', 'in_progress', 'completed') DEFAULT 'proposed',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suggestions_status ON feature_suggestions(status);
CREATE INDEX idx_suggestions_upvotes ON feature_suggestions(upvote_count DESC);
```

---

### 16. `suggestions_votes`
Guest/staff votes on feature suggestions.

```sql
CREATE TABLE suggestions_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES feature_suggestions(id) ON DELETE CASCADE,
  
  voted_by_guest_id UUID REFERENCES guest_profiles(id) ON DELETE SET NULL,
  voted_by_staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_vote_per_user UNIQUE (suggestion_id, voted_by_guest_id, voted_by_staff_id)
);

CREATE INDEX idx_votes_suggestion ON suggestions_votes(suggestion_id);
```

---

### 17. `audit_log`
Audit trail for all critical actions.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  action ENUM(
    'order_placed', 'order_cancelled', 'menu_updated',
    'inventory_updated', 'review_posted', 'staff_login'
  ) NOT NULL,
  
  actor_type ENUM('guest', 'staff', 'system') DEFAULT 'system',
  actor_id UUID,  -- Reference to guest or staff
  
  resource_type VARCHAR(100),  -- 'order', 'meal', 'guest', etc.
  resource_id UUID,
  
  changes JSONB,  -- What changed: {before: {}, after: {}}
  ip_address INET,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_restaurant ON audit_log(restaurant_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);
```

---

## Relationships Summary

```
restaurants
  ├─ restaurant_staff (1:M)
  ├─ tables (1:M)
  ├─ menus (1:M)
  │  └─ meal_categories (1:M)
  │     └─ meals (1:M)
  │        ├─ meal_ingredients (1:M) ──── ingredients
  │        ├─ meal_addons (1:M)
  │        └─ guest_reviews (1:M)
  │           └─ restaurant_responses (1:M)
  ├─ guest_profiles (1:M)
  │  └─ orders (1:M)
  │     ├─ order_items (1:M) ──── meals
  │     └─ guest_reviews (1:M)
  └─ audit_log (1:M)

feature_suggestions ──── suggestions_votes (1:M)
```

---

## Indexes Summary

**High-traffic queries:**
- `idx_orders_status` — Kitchen display (what's cooking?)
- `idx_meals_available` — Menu display (what's available?)
- `idx_tables_qr_code` — QR scan lookup (instant)
- `idx_guest_profiles_phone` — Guest lookup
- `idx_order_items_order` — Order detail fetch

**Reporting queries:**
- `idx_orders_date` — Daily revenue reports
- `idx_audit_restaurant` — Security audit
- `idx_suggestions_upvotes` — Feature popularity

---

## Data Integrity Constraints

```sql
-- Restaurant cannot be deleted if it has active orders
ALTER TABLE restaurants ADD CONSTRAINT check_no_active_orders 
BEFORE DELETE DO ... (application-level trigger recommended)

-- Order total must match items sum
-- (enforced in application layer, not DB)

-- Payment date cannot be before placed_at
-- (enforced in application layer)
```

---

## Scalability Notes

### Now (100 restaurants, 5,000 orders/day)
- Single PostgreSQL instance
- Connection pooling (Redis)
- Indexes on high-traffic columns

### Later (1,000 restaurants, 50,000 orders/day)
- Partition `orders` table by `restaurant_id` or `placed_at`
- Replicate for read-heavy dashboards
- Archive old orders to cold storage (S3)

### Performance Targets
- Order insertion: < 100ms
- Menu load: < 200ms
- Order status update: < 50ms
- Analytics query: < 2 seconds

---

**Schema Version:** 1.0  
**Last Updated:** Sept 16, 2025  
**Status:** Ready for implementation  
**Database:** PostgreSQL 13+
