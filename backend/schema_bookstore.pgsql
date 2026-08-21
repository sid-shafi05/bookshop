-- ====================================================================
-- CSE216 DATABASE SYSTEMS PROJECT: ONLINE BOOKSHOP SCHEMA
-- Target Database Engine: PostgreSQL
-- ====================================================================

-- --------------------------------------------------------------------
-- CLEANUP: Drop existing tables in reverse dependency order
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS returns CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
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
-- PART 1: CORE & METADATA ENTITIES
-- ====================================================================

-- 1. USERS (Superclass for authentication & base credentials)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
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
    CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin'))
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

-- 4. CATEGORIES (Genres)
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

-- 5. COUPONS (Discounts & Promo Codes)
CREATE TABLE coupons (
    coupon_id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_percent NUMERIC(5,2) NOT NULL,
    expiry_date DATE,
    min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_discount NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT coupon_discount_check CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT coupon_min_order_check CHECK (min_order_amount >= 0),
    CONSTRAINT coupon_max_discount_check CHECK (max_discount IS NULL OR max_discount >= 0)
);

-- 6. CUSTOMERS (Subclass of users)
CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 7. ADMINS (Subclass of users)
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
    publisher_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT books_price_check CHECK (price >= 0),
    CONSTRAINT books_stock_check CHECK (stock_quantity >= 0),
    CONSTRAINT books_year_check CHECK (publication_year IS NULL OR publication_year BETWEEN 1000 AND 2100),
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE SET NULL
);


-- ====================================================================
-- PART 2: JUNCTION TABLES & TRANSACTIONAL ENTITIES
-- ====================================================================

-- 9. BOOK_AUTHORS (Many-to-Many: Books <-> Authors)
CREATE TABLE book_authors (
    book_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
);

-- 10. BOOK_CATEGORIES (Many-to-Many: Books <-> Categories)
CREATE TABLE book_categories (
    book_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, category_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
);

-- 11. CARTS (1-to-1 with Customers)
CREATE TABLE carts (
    cart_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- 12. WISHLISTS (1-to-Many with Customers: Allows multiple named wishlists)
CREATE TABLE wishlists (
    wishlist_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    wishlist_name VARCHAR(100) NOT NULL DEFAULT 'My Wishlist',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_wishlist_name UNIQUE(customer_id,wishlist_name),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- 13. ORDERS
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    coupon_id INTEGER,
    order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
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

-- 14. CART_ITEMS (Many-to-Many: Carts <-> Books)
CREATE TABLE cart_items (
    cart_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (cart_id, book_id),
    CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- 15. WISHLIST_ITEMS (Many-to-Many: Wishlists <-> Books)
CREATE TABLE wishlist_items (
    wishlist_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wishlist_id, book_id),
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(wishlist_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- 16. ORDER_ITEMS (Many-to-Many: Orders <-> Books with price protection)
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

-- 17. REVIEWS (1 review per customer per book)
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

-- 18. NOTIFICATIONS (Personal user alerts)
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    topic VARCHAR(150),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 19. DELIVERIES (1-to-1 with Orders)
CREATE TABLE deliveries (
    delivery_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE,
    tracking_number VARCHAR(100) UNIQUE,
    shipping_method VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'preparing',
    delivery_date TIMESTAMP,
    delivery_house_no VARCHAR(50),
    delivery_street VARCHAR(200),
    delivery_city VARCHAR(100),
    delivery_postal_code VARCHAR(20),
    delivery_country VARCHAR(100),
    rider_name VARCHAR(150),
    rider_phone VARCHAR(30),
    CONSTRAINT delivery_status_check CHECK (status IN ('preparing','picked_up','in_transit','out_for_delivery','delivered','failed')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- 20. RETURNS (Item-level returns for damaged/defective books)
CREATE TABLE returns (
    return_id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'requested',
    refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT return_status_check CHECK (status IN ('requested','approved','rejected','processed')),
    CONSTRAINT return_refund_check CHECK (refund_amount >= 0),
    FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT
);


-- ====================================================================
-- PART 3: INDEXES (Performance Optimization)
-- ====================================================================
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_publisher ON books(publisher_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_book ON order_items(book_id);
CREATE INDEX idx_reviews_book ON reviews(book_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_book_authors_author ON book_authors(author_id);
CREATE INDEX idx_book_categories_category ON book_categories(category_id);