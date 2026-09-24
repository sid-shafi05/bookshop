-- ====================================================================
-- BOOKSTORE DATABASE SCHEMA (consolidated)
-- Target Database: bookstore (PostgreSQL)
--
-- This file merges the two earlier schema versions plus every later
-- migration (deliveryman roles, notification references, coupon usage
-- limits, registration invites, etc.) directly into the CREATE TABLE
-- statements. Run this once against a fresh database.
-- ====================================================================

-- --------------------------------------------------------------------
-- CLEANUP: Drop all existing tables in reverse dependency order
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS registration_invites CASCADE;
DROP TABLE IF EXISTS token_blacklist CASCADE;
DROP TABLE IF EXISTS returns CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS deliverymen CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS wishlist_items CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS book_categories CASCADE;
DROP TABLE IF EXISTS book_authors CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS publishers CASCADE;
DROP TABLE IF EXISTS authors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ====================================================================
-- PART 1: CORE ENTITIES & CATALOG
-- ====================================================================

-- 1. USERS (superclass for authentication & base info; customers, admins
--    and deliverymen all get a row here first, then a subclass row)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(100),
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    house_no VARCHAR(50),
    street VARCHAR(200),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin', 'deliveryman'))
);

-- 2. AUTHORS
CREATE TABLE authors (
    author_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    bio TEXT,
    birth_date DATE,
    nationality VARCHAR(100),
    photo_url VARCHAR(500) DEFAULT '/images/placeholder-author.jpg'
);

-- 3. PUBLISHERS
CREATE TABLE publishers (
    publisher_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    house_no VARCHAR(50),
    street VARCHAR(200),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    website_url VARCHAR(500),
    contact_info VARCHAR(150)
);

-- 4. CATEGORIES (genres). books.category was dropped in favor of the
--    book_categories many-to-many junction below, so this is the single
--    source of truth for category names.
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. COUPONS (discounts & promo codes)
CREATE TABLE coupons (
    coupon_id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_percent NUMERIC(5,2) NOT NULL,
    expiry_date DATE,
    min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_discount NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    usage_limit INTEGER,           -- NULL = unlimited uses
    times_used INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT coupon_discount_check CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT coupon_min_order_check CHECK (min_order_amount >= 0),
    CONSTRAINT coupon_max_discount_check CHECK (max_discount IS NULL OR max_discount >= 0),
    CONSTRAINT coupon_usage_limit_check CHECK (usage_limit IS NULL OR usage_limit > 0)
);

