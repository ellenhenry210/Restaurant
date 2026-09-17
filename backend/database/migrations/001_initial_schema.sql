-- 001_initial_schema.sql
--
-- Initial SnapOrder schema, translated from SNAPORDER_DATABASE_SCHEMA.md
-- (v1.2) into real, runnable PostgreSQL.
--
-- Two deliberate deviations from that doc, both fixing real bugs rather
-- than just following it literally — see the migration's commit message
-- and the doc itself (updated alongside this file) for the reasoning:
--   1. Every `ENUM(...)` column becomes VARCHAR + a named CHECK constraint.
--      Postgres has no MySQL-style inline ENUM(...) syntax — the doc's SQL
--      would not have run as-is. VARCHAR+CHECK is also easier to evolve
--      than a native Postgres ENUM type (no ALTER TYPE gymnastics), which
--      matters here since the role values have already been renamed once.
--   2. `guest_reviews.rating` gets a CHECK (1-5), and
--      `suggestions_votes` gets two partial unique indexes instead of one
--      three-column UNIQUE constraint, because Postgres treats NULL as
--      distinct from NULL in uniqueness checks — the original constraint
--      would silently have allowed the same guest to vote twice.
--
-- gen_random_uuid() is built into Postgres core since v13 (no pgcrypto
-- extension needed) — matches docker-compose.yml's postgres:15-alpine.

-- ============================================================
-- 1. restaurants
-- ============================================================
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
  registration_number VARCHAR(50) UNIQUE,
  tax_id VARCHAR(50),

  -- Customization (white-label)
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  custom_domain VARCHAR(255),

  -- Billing
  plan_type VARCHAR(20) DEFAULT 'free',
  subscription_start_date DATE,
  subscription_end_date DATE,

  -- Operational
  timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_restaurants_plan_type CHECK (plan_type IN ('free', 'basic', 'premium', 'enterprise')),
  CONSTRAINT valid_colors CHECK (
    (primary_color ~* '^#[0-9A-Fa-f]{6}$' OR primary_color IS NULL)
    AND (secondary_color ~* '^#[0-9A-Fa-f]{6}$' OR secondary_color IS NULL)
  )
);

CREATE INDEX idx_restaurants_email ON restaurants(email);
CREATE INDEX idx_restaurants_custom_domain ON restaurants(custom_domain);

-- ============================================================
-- 2. restaurant_staff
-- ============================================================
CREATE TABLE restaurant_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),

  role VARCHAR(20) NOT NULL,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_restaurant_email UNIQUE (restaurant_id, email),
  CONSTRAINT chk_staff_role CHECK (role IN ('waiter', 'kitchen_staff', 'manager', 'owner'))
);

CREATE INDEX idx_staff_restaurant ON restaurant_staff(restaurant_id);
CREATE INDEX idx_staff_role ON restaurant_staff(restaurant_id, role);

-- ============================================================
-- 3. tables (physical restaurant tables)
-- ============================================================
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  table_number INT NOT NULL,
  qr_code_unique_id VARCHAR(100) NOT NULL,
  qr_code_url TEXT,

  capacity INT,
  location VARCHAR(255),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_table_number UNIQUE (restaurant_id, table_number),
  CONSTRAINT unique_qr_code UNIQUE (qr_code_unique_id)
);

CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX idx_tables_qr_code ON tables(qr_code_unique_id);

-- ============================================================
-- 4. menus
-- ============================================================
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  active_from TIME,
  active_until TIME,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_menus_restaurant ON menus(restaurant_id);
CREATE INDEX idx_menus_active ON menus(restaurant_id, is_active);

-- ============================================================
-- 5. meal_categories
-- ============================================================
CREATE TABLE meal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_emoji VARCHAR(10),
  sort_order INT DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_menu ON meal_categories(menu_id);

-- ============================================================
-- 6. meals
-- ============================================================
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES meal_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,

  -- Pricing
  base_price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',

  -- Nutritional info
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
  is_low_calorie BOOLEAN DEFAULT FALSE,
  is_high_protein BOOLEAN DEFAULT FALSE,

  -- Availability
  is_available BOOLEAN DEFAULT TRUE,
  estimated_prep_time_minutes INT,

  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meals_category ON meals(category_id);
CREATE INDEX idx_meals_restaurant ON meals(restaurant_id);
CREATE INDEX idx_meals_available ON meals(restaurant_id, is_available);
CREATE INDEX idx_meals_health_tags ON meals(is_vegan, is_vegetarian, is_gluten_free);

