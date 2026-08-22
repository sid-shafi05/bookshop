
-- 1. SEED 1 ADMIN ACCOUNT (Since Admins cannot sign up publicly)
-- Default Password: 'password123'
-- --------------------------------------------------------------------
INSERT INTO users (user_id, username, email, password_hash, phone, role)
VALUES 
(99, 'superadmin', 'admin@bookstore.com', '$2b$10$wK1Wk907jP2Uv5mZ5gQ6p.7jR8f1G9tK3p4m1Q2W3E4R5T6Y7U8I9', '01999999999', 'admin')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO admins (admin_id) VALUES (99) ON CONFLICT (admin_id) DO NOTHING;


-- --------------------------------------------------------------------
-- 2. SEED CATEGORIES (GENRES)
-- --------------------------------------------------------------------
INSERT INTO categories (category_id, category_name) VALUES
(1, 'Fiction & Literature'),
(2, 'Self-Development'),
(3, 'Computer Science & Tech'),
(4, 'Sci-Fi & Fantasy'),
(5, 'Academic & Education'),
(6, 'Classics')
ON CONFLICT (category_id) DO NOTHING;


-- --------------------------------------------------------------------
-- 3. SEED AUTHORS
-- --------------------------------------------------------------------
INSERT INTO authors (author_id, name, bio, birth_date, nationality, photo_url) VALUES
(1, 'Humayun Ahmed', 'Legendary Bangladeshi author, dramatist, and filmmaker.', '1948-11-13', 'Bangladeshi', '/images/authors/humayun.jpg'),
(2, 'Saiful Islam', 'Lead instructor and founder of English Therapy.', '1990-05-15', 'Bangladeshi', '/images/authors/saiful.jpg'),
(3, 'George Orwell', 'English novelist, essayist, journalist, and critic.', '1903-06-25', 'British', '/images/authors/orwell.jpg'),
(4, 'Robert C. Martin', 'Software engineer and author of Agile Software Development.', '1952-12-05', 'American', '/images/authors/uncle_bob.jpg'),
(5, 'Homer', 'Ancient Greek author of the Iliad and the Odyssey.', NULL, 'Greek', '/images/authors/homer.jpg'),
(6, 'Muhammad Zafar Iqbal', 'Renowned Bangladeshi science fiction author and physicist.', '1952-12-23', 'Bangladeshi', '/images/authors/zafar_iqbal.jpg')
ON CONFLICT (author_id) DO NOTHING;


-- --------------------------------------------------------------------
-- 4. SEED PUBLISHERS
-- --------------------------------------------------------------------
INSERT INTO publishers (publisher_id, name, city, country, website_url, contact_info) VALUES
(1, 'Ananya Prokashoni', 'Dhaka', 'Bangladesh', 'https://ananyaprokashoni.com', 'info@ananya.com'),
(2, 'English Therapy Publications', 'Dhaka', 'Bangladesh', 'https://englishtherapy.net', 'contact@englishtherapy.net'),
(3, 'Signet Classics', 'New York', 'USA', 'https://penguinrandomhouse.com', 'support@signet.com'),
(4, 'Prentice Hall', 'Upper Saddle River', 'USA', 'https://pearson.com', 'contact@pearson.com'),
(5, 'Somoy Prokashon', 'Dhaka', 'Bangladesh', 'https://somoy.com', 'sales@somoy.com')
ON CONFLICT (publisher_id) DO NOTHING;


-- --------------------------------------------------------------------
-- 5. SEED BOOKS
-- --------------------------------------------------------------------
INSERT INTO books (book_id, title, isbn, description, price, stock_quantity, publication_year, cover_url, publisher_id) VALUES
(1, 'English Therapy', '978-984-95432-1-0', 'Comprehensive practical spoken English guide for non-native learners.', 499.00, 25, 2022, '/images/english-therapy.jpg', 2),
(2, 'The Odyssey', '978-0-14-026886-7', 'Epic Greek poem following Odysseus journey home after the fall of Troy.', 350.00, 15, 2018, '/images/odyssey.jpg', 3),
(3, 'Shonkhonil Karagar', '978-984-412-001-4', 'Acclaimed debut novel reflecting middle-class urban family life in Dhaka.', 220.00, 30, 1992, '/images/shonkhonil.jpg', 1),
(4, 'Misir Ali Omnibus 1', '978-984-412-055-7', 'Collection of classic psychological mystery stories featuring Misir Ali.', 750.00, 12, 2015, '/images/misir_ali.jpg', 1),
(5, 'Clean Code', '978-0-13-235088-4', 'A handbook of agile software craftsmanship and best programming practices.', 1450.00, 8, 2008, '/images/clean_code.jpg', 4),
(6, '1984', '978-0-452-28423-4', 'Classic dystopian social science fiction novel and cautionary tale about totalitarianism.', 380.00, 18, 2017, '/images/1984.jpg', 3),
(7, 'Tritiyo Matra', '978-984-456-022-1', 'Thrilling science fiction novel revolving around higher-dimensional physics.', 280.00, 20, 2004, '/images/tritiyo_matra.jpg', 5)
ON CONFLICT (book_id) DO NOTHING;


-- --------------------------------------------------------------------
-- 6. LINK BOOKS TO AUTHORS & CATEGORIES (Junction Tables)
-- --------------------------------------------------------------------
INSERT INTO book_authors (book_id, author_id) VALUES
(1, 2), (2, 5), (3, 1), (4, 1), (5, 4), (6, 3), (7, 6)
ON CONFLICT (book_id, author_id) DO NOTHING;

INSERT INTO book_categories (book_id, category_id) VALUES
(1, 2), (1, 5), (2, 1), (2, 6), (3, 1), (4, 1), (4, 4), (5, 3), (6, 1), (6, 4), (7, 4)
ON CONFLICT (book_id, category_id) DO NOTHING;


-- --------------------------------------------------------------------
-- 7. SEED PROMO COUPONS
-- --------------------------------------------------------------------
INSERT INTO coupons (coupon_id, code, discount_percent, expiry_date, min_order_amount, max_discount, is_active) VALUES
(1, 'EID2026', 15.00, '2026-12-31', 500.00, 200.00, TRUE),
(2, 'WELCOME10', 10.00, '2026-12-31', 300.00, 100.00, TRUE)
ON CONFLICT (coupon_id) DO NOTHING;


-- --------------------------------------------------------------------
-- SYNCHRONIZE SERIAL SEQUENCES
-- --------------------------------------------------------------------
SELECT setval('users_user_id_seq', (SELECT COALESCE(MAX(user_id), 1) FROM users));
SELECT setval('categories_category_id_seq', (SELECT COALESCE(MAX(category_id), 1) FROM categories));
SELECT setval('authors_author_id_seq', (SELECT COALESCE(MAX(author_id), 1) FROM authors));
SELECT setval('publishers_publisher_id_seq', (SELECT COALESCE(MAX(publisher_id), 1) FROM publishers));
SELECT setval('books_book_id_seq', (SELECT COALESCE(MAX(book_id), 1) FROM books));
SELECT setval('coupons_coupon_id_seq', (SELECT COALESCE(MAX(coupon_id), 1) FROM coupons));