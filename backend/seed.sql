-- ====================================================================
-- BOOKHARBOR DUMMY SEED DATA
-- ====================================================================
-- Assumes a fresh database with SERIAL IDs starting from 1.
-- ====================================================================


-- ====================================================================
-- 1. AUTHORS
-- ====================================================================

INSERT INTO authors (name, bio, birth_date, nationality)
VALUES
('George Orwell',
 'English novelist and essayist.',
 '1903-06-25',
 'British'),

('Jane Austen',
 'English novelist known for her social commentary.',
 '1775-12-16',
 'British'),

('J.K. Rowling',
 'British author best known for the Harry Potter series.',
 '1965-07-31',
 'British'),

('Isaac Asimov',
 'American writer and professor of biochemistry.',
 '1920-01-02',
 'American'),

('Agatha Christie',
 'English writer famous for detective fiction.',
 '1890-09-15',
 'British'),

('J.R.R. Tolkien',
 'English writer and philologist.',
 '1892-01-03',
 'British'),

('Yuval Noah Harari',
 'Historian and author of books on human history.',
 '1976-02-24',
 'Israeli'),

('Robert C. Martin',
 'Software engineer and author of programming books.',
 '1952-12-05',
 'American');


-- ====================================================================
-- 2. PUBLISHERS
-- ====================================================================

INSERT INTO publishers
(name, city, country, website_url)
VALUES
('Penguin Books',
 'London',
 'United Kingdom',
 'https://www.penguin.co.uk'),

('HarperCollins',
 'New York',
 'United States',
 'https://www.harpercollins.com'),

('Bloomsbury Publishing',
 'London',
 'United Kingdom',
 'https://www.bloomsbury.com'),

('Oxford University Press',
 'Oxford',
 'United Kingdom',
 'https://global.oup.com'),

('Random House',
 'New York',
 'United States',
 'https://www.penguinrandomhouse.com');


-- ====================================================================
-- 3. CATEGORIES
-- ====================================================================

INSERT INTO categories (category_name)
VALUES
('Fiction'),
('Fantasy'),
('Science Fiction'),
('Mystery'),
('History'),
('Technology'),
('Classics'),
('Adventure');


-- ====================================================================
-- 4. BOOKS
-- ====================================================================

INSERT INTO books
(title, isbn, description, price, stock_quantity, publication_year, cover_url, publisher_id)
VALUES

(
 '1984',
 '9780451524935',
 'A dystopian novel about surveillance, propaganda, and authoritarian government.',
 550.00,
 25,
 1949,
 'https://placehold.co/300x450?text=1984',
 1
),

(
 'Pride and Prejudice',
 '9780141439518',
 'A classic novel exploring relationships, society, and personal misunderstandings.',
 480.00,
 20,
 1813,
 'https://placehold.co/300x450?text=Pride+and+Prejudice',
 1
),

(
 'Harry Potter and the Philosopher''s Stone',
 '9780747532699',
 'A young wizard begins his journey at Hogwarts School of Witchcraft and Wizardry.',
 750.00,
 30,
 1997,
 'https://placehold.co/300x450?text=Harry+Potter',
 3
),

(
 'Foundation',
 '9780553293357',
 'A science fiction story about mathematics, prediction, and the fall of a galactic empire.',
 680.00,
 18,
 1951,
 'https://placehold.co/300x450?text=Foundation',
 2
),

(
 'Murder on the Orient Express',
 '9780062693662',
 'Detective Hercule Poirot investigates a murder aboard a luxury train.',
 620.00,
 22,
 1934,
 'https://placehold.co/300x450?text=Orient+Express',
 2
),

(
 'The Hobbit',
 '9780547928227',
 'Bilbo Baggins joins a dangerous adventure to reclaim a lost dwarven kingdom.',
 720.00,
 27,
 1937,
 'https://placehold.co/300x450?text=The+Hobbit',
 3
),

(
 'Sapiens',
 '9780062316097',
 'A broad history of humankind from early humans to the modern world.',
 950.00,
 15,
 2011,
 'https://placehold.co/300x450?text=Sapiens',
 5
),

(
 'Clean Code',
 '9780132350884',
 'A practical guide to writing readable, maintainable, and professional software.',
 1250.00,
 12,
 2008,
 'https://placehold.co/300x450?text=Clean+Code',
 4
),