-- ============================================================
-- 7. ingredients
-- ============================================================
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,

  -- Allergen info
  allergen_type VARCHAR(20) DEFAULT 'none',
  is_allergen BOOLEAN DEFAULT FALSE,

  -- Stock tracking
  current_stock INT DEFAULT 0,
  unit_of_measure VARCHAR(50),
  reorder_level INT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_ingredients_allergen_type CHECK (allergen_type IN (
    'peanuts', 'tree_nuts', 'shellfish', 'fish',
    'milk', 'eggs', 'soy', 'wheat', 'sesame',
    'sulfites', 'mustard', 'celery', 'none'
  ))
);

CREATE INDEX idx_ingredients_restaurant ON ingredients(restaurant_id);
CREATE INDEX idx_ingredients_allergen ON ingredients(allergen_type);

-- ============================================================
-- 8. meal_ingredients (allergen removal policy lives here —
-- see SNAPORDER_AUTHORIZATION.md Part 3)
-- ============================================================
CREATE TABLE meal_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,

  removal_policy VARCHAR(20) DEFAULT 'can_remove',
  removal_policy_reason TEXT,
  is_required BOOLEAN DEFAULT FALSE,

  quantity DECIMAL(8, 2),
  unit_of_measure VARCHAR(50),

  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_meal_ingredient UNIQUE (meal_id, ingredient_id),
  CONSTRAINT chk_meal_ingredients_removal_policy CHECK (removal_policy IN ('can_remove', 'caution', 'cannot_remove'))
);

CREATE INDEX idx_meal_ingredients_meal ON meal_ingredients(meal_id);

-- ============================================================
-- 9. meal_addons
-- ============================================================
CREATE TABLE meal_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  additional_price DECIMAL(10, 2) NOT NULL,
  max_quantity INT DEFAULT 1,

  is_available BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addons_meal ON meal_addons(meal_id);

-- ============================================================
-- 10. guest_profiles
-- ============================================================
CREATE TABLE guest_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  phone_number VARCHAR(20) NOT NULL,
  guest_name VARCHAR(255),

  allergies TEXT[],
  health_goals TEXT[],

  is_vegan BOOLEAN DEFAULT FALSE,
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_gluten_free BOOLEAN DEFAULT FALSE,

  spice_level VARCHAR(10) DEFAULT 'medium',

  total_orders INT DEFAULT 0,
  last_order_at TIMESTAMP,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_guest_per_restaurant UNIQUE (restaurant_id, phone_number),
  CONSTRAINT chk_guest_profiles_spice_level CHECK (spice_level IN ('mild', 'medium', 'hot'))
);

CREATE INDEX idx_guest_profiles_phone ON guest_profiles(phone_number);
CREATE INDEX idx_guest_profiles_restaurant ON guest_profiles(restaurant_id);

-- ============================================================
-- 11. orders
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE SET NULL,
  guest_profile_id UUID REFERENCES guest_profiles(id) ON DELETE SET NULL,

  order_number VARCHAR(50) UNIQUE NOT NULL,

  status VARCHAR(20) DEFAULT 'placed',

  -- Timing
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  ready_at TIMESTAMP,
  served_at TIMESTAMP,
  cancelled_at TIMESTAMP,

  estimated_ready_time INT,

  -- Pricing
  subtotal DECIMAL(10, 2),
  tax DECIMAL(10, 2),
  service_charge DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'NGN',

  -- Payment
  payment_status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20) DEFAULT 'cash',
  payment_reference VARCHAR(255),

  -- Tipping
  tip_amount DECIMAL(10, 2),

  -- Special notes
  special_requests TEXT,
  allergen_warnings TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_orders_status CHECK (status IN ('placed', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')),
  CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('pending', 'completed', 'failed')),
  CONSTRAINT chk_orders_payment_method CHECK (payment_method IN ('card', 'bank_transfer', 'mobile_money', 'cash'))
);

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_date ON orders(placed_at);
CREATE INDEX idx_orders_guest ON orders(guest_profile_id);