-- 6. CUSTOMERS (subclass of users)
CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 7. ADMINS (subclass of users)
CREATE TABLE admins (
    admin_id INTEGER PRIMARY KEY,
    FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 8. BOOKS
CREATE TABLE books (
    book_id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    isbn VARCHAR(30) UNIQUE,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    publication_year INTEGER,
    cover_url VARCHAR(500) DEFAULT '/images/placeholder-book.jpg',
    publisher_id INTEGER REFERENCES publishers(publisher_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT books_price_check CHECK (price >= 0),
    CONSTRAINT books_stock_check CHECK (stock_quantity >= 0),
    CONSTRAINT books_year_check CHECK (publication_year IS NULL OR publication_year BETWEEN 1000 AND 2100)
);

-- ====================================================================
-- PART 2: JUNCTION TABLES & SHOPPING CONTAINERS
-- ====================================================================

-- 9. BOOK_AUTHORS (many-to-many)
CREATE TABLE book_authors (
    book_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
);

-- 10. BOOK_CATEGORIES (many-to-many)
CREATE TABLE book_categories (
    book_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, category_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
);

-- 11. CARTS (1-to-1 with customers)
CREATE TABLE carts (
    cart_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- 12. WISHLISTS (1-to-many with customers: multiple named wishlists allowed)
CREATE TABLE wishlists (
    wishlist_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    wishlist_name VARCHAR(100) NOT NULL DEFAULT 'My Wishlist',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_wishlist_name UNIQUE (customer_id, wishlist_name),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- 13. CART_ITEMS (many-to-many: carts <-> books)
CREATE TABLE cart_items (
    cart_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (cart_id, book_id),
    CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- 14. WISHLIST_ITEMS (many-to-many: wishlists <-> books)
CREATE TABLE wishlist_items (
    wishlist_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wishlist_id, book_id),
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(wishlist_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- ====================================================================
-- PART 3: ORDERS, TRANSACTIONS & FULFILLMENT
-- ====================================================================

-- 15. ORDERS
--     Delivery assignment/status lives on the `deliveries` table
--     (deliveryman_id, status), not duplicated here, so there's one
--     source of truth for "who is delivering this and how far along".
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    coupon_id INTEGER,
    order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    shipping_house_no VARCHAR(50),
    shipping_street VARCHAR(200),
    shipping_city VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT orders_total_check CHECK (total_amount >= 0),
    CONSTRAINT orders_status_check CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','returned')),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id) ON DELETE SET NULL
);

-- 16. ORDER_ITEMS (many-to-many: orders <-> books)
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
    CONSTRAINT order_items_price_check CHECK (unit_price >= 0),
    CONSTRAINT unique_order_book UNIQUE (order_id, book_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE RESTRICT
);

-- 17. DELIVERYMEN (internal fleet delivery agents)
--     user_id links a deliveryman to their own login row in `users`
--     once they've accepted an invite (see registration_invites below).
CREATE TABLE deliverymen (
    deliveryman_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(user_id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    vehicle_type VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    invite_email VARCHAR(150),          -- email invited to, before users row exists
    invite_token VARCHAR(64) UNIQUE,
    invite_token_expires TIMESTAMP,
    invited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. DELIVERIES (1-to-1 with orders)
CREATE TABLE deliveries (
    delivery_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
    deliveryman_id INTEGER REFERENCES deliverymen(deliveryman_id) ON DELETE SET NULL,
    rider_name VARCHAR(100),   -- fallback for manual/non-fleet entry
    rider_phone VARCHAR(30),
    shipping_method VARCHAR(50),
    tracking_number VARCHAR(50) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'preparing',
    delivery_house_no VARCHAR(50),
    delivery_street VARCHAR(150),
    delivery_city VARCHAR(100),
    delivery_postal_code VARCHAR(20),
    delivery_country VARCHAR(100),
    delivery_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT delivery_status_check CHECK (status IN (
        'pending_acceptance','preparing','picked_up','in_transit',
        'out_for_delivery','delivered','failed','declined'
    ))
);

-- 19. RETURNS (item-level returns for damaged/defective books)
CREATE TABLE returns (
    return_id SERIAL PRIMARY KEY,
    order_item_id INTEGER,                 -- nullable: a return can reference the whole order
    order_id INTEGER REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'requested',
    condition VARCHAR(20) CHECK (condition IN ('resellable', 'damaged')),
    refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT return_status_check CHECK (status IN ('requested','approved','rejected','processed')),
    CONSTRAINT return_refund_check CHECK (refund_amount >= 0),
    FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT
);

-- 20. REVIEWS (1 review per customer per book)
CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    review_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_rating_check CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT one_review_per_customer UNIQUE (customer_id, book_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- 21. NOTIFICATIONS
--     Column names verified against utils/notify.js and routes/notifications.js:
--     every insert/select uses text + topic, not title/message/type.
--     reference_type/reference_id let the frontend deep-link straight to
--     the order/delivery/review a notification is about.
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    topic VARCHAR(50) NOT NULL DEFAULT 'general',
    reference_type VARCHAR(30),   -- 'order' | 'delivery' | 'review' etc.
    reference_id INTEGER,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 22. REGISTRATION_INVITES (invite-token based account setup, covers both
--     deliveryman and admin invites via the role column)
CREATE TABLE registration_invites (
    invite_id SERIAL PRIMARY KEY,
    token VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL,
    invited_name VARCHAR(150),
    role VARCHAR(20) NOT NULL CHECK (role IN ('deliveryman','admin')),
    deliveryman_id INTEGER REFERENCES deliverymen(deliveryman_id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. TOKEN_BLACKLIST (revoked auth tokens)
CREATE TABLE token_blacklist (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    blacklisted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- PART 4: INDEXES (performance optimization)
-- ====================================================================
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_publisher ON books(publisher_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_book ON order_items(book_id);
CREATE INDEX idx_reviews_book ON reviews(book_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);
CREATE INDEX idx_book_authors_author ON book_authors(author_id);
CREATE INDEX idx_book_categories_category ON book_categories(category_id);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
CREATE INDEX idx_deliveries_deliveryman ON deliveries(deliveryman_id);
CREATE INDEX idx_token_blacklist ON token_blacklist(token);
CREATE INDEX idx_registration_invites_token ON registration_invites(token);

-- ====================================================================
-- PART 5 (OPTIONAL): CLEANUP OF DEAD TABLES ON THE LIVE DATABASE
-- None of these are created above and none are referenced by any route
-- in backend/routes or backend/utils — safe to drop from the live DB.
--   - delivery_profiles: not in any schema file or any query anywhere
--   - deliveryman_invites: superseded by registration_invites; auth.js
--     never queries this table
--   - user_invites: not even defined in any schema file; no code touches it
-- Uncomment to run against the live database:
-- ====================================================================
-- DROP TABLE IF EXISTS delivery_profiles CASCADE;
-- DROP TABLE IF EXISTS deliveryman_invites CASCADE;
-- DROP TABLE IF EXISTS user_invites CASCADE;