(
 'The Lord of the Rings',
 '9780261102385',
 'An epic fantasy journey across Middle-earth to destroy the One Ring.',
 1100.00,
 14,
 1954,
 'https://placehold.co/300x450?text=Lord+of+the+Rings',
 3
),

(
 'The Time Machine',
 '9780451530707',
 'A scientist travels into the distant future and encounters an unfamiliar world.',
 530.00,
 21,
 1895,
 'https://placehold.co/300x450?text=The+Time+Machine',
 1
);


-- ====================================================================
-- 5. BOOK_AUTHORS
-- ====================================================================

INSERT INTO book_authors (book_id, author_id)
VALUES
(1, 1),  -- 1984 -> George Orwell
(2, 2),  -- Pride and Prejudice -> Jane Austen
(3, 3),  -- Harry Potter -> J.K. Rowling
(4, 4),  -- Foundation -> Isaac Asimov
(5, 5),  -- Murder on the Orient Express -> Agatha Christie
(6, 6),  -- The Hobbit -> J.R.R. Tolkien
(7, 7),  -- Sapiens -> Yuval Noah Harari
(8, 8),  -- Clean Code -> Robert C. Martin
(9, 6),  -- Lord of the Rings -> J.R.R. Tolkien
(10, 4); -- The Time Machine -> Isaac Asimov


-- ====================================================================
-- 6. BOOK_CATEGORIES
-- ====================================================================

INSERT INTO book_categories (book_id, category_id)
VALUES

(1, 1),  -- 1984 -> Fiction
(1, 7),  -- 1984 -> Classics

(2, 1),  -- Pride and Prejudice -> Fiction
(2, 7),  -- Pride and Prejudice -> Classics

(3, 2),  -- Harry Potter -> Fantasy
(3, 1),  -- Harry Potter -> Fiction

(4, 3),  -- Foundation -> Science Fiction
(4, 1),  -- Foundation -> Fiction

(5, 4),  -- Murder on the Orient Express -> Mystery
(5, 1),  -- Murder -> Fiction

(6, 2),  -- The Hobbit -> Fantasy
(6, 8),  -- The Hobbit -> Adventure

(7, 5),  -- Sapiens -> History

(8, 6),  -- Clean Code -> Technology

(9, 2),  -- Lord of the Rings -> Fantasy
(9, 8),  -- Lord of the Rings -> Adventure

(10, 3), -- The Time Machine -> Science Fiction
(10, 8), -- The Time Machine -> Adventure
(10, 7); -- The Time Machine -> Classics


-- ====================================================================
-- DONE
-- ====================================================================

-- Optional verification:

SELECT * FROM authors;
SELECT * FROM publishers;
SELECT * FROM categories;
SELECT * FROM books;
SELECT * FROM book_authors;
SELECT * FROM book_categories;



BEGIN;

UPDATE users
SET role = 'admin'
WHERE email = 'YOUR_EMAIL@example.com'
RETURNING user_id, username, name, email, role;

INSERT INTO admins (admin_id)
SELECT user_id
FROM users
WHERE email = 'YOUR_EMAIL@example.com'
  AND role = 'admin'
ON CONFLICT (admin_id) DO NOTHING;

COMMIT;

-- ====================================================================
-- BOOKHARBOR EXTRA DUMMY SEED DATA (for pagination / bulk testing)
-- ====================================================================
-- Safe to run AFTER the original seed file. Uses name-based subqueries
-- instead of hardcoded IDs, so it doesn't matter what numeric IDs your
-- existing rows landed on.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. EXTRA AUTHORS (30)
-- ====================================================================