-- ============================================================
-- 12. order_items
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id),

  meal_name VARCHAR(255),
  meal_price DECIMAL(10, 2),
  quantity INT DEFAULT 1,

  -- Customization snapshot
  removed_ingredients UUID[],
  allergen_caution_acknowledged BOOLEAN DEFAULT FALSE,
  added_addons UUID[],
  special_request TEXT,

  status VARCHAR(20) DEFAULT 'pending',

  prepared_by_staff_id UUID REFERENCES restaurant_staff(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_order_items_status CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled'))
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_meal ON order_items(meal_id);

-- ============================================================
-- 13. guest_reviews
-- ============================================================
CREATE TABLE guest_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  guest_profile_id UUID NOT NULL REFERENCES guest_profiles(id) ON DELETE CASCADE,

  rating INT NOT NULL,
  review_text TEXT,
  photo_url TEXT,

  has_allergen_issue BOOLEAN DEFAULT FALSE,
  allergen_issue_description TEXT,

  helpful_count INT DEFAULT 0,

  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Fix vs. the doc: "1-5 stars" was only a comment, not enforced.
  CONSTRAINT chk_guest_reviews_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX idx_reviews_meal ON guest_reviews(meal_id);
CREATE INDEX idx_reviews_guest ON guest_reviews(guest_profile_id);
CREATE INDEX idx_reviews_public ON guest_reviews(is_public);

-- ============================================================
-- 14. restaurant_responses
-- ============================================================
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

-- ============================================================
-- 15. feature_suggestions
-- ============================================================
CREATE TABLE feature_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title VARCHAR(255) NOT NULL,
  description TEXT,

  category VARCHAR(20) DEFAULT 'both',

  upvote_count INT DEFAULT 0,
  is_implemented BOOLEAN DEFAULT FALSE,
  implemented_date DATE,

  created_by_guest_id UUID REFERENCES guest_profiles(id) ON DELETE SET NULL,
  created_by_staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL,

  status VARCHAR(20) DEFAULT 'proposed',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_suggestions_category CHECK (category IN ('guest', 'restaurant', 'both')),
  CONSTRAINT chk_suggestions_status CHECK (status IN ('proposed', 'planned', 'in_progress', 'completed'))
);

CREATE INDEX idx_suggestions_status ON feature_suggestions(status);
CREATE INDEX idx_suggestions_upvotes ON feature_suggestions(upvote_count DESC);

-- ============================================================
-- 16. suggestions_votes
-- ============================================================
CREATE TABLE suggestions_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES feature_suggestions(id) ON DELETE CASCADE,

  voted_by_guest_id UUID REFERENCES guest_profiles(id) ON DELETE SET NULL,
  voted_by_staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- A vote must be attributable to exactly one of guest/staff, never both
  -- or neither (the doc didn't state this explicitly, but the two
  -- FK columns only make sense as an either/or pair).
  CONSTRAINT chk_vote_single_voter CHECK (
    (voted_by_guest_id IS NOT NULL AND voted_by_staff_id IS NULL)
    OR (voted_by_guest_id IS NULL AND voted_by_staff_id IS NOT NULL)
  )
);

CREATE INDEX idx_votes_suggestion ON suggestions_votes(suggestion_id);

-- Replaces the doc's single 3-column UNIQUE constraint: Postgres treats
-- NULL as distinct from NULL, so that constraint would never actually
-- have blocked a guest (or staff member) from voting twice on the same
-- suggestion. Two partial unique indexes fix this for real.
CREATE UNIQUE INDEX unique_guest_vote_per_suggestion
  ON suggestions_votes(suggestion_id, voted_by_guest_id)
  WHERE voted_by_guest_id IS NOT NULL;

CREATE UNIQUE INDEX unique_staff_vote_per_suggestion
  ON suggestions_votes(suggestion_id, voted_by_staff_id)
  WHERE voted_by_staff_id IS NOT NULL;

-- ============================================================
-- 17. audit_log
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  action VARCHAR(30) NOT NULL,

  actor_type VARCHAR(10) DEFAULT 'system',
  actor_id UUID,

  resource_type VARCHAR(100),
  resource_id UUID,

  changes JSONB,
  ip_address INET,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_audit_action CHECK (action IN (
    'order_placed', 'order_cancelled', 'menu_updated',
    'inventory_updated', 'review_posted', 'staff_login',
    'authz_denied'
  )),
  CONSTRAINT chk_audit_actor_type CHECK (actor_type IN ('guest', 'staff', 'system'))
);

CREATE INDEX idx_audit_restaurant ON audit_log(restaurant_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- ============================================================
-- 18. shifts
-- ============================================================
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES restaurant_staff(id) ON DELETE CASCADE,

  clock_in TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clock_out TIMESTAMP,

  role_during_shift VARCHAR(20) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_shift_times CHECK (clock_out IS NULL OR clock_out > clock_in),
  CONSTRAINT chk_shifts_role CHECK (role_during_shift IN ('waiter', 'kitchen_staff', 'manager', 'owner'))
);

CREATE INDEX idx_shifts_staff ON shifts(staff_id);
CREATE INDEX idx_shifts_restaurant_active ON shifts(restaurant_id) WHERE clock_out IS NULL;
CREATE UNIQUE INDEX unique_active_shift_per_staff ON shifts(staff_id) WHERE clock_out IS NULL;