INSERT INTO authors (name, bio, birth_date, nationality)
VALUES
('Mark Twain', 'American writer known for wit and social critique.', '1835-11-30', 'American'),
('Charles Dickens', 'English writer famous for vivid characters and social commentary.', '1812-02-07', 'British'),
('Leo Tolstoy', 'Russian author of epic realist novels.', '1828-09-09', 'Russian'),
('Fyodor Dostoevsky', 'Russian novelist exploring psychology and morality.', '1821-11-11', 'Russian'),
('Ernest Hemingway', 'American novelist known for a spare, direct prose style.', '1899-07-21', 'American'),
('Virginia Woolf', 'English modernist writer and essayist.', '1882-01-25', 'British'),
('F. Scott Fitzgerald', 'American novelist of the Jazz Age.', '1896-09-24', 'American'),
('Franz Kafka', 'German-language writer known for surreal, alienating fiction.', '1883-07-03', 'Austro-Hungarian'),
('Gabriel Garcia Marquez', 'Colombian novelist, master of magical realism.', '1927-03-06', 'Colombian'),
('Toni Morrison', 'American novelist exploring race and identity.', '1931-02-18', 'American'),
('Haruki Murakami', 'Japanese author known for surreal, genre-blending fiction.', '1949-01-12', 'Japanese'),
('Margaret Atwood', 'Canadian author known for speculative fiction.', '1939-11-18', 'Canadian'),
('Stephen King', 'American author known for horror and suspense.', '1947-09-21', 'American'),
('Neil Gaiman', 'British author of fantasy and graphic novels.', '1960-11-10', 'British'),
('Terry Pratchett', 'British author known for satirical fantasy.', '1948-04-28', 'British'),
('Philip K. Dick', 'American science fiction writer.', '1928-12-16', 'American'),
('Ray Bradbury', 'American author of speculative fiction.', '1920-08-22', 'American'),
('Arthur C. Clarke', 'British science fiction writer and futurist.', '1917-12-16', 'British'),
('Ursula K. Le Guin', 'American author of speculative fiction.', '1929-10-21', 'American'),
('Kazuo Ishiguro', 'British novelist known for restrained, introspective prose.', '1954-11-08', 'British'),
('Chimamanda Ngozi Adichie', 'Nigerian author known for contemporary fiction.', '1977-09-15', 'Nigerian'),
('Malcolm Gladwell', 'Canadian journalist and non-fiction author.', '1963-09-03', 'Canadian'),
('Michelle Obama', 'American author and former First Lady.', '1964-01-17', 'American'),
('Walter Isaacson', 'American writer known for biographies.', '1952-05-20', 'American'),
('Carl Sagan', 'American astronomer and science communicator.', '1934-11-09', 'American'),
('Stephen Hawking', 'British theoretical physicist and author.', '1942-01-08', 'British'),
('Dale Carnegie', 'American writer and lecturer on self-improvement.', '1888-11-24', 'American'),
('James Clear', 'American author known for writing on habits and self-improvement.', '1986-01-22', 'American'),
('Martin Fowler', 'British software engineer and author.', '1963-12-18', 'British'),
('Andy Weir', 'American novelist known for science-heavy fiction.', '1972-06-16', 'American');


-- ====================================================================
-- 2. EXTRA PUBLISHERS (10)
-- ====================================================================

INSERT INTO publishers (name, city, country, website_url)
VALUES
('Simon & Schuster', 'New York', 'United States', 'https://www.simonandschuster.com'),
('Macmillan Publishers', 'London', 'United Kingdom', 'https://www.macmillan.com'),
('Hachette Book Group', 'New York', 'United States', 'https://www.hachettebookgroup.com'),
('Vintage Books', 'New York', 'United States', 'https://www.vintagebooks.com'),
('Faber and Faber', 'London', 'United Kingdom', 'https://www.faber.co.uk'),
('Scholastic', 'New York', 'United States', 'https://www.scholastic.com'),
('Orbit Books', 'London', 'United Kingdom', 'https://www.orbitbooks.net'),
('O''Reilly Media', 'Sebastopol', 'United States', 'https://www.oreilly.com'),
('Del Rey', 'New York', 'United States', 'https://www.penguinrandomhouse.com'),
('Canongate Books', 'Edinburgh', 'United Kingdom', 'https://canongate.co.uk');


-- ====================================================================
-- 3. EXTRA CATEGORIES (6)
-- ====================================================================

INSERT INTO categories (category_name)
VALUES
('Romance'),
('Horror'),
('Biography'),
('Business'),
('Poetry'),
('Children''s Books');


-- ====================================================================
-- 4. EXTRA BOOKS (60)
-- ====================================================================

INSERT INTO books
(title, isbn, description, price, stock_quantity, publication_year, cover_url, publisher_id)
VALUES

('The Adventures of Huckleberry Finn', '9780486280615', 'A boy and an escaped slave raft down the Mississippi River.', 420.00, 19, 1884, 'https://placehold.co/300x450?text=Huckleberry+Finn', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('A Tale of Two Cities', '9780141439600', 'A story of love and sacrifice set against the French Revolution.', 460.00, 17, 1859, 'https://placehold.co/300x450?text=Two+Cities', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('Great Expectations', '9780141439563', 'An orphan''s rise in society and the mysterious benefactor who funds it.', 470.00, 16, 1861, 'https://placehold.co/300x450?text=Great+Expectations', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('Anna Karenina', '9780143035008', 'A tragic love story set in Imperial Russian society.', 690.00, 14, 1877, 'https://placehold.co/300x450?text=Anna+Karenina', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('War and Peace', '9781400079988', 'An epic chronicle of Russian society during the Napoleonic era.', 990.00, 10, 1869, 'https://placehold.co/300x450?text=War+and+Peace', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('Crime and Punishment', '9780486415871', 'A poor student wrestles with guilt after committing murder.', 520.00, 18, 1866, 'https://placehold.co/300x450?text=Crime+and+Punishment', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('The Brothers Karamazov', '9780374528379', 'A philosophical novel about faith, doubt, and family.', 780.00, 11, 1880, 'https://placehold.co/300x450?text=Brothers+Karamazov', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('The Old Man and the Sea', '9780684801223', 'An aging fisherman''s battle with a giant marlin.', 380.00, 23, 1952, 'https://placehold.co/300x450?text=Old+Man+and+Sea', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('A Farewell to Arms', '9780684801469', 'A love story set against the backdrop of World War I.', 500.00, 15, 1929, 'https://placehold.co/300x450?text=Farewell+to+Arms', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('Mrs Dalloway', '9780156628709', 'A day in the life of a woman preparing for a party in post-war London.', 440.00, 13, 1925, 'https://placehold.co/300x450?text=Mrs+Dalloway', (SELECT publisher_id FROM publishers WHERE name = 'Hachette Book Group')),
('To the Lighthouse', '9780156907392', 'A modernist exploration of family and memory over time.', 450.00, 12, 1927, 'https://placehold.co/300x450?text=To+the+Lighthouse', (SELECT publisher_id FROM publishers WHERE name = 'Hachette Book Group')),
('The Great Gatsby', '9780743273565', 'A story of wealth, obsession, and the American Dream in the Jazz Age.', 490.00, 24, 1925, 'https://placehold.co/300x450?text=Great+Gatsby', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('The Metamorphosis', '9780553213690', 'A man wakes up transformed into a giant insect.', 350.00, 20, 1915, 'https://placehold.co/300x450?text=Metamorphosis', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('The Trial', '9780805209990', 'A man is arrested and prosecuted by a mysterious, inaccessible authority.', 420.00, 14, 1925, 'https://placehold.co/300x450?text=The+Trial', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('One Hundred Years of Solitude', '9780060883287', 'The multigenerational saga of the Buendia family in Macondo.', 610.00, 16, 1967, 'https://placehold.co/300x450?text=100+Years+Solitude', (SELECT publisher_id FROM publishers WHERE name = 'HarperCollins')),
('Love in the Time of Cholera', '9780307389732', 'A decades-long story of love, patience, and obsession.', 580.00, 13, 1985, 'https://placehold.co/300x450?text=Love+in+Time+Cholera', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('Beloved', '9781400033416', 'A former slave is haunted by the trauma of her past.', 540.00, 15, 1987, 'https://placehold.co/300x450?text=Beloved', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('Norwegian Wood', '9780375704024', 'A nostalgic story of loss and burgeoning sexuality in 1960s Tokyo.', 560.00, 17, 1987, 'https://placehold.co/300x450?text=Norwegian+Wood', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('Kafka on the Shore', '9781400079278', 'A surreal, dual narrative blending fantasy and reality.', 600.00, 12, 2002, 'https://placehold.co/300x450?text=Kafka+on+Shore', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('The Handmaid''s Tale', '9780385490818', 'A dystopian novel set in a totalitarian, patriarchal society.', 570.00, 21, 1985, 'https://placehold.co/300x450?text=Handmaids+Tale', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('Oryx and Crake', '9780385721677', 'A speculative story of genetic engineering and civilizational collapse.', 590.00, 12, 2003, 'https://placehold.co/300x450?text=Oryx+and+Crake', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('The Shining', '9780307743657', 'A family is stationed at an isolated hotel with a malevolent past.', 500.00, 19, 1977, 'https://placehold.co/300x450?text=The+Shining', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('It', '9781501142970', 'A group of friends confronts an ancient evil in their town.', 750.00, 15, 1986, 'https://placehold.co/300x450?text=It', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('Misery', '9781501143106', 'A novelist is held captive by his "number one fan".', 480.00, 16, 1987, 'https://placehold.co/300x450?text=Misery', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('American Gods', '9780380973651', 'Old gods and new gods clash across modern America.', 620.00, 14, 2001, 'https://placehold.co/300x450?text=American+Gods', (SELECT publisher_id FROM publishers WHERE name = 'HarperCollins')),
('Good Omens', '9780060853976', 'An angel and a demon team up to stop the apocalypse.', 540.00, 18, 1990, 'https://placehold.co/300x450?text=Good+Omens', (SELECT publisher_id FROM publishers WHERE name = 'HarperCollins')),
('The Colour of Magic', '9780062225672', 'A wizard and a hapless tourist adventure across Discworld.', 470.00, 17, 1983, 'https://placehold.co/300x450?text=Colour+of+Magic', (SELECT publisher_id FROM publishers WHERE name = 'Orbit Books')),
('Guards! Guards!', '9780062225801', 'The City Watch of Ankh-Morpork faces a dragon summoned by a secret society.', 480.00, 15, 1989, 'https://placehold.co/300x450?text=Guards+Guards', (SELECT publisher_id FROM publishers WHERE name = 'Orbit Books')),
('Do Androids Dream of Electric Sheep?', '9780345404473', 'A bounty hunter tracks down rogue androids in a post-apocalyptic future.', 530.00, 16, 1968, 'https://placehold.co/300x450?text=Electric+Sheep', (SELECT publisher_id FROM publishers WHERE name = 'Del Rey')),
('The Man in the High Castle', '9780547572482', 'An alternate history where the Axis powers won World War II.', 550.00, 14, 1962, 'https://placehold.co/300x450?text=High+Castle', (SELECT publisher_id FROM publishers WHERE name = 'HarperCollins')),
('Fahrenheit 451', '9781451673319', 'A fireman in a future society where books are outlawed and burned.', 460.00, 22, 1953, 'https://placehold.co/300x450?text=Fahrenheit+451', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('The Martian Chronicles', '9781451678192', 'A series of interlinked stories chronicling the colonization of Mars.', 470.00, 15, 1950, 'https://placehold.co/300x450?text=Martian+Chronicles', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('Childhood''s End', '9780345347954', 'Benevolent aliens transform human civilization under mysterious motives.', 500.00, 13, 1953, 'https://placehold.co/300x450?text=Childhoods+End', (SELECT publisher_id FROM publishers WHERE name = 'Del Rey')),
('2001: A Space Odyssey', '9780451457998', 'Humanity encounters an ancient alien intelligence in deep space.', 520.00, 17, 1968, 'https://placehold.co/300x450?text=2001+Space+Odyssey', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('A Wizard of Earthsea', '9780553262505', 'A young wizard must confront the shadow creature he unleashed.', 460.00, 19, 1968, 'https://placehold.co/300x450?text=Wizard+of+Earthsea', (SELECT publisher_id FROM publishers WHERE name = 'HarperCollins')),
('The Left Hand of Darkness', '9780441478125', 'An envoy explores a world where inhabitants have no fixed gender.', 530.00, 12, 1969, 'https://placehold.co/300x450?text=Left+Hand+Darkness', (SELECT publisher_id FROM publishers WHERE name = 'Orbit Books')),
('Never Let Me Go', '9781400078776', 'Students at an English boarding school confront a dark destiny.', 490.00, 18, 2005, 'https://placehold.co/300x450?text=Never+Let+Me+Go', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('The Remains of the Day', '9780679731726', 'An English butler reflects on a life of duty and repressed feeling.', 480.00, 14, 1989, 'https://placehold.co/300x450?text=Remains+of+the+Day', (SELECT publisher_id FROM publishers WHERE name = 'Vintage Books')),
('Half of a Yellow Sun', '9781400095209', 'A story of love and war set during the Nigerian Civil War.', 560.00, 13, 2006, 'https://placehold.co/300x450?text=Half+of+Yellow+Sun', (SELECT publisher_id FROM publishers WHERE name = 'Canongate Books')),
('Americanah', '9780307455925', 'A Nigerian woman navigates race and identity between Nigeria and America.', 580.00, 15, 2013, 'https://placehold.co/300x450?text=Americanah', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('Outliers', '9780316017930', 'An exploration of the hidden factors behind extraordinary success.', 600.00, 20, 2008, 'https://placehold.co/300x450?text=Outliers', (SELECT publisher_id FROM publishers WHERE name = 'Hachette Book Group')),
('The Tipping Point', '9780316346627', 'How small actions can trigger large-scale social change.', 590.00, 18, 2000, 'https://placehold.co/300x450?text=Tipping+Point', (SELECT publisher_id FROM publishers WHERE name = 'Hachette Book Group')),
('Becoming', '9781524763138', 'A memoir tracing an extraordinary personal and public journey.', 720.00, 24, 2018, 'https://placehold.co/300x450?text=Becoming', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('Steve Jobs', '9781451648539', 'The definitive biography of the Apple co-founder.', 850.00, 16, 2011, 'https://placehold.co/300x450?text=Steve+Jobs', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('Cosmos', '9780345539434', 'A journey through the universe and humanity''s place within it.', 770.00, 14, 1980, 'https://placehold.co/300x450?text=Cosmos', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('A Brief History of Time', '9780553380163', 'An accessible exploration of cosmology, black holes, and the origins of the universe.', 690.00, 17, 1988, 'https://placehold.co/300x450?text=Brief+History+of+Time', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('How to Win Friends and Influence People', '9780671027032', 'A timeless guide to interpersonal skills and persuasion.', 520.00, 26, 1936, 'https://placehold.co/300x450?text=Win+Friends', (SELECT publisher_id FROM publishers WHERE name = 'Simon & Schuster')),
('Atomic Habits', '9780735211292', 'A practical framework for building good habits and breaking bad ones.', 680.00, 30, 2018, 'https://placehold.co/300x450?text=Atomic+Habits', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('Refactoring', '9780134757599', 'A catalog of techniques for improving the design of existing code.', 1350.00, 9, 1999, 'https://placehold.co/300x450?text=Refactoring', (SELECT publisher_id FROM publishers WHERE name = 'O''Reilly Media')),
('Design Patterns', '9780201633610', 'Reusable object-oriented software design solutions.', 1280.00, 10, 1994, 'https://placehold.co/300x450?text=Design+Patterns', (SELECT publisher_id FROM publishers WHERE name = 'Oxford University Press')),
('The Pragmatic Programmer', '9780135957059', 'Practical advice for becoming a more effective software developer.', 1150.00, 12, 1999, 'https://placehold.co/300x450?text=Pragmatic+Programmer', (SELECT publisher_id FROM publishers WHERE name = 'O''Reilly Media')),
('The Martian', '9780553418026', 'An astronaut stranded on Mars must engineer his own survival.', 610.00, 21, 2011, 'https://placehold.co/300x450?text=The+Martian', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('Project Hail Mary', '9780593135204', 'A lone astronaut must save humanity from an extinction-level threat.', 660.00, 19, 2021, 'https://placehold.co/300x450?text=Project+Hail+Mary', (SELECT publisher_id FROM publishers WHERE name = 'Random House')),
('Rebecca', '9780380730407', 'A young bride is haunted by the memory of her husband''s first wife.', 490.00, 15, 1938, 'https://placehold.co/300x450?text=Rebecca', (SELECT publisher_id FROM publishers WHERE name = 'HarperCollins')),
('Jane Eyre', '9780141441146', 'An orphan''s journey to independence, love, and self-respect.', 460.00, 22, 1847, 'https://placehold.co/300x450?text=Jane+Eyre', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('Wuthering Heights', '9780141439556', 'A tale of obsessive love and revenge on the Yorkshire moors.', 450.00, 18, 1847, 'https://placehold.co/300x450?text=Wuthering+Heights', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('Dracula', '9780141439846', 'A gothic tale of a vampire''s journey from Transylvania to England.', 470.00, 20, 1897, 'https://placehold.co/300x450?text=Dracula', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('Frankenstein', '9780141439471', 'A scientist creates life and must confront the consequences.', 440.00, 23, 1818, 'https://placehold.co/300x450?text=Frankenstein', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('The Picture of Dorian Gray', '9780141439570', 'A man remains young while his portrait bears the marks of his sins.', 450.00, 19, 1890, 'https://placehold.co/300x450?text=Dorian+Gray', (SELECT publisher_id FROM publishers WHERE name = 'Penguin Books')),
('Charlotte''s Web', '9780064400558', 'A pig and a spider form an unlikely, life-changing friendship.', 380.00, 25, 1952, 'https://placehold.co/300x450?text=Charlottes+Web', (SELECT publisher_id FROM publishers WHERE name = 'Scholastic')),
('Matilda', '9780142410370', 'A gifted girl with unusual powers outwits the adults around her.', 400.00, 24, 1988, 'https://placehold.co/300x450?text=Matilda', (SELECT publisher_id FROM publishers WHERE name = 'Scholastic'));


-- ====================================================================
-- 5. EXTRA BOOK_AUTHORS (linked by title/name, order-independent)
-- ====================================================================

INSERT INTO book_authors (book_id, author_id)
SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Adventures of Huckleberry Finn' AND a.name = 'Mark Twain'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'A Tale of Two Cities' AND a.name = 'Charles Dickens'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Great Expectations' AND a.name = 'Charles Dickens'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Anna Karenina' AND a.name = 'Leo Tolstoy'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'War and Peace' AND a.name = 'Leo Tolstoy'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Crime and Punishment' AND a.name = 'Fyodor Dostoevsky'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Brothers Karamazov' AND a.name = 'Fyodor Dostoevsky'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Old Man and the Sea' AND a.name = 'Ernest Hemingway'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'A Farewell to Arms' AND a.name = 'Ernest Hemingway'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Mrs Dalloway' AND a.name = 'Virginia Woolf'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'To the Lighthouse' AND a.name = 'Virginia Woolf'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Great Gatsby' AND a.name = 'F. Scott Fitzgerald'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Metamorphosis' AND a.name = 'Franz Kafka'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Trial' AND a.name = 'Franz Kafka'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'One Hundred Years of Solitude' AND a.name = 'Gabriel Garcia Marquez'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Love in the Time of Cholera' AND a.name = 'Gabriel Garcia Marquez'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Beloved' AND a.name = 'Toni Morrison'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Norwegian Wood' AND a.name = 'Haruki Murakami'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Kafka on the Shore' AND a.name = 'Haruki Murakami'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Handmaid''s Tale' AND a.name = 'Margaret Atwood'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Oryx and Crake' AND a.name = 'Margaret Atwood'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Shining' AND a.name = 'Stephen King'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'It' AND a.name = 'Stephen King'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Misery' AND a.name = 'Stephen King'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'American Gods' AND a.name = 'Neil Gaiman'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Good Omens' AND a.name = 'Neil Gaiman'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Colour of Magic' AND a.name = 'Terry Pratchett'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Guards! Guards!' AND a.name = 'Terry Pratchett'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Do Androids Dream of Electric Sheep?' AND a.name = 'Philip K. Dick'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Man in the High Castle' AND a.name = 'Philip K. Dick'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Fahrenheit 451' AND a.name = 'Ray Bradbury'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Martian Chronicles' AND a.name = 'Ray Bradbury'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Childhood''s End' AND a.name = 'Arthur C. Clarke'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = '2001: A Space Odyssey' AND a.name = 'Arthur C. Clarke'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'A Wizard of Earthsea' AND a.name = 'Ursula K. Le Guin'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Left Hand of Darkness' AND a.name = 'Ursula K. Le Guin'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Never Let Me Go' AND a.name = 'Kazuo Ishiguro'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Remains of the Day' AND a.name = 'Kazuo Ishiguro'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Half of a Yellow Sun' AND a.name = 'Chimamanda Ngozi Adichie'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Americanah' AND a.name = 'Chimamanda Ngozi Adichie'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Outliers' AND a.name = 'Malcolm Gladwell'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Tipping Point' AND a.name = 'Malcolm Gladwell'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Becoming' AND a.name = 'Michelle Obama'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Steve Jobs' AND a.name = 'Walter Isaacson'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Cosmos' AND a.name = 'Carl Sagan'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'A Brief History of Time' AND a.name = 'Stephen Hawking'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'How to Win Friends and Influence People' AND a.name = 'Dale Carnegie'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Atomic Habits' AND a.name = 'James Clear'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Refactoring' AND a.name = 'Martin Fowler'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Design Patterns' AND a.name = 'Robert C. Martin'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Pragmatic Programmer' AND a.name = 'Robert C. Martin'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'The Martian' AND a.name = 'Andy Weir'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Project Hail Mary' AND a.name = 'Andy Weir'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Jane Eyre' AND a.name = 'Jane Austen'
UNION ALL SELECT b.book_id, a.author_id FROM books b, authors a WHERE b.title = 'Wuthering Heights' AND a.name = 'Jane Austen'
ON CONFLICT DO NOTHING;


-- ====================================================================
-- 6. EXTRA BOOK_CATEGORIES (linked by title/category name)
-- ====================================================================

INSERT INTO book_categories (book_id, category_id)
SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Adventures of Huckleberry Finn' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'A Tale of Two Cities' AND c.category_name IN ('Fiction', 'Classics', 'History')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Great Expectations' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Anna Karenina' AND c.category_name IN ('Fiction', 'Classics', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'War and Peace' AND c.category_name IN ('Fiction', 'Classics', 'History')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Crime and Punishment' AND c.category_name IN ('Fiction', 'Classics', 'Mystery')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Brothers Karamazov' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Old Man and the Sea' AND c.category_name IN ('Fiction', 'Classics', 'Adventure')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'A Farewell to Arms' AND c.category_name IN ('Fiction', 'Classics', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Mrs Dalloway' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'To the Lighthouse' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Great Gatsby' AND c.category_name IN ('Fiction', 'Classics', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Metamorphosis' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Trial' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'One Hundred Years of Solitude' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Love in the Time of Cholera' AND c.category_name IN ('Fiction', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Beloved' AND c.category_name IN ('Fiction', 'History')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Norwegian Wood' AND c.category_name IN ('Fiction', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Kafka on the Shore' AND c.category_name IN ('Fiction', 'Fantasy')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Handmaid''s Tale' AND c.category_name IN ('Fiction', 'Science Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Oryx and Crake' AND c.category_name IN ('Fiction', 'Science Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Shining' AND c.category_name IN ('Fiction', 'Horror')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'It' AND c.category_name IN ('Fiction', 'Horror')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Misery' AND c.category_name IN ('Fiction', 'Horror')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'American Gods' AND c.category_name IN ('Fantasy', 'Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Good Omens' AND c.category_name IN ('Fantasy', 'Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Colour of Magic' AND c.category_name IN ('Fantasy', 'Adventure')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Guards! Guards!' AND c.category_name IN ('Fantasy', 'Adventure')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Do Androids Dream of Electric Sheep?' AND c.category_name IN ('Science Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Man in the High Castle' AND c.category_name IN ('Science Fiction', 'History')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Fahrenheit 451' AND c.category_name IN ('Science Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Martian Chronicles' AND c.category_name IN ('Science Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Childhood''s End' AND c.category_name IN ('Science Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = '2001: A Space Odyssey' AND c.category_name IN ('Science Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'A Wizard of Earthsea' AND c.category_name IN ('Fantasy', 'Adventure')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Left Hand of Darkness' AND c.category_name IN ('Science Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Never Let Me Go' AND c.category_name IN ('Fiction', 'Science Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Remains of the Day' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Half of a Yellow Sun' AND c.category_name IN ('Fiction', 'History')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Americanah' AND c.category_name IN ('Fiction')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Outliers' AND c.category_name IN ('Business')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Tipping Point' AND c.category_name IN ('Business')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Becoming' AND c.category_name IN ('Biography')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Steve Jobs' AND c.category_name IN ('Biography', 'Technology')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Cosmos' AND c.category_name IN ('History', 'Technology')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'A Brief History of Time' AND c.category_name IN ('History', 'Technology')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'How to Win Friends and Influence People' AND c.category_name IN ('Business')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Atomic Habits' AND c.category_name IN ('Business')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Refactoring' AND c.category_name IN ('Technology')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Design Patterns' AND c.category_name IN ('Technology')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Pragmatic Programmer' AND c.category_name IN ('Technology')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Martian' AND c.category_name IN ('Science Fiction', 'Adventure')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Project Hail Mary' AND c.category_name IN ('Science Fiction', 'Adventure')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Rebecca' AND c.category_name IN ('Mystery', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Jane Eyre' AND c.category_name IN ('Fiction', 'Classics', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Wuthering Heights' AND c.category_name IN ('Fiction', 'Classics', 'Romance')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Dracula' AND c.category_name IN ('Horror', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Frankenstein' AND c.category_name IN ('Horror', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'The Picture of Dorian Gray' AND c.category_name IN ('Fiction', 'Classics')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Charlotte''s Web' AND c.category_name IN ('Children''s Books')
UNION ALL SELECT b.book_id, c.category_id FROM books b, categories c WHERE b.title = 'Matilda' AND c.category_name IN ('Children''s Books')
ON CONFLICT DO NOTHING;

COMMIT;

-- ====================================================================
-- DONE — verification
-- ====================================================================
SELECT COUNT(*) AS total_books FROM books;
SELECT COUNT(*) AS total_authors FROM authors;
SELECT COUNT(*) AS total_publishers FROM publishers;