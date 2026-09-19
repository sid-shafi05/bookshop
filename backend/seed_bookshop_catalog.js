require('dotenv').config();
const pool = require('./db');

const DEFAULT_CATEGORY_NAMES = [
  'Fiction & Literature',
  'Self-Development',
  'Computer Science & Tech',
  'Sci-Fi & Fantasy',
  'Academic & Education',
  'Classics',
  'Business & Economics',
  'History & Politics',
  "Children's Books",
  'Poetry & Literature',
  'Travel & Lifestyle',
  'Bangla Literature',
  'Romance',
  'Mystery & Thriller',
  'Comics & Manga',
  'Religion & Spirituality',
  'Health & Wellness',
  'Cooking & Food',
  'Art & Design',
  'Music',
  'Sports & Fitness',
  'Technology & Innovation',
  'Biography & Memoir',
  'Philosophy & Psychology'
];

const BOOK_SEARCHES = [
  { language: 'en', category: 'Fiction & Literature', queries: ['fiction novel', 'literary fiction', 'modern fiction'] },
  { language: 'en', category: 'Self-Development', queries: ['self help', 'personal development', 'productivity'] },
  { language: 'en', category: 'Computer Science & Tech', queries: ['computer science', 'programming', 'web development'] },
  { language: 'en', category: 'Sci-Fi & Fantasy', queries: ['science fiction', 'fantasy novel'] },
  { language: 'en', category: 'Academic & Education', queries: ['education', 'textbook', 'academic writing'] },
  { language: 'en', category: 'Business & Economics', queries: ['business', 'economics', 'marketing'] },
  { language: 'en', category: 'History & Politics', queries: ['history', 'politics', 'world history'] },
  { language: 'en', category: "Children's Books", queries: ['children story', 'kids book', 'children literature'] },
  { language: 'en', category: 'Poetry & Literature', queries: ['poetry', 'poetry collection', 'literary anthology'] },
  { language: 'en', category: 'Travel & Lifestyle', queries: ['travel guide', 'lifestyle', 'culture'] },
  { language: 'bn', category: 'Bangla Literature', queries: ['bangla kobita', 'bangla novel', 'bangla literature'] },
  { language: 'bn', category: 'Fiction & Literature', queries: ['bangla fiction', 'bangla golpo', 'bangla novel'] }
];

const MAX_PER_CATEGORY = 8;

const BAD_TITLE_TOKENS = [
  'answer key',
  'solution manual',
  'exam questions',
  'study guide',
  'syllabus',
  'test bank',
  'worksheet',
  'notebook',
  'journal template',
  'sample paper',
  'past paper',
  'teacher guide',
  'mock test'
];

const CATEGORY_KEYWORDS = {
  'Fiction & Literature': ['fiction', 'literature', 'novel', 'story', 'poetry', 'classic', 'literary'],
  'Self-Development': ['self', 'development', 'productivity', 'success', 'mindset', 'leadership'],
  'Computer Science & Tech': ['computer', 'programming', 'software', 'technology', 'code', 'developer', 'python', 'javascript'],
  'Sci-Fi & Fantasy': ['science fiction', 'fantasy', 'sci-fi', 'space', 'magic', 'adventure'],
  'Academic & Education': ['education', 'teaching', 'academic', 'curriculum', 'school', 'learning'],
  'Business & Economics': ['business', 'economics', 'finance', 'marketing', 'strategy', 'management'],
  'History & Politics': ['history', 'politics', 'government', 'world history', 'culture'],
  "Children's Books": ['children', 'kids', 'story', 'picture', 'adventure'],
  'Poetry & Literature': ['poetry', 'poem', 'literature', 'verse', 'anthology'],
  'Travel & Lifestyle': ['travel', 'lifestyle', 'guide', 'culture', 'food', 'journey'],
  'Bangla Literature': ['bangla', 'bengali', 'kobi', 'kobita', 'golpo', 'novel'],
  'Romance': ['romance', 'love', 'relationship', 'novel'],
  'Mystery & Thriller': ['mystery', 'thriller', 'crime', 'detective', 'suspense'],
  'Comics & Manga': ['manga', 'comic', 'graphic', 'anime', 'cartoon'],
  'Religion & Spirituality': ['religion', 'spiritual', 'faith', 'bhagavad', 'quran', 'bible'],
  'Health & Wellness': ['health', 'wellness', 'fitness', 'nutrition', 'wellbeing'],
  'Cooking & Food': ['cooking', 'recipe', 'food', 'kitchen', 'culinary'],
  'Art & Design': ['art', 'design', 'creative', 'illustration', 'craft'],
  'Music': ['music', 'song', 'album', 'composer', 'guitar'],
  'Sports & Fitness': ['sports', 'fitness', 'training', 'exercise', 'athlete'],
  'Technology & Innovation': ['technology', 'innovation', 'ai', 'startup', 'future', 'digital'],
  'Biography & Memoir': ['biography', 'memoir', 'life', 'story', 'autobiography'],
  'Philosophy & Psychology': ['philosophy', 'psychology', 'mind', 'thought', 'ethics']
};

const CATEGORY_MAP = new Map(DEFAULT_CATEGORY_NAMES.map((name) => [name.toLowerCase(), name]));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCategoryName(name) {
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;

  const direct = DEFAULT_CATEGORY_NAMES.find((category) => category.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;

  const lower = trimmed.toLowerCase();
  for (const [key, value] of CATEGORY_MAP.entries()) {
    if (key.includes(lower) || lower.includes(key)) return value;
  }

  return null;
}

async function ensureCategories() {
  for (const categoryName of DEFAULT_CATEGORY_NAMES) {
    await pool.query(
      `INSERT INTO categories (category_name)
       VALUES ($1)
       ON CONFLICT (category_name) DO NOTHING`,
      [categoryName]
    );
  }
}

async function getCategoryId(client, categoryName) {
  const result = await client.query(
    'SELECT category_id FROM categories WHERE LOWER(category_name) = LOWER($1)',
    [categoryName]
  );

  if (result.rows[0]) return result.rows[0].category_id;

  const inserted = await client.query(
    'INSERT INTO categories (category_name) VALUES ($1) RETURNING category_id',
    [categoryName]
  );

  return inserted.rows[0].category_id;
}

async function getOrCreatePublisher(client, publisherName) {
  const name = String(publisherName || '').trim();
  if (!name) return null;

  const existing = await client.query(
    'SELECT publisher_id FROM publishers WHERE LOWER(name) = LOWER($1)',
    [name]
  );

  if (existing.rows[0]) return existing.rows[0].publisher_id;

  const result = await client.query(
    'INSERT INTO publishers (name, country) VALUES ($1, $2) RETURNING publisher_id',
    [name, 'International']
  );

  return result.rows[0].publisher_id;
}

async function getOrCreateAuthor(client, authorName) {
  const name = String(authorName || '').trim();
  if (!name) return null;

  const existing = await client.query(
    'SELECT author_id FROM authors WHERE LOWER(name) = LOWER($1)',
    [name]
  );

  if (existing.rows[0]) return existing.rows[0].author_id;

  const result = await client.query(
    'INSERT INTO authors (name, nationality) VALUES ($1, $2) RETURNING author_id',
    [name, 'International']
  );

  return result.rows[0].author_id;
}

function extractIsbn(volumeInfo) {
  const identifiers = volumeInfo?.industryIdentifiers || [];
  const preferred = identifiers.find((item) => item.type === 'ISBN_13') || identifiers.find((item) => item.type === 'ISBN_10');
  return preferred ? preferred.identifier : '';
}

function buildCoverUrl(volumeInfo) {
  const imageLinks = volumeInfo?.imageLinks || {};
  return imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail || '';
}

function looksLikeRelevantBook(info, categoryName, query) {
  const title = String(info?.title || '').trim();
  const description = String(info?.description || '').trim();
  const publisher = String(info?.publisher || '').trim();
  const haystack = `${title} ${description} ${publisher} ${(info?.categories || []).join(' ')}`.toLowerCase();

  if (!title || title.length < 4) return false;
  if (title.length > 220) return false;
  if (info?.printType && info.printType !== 'BOOK') return false;
  if (info?.pageCount && Number(info.pageCount) < 12) return false;

  const normalizedTitle = title.toLowerCase();
  if (BAD_TITLE_TOKENS.some((token) => normalizedTitle.includes(token))) return false;
  if (normalizedTitle.includes('test bank') || normalizedTitle.includes('answer key')) return false;

  const categoryKeywords = CATEGORY_KEYWORDS[categoryName] || [];
  if (categoryKeywords.length > 0) {
    const hasCategoryKeyword = categoryKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    const queryKeyword = String(query || '').toLowerCase();
    const queryMatches = !queryKeyword || haystack.includes(queryKeyword.split(' ')[0]);
    if (!hasCategoryKeyword && !queryMatches) return false;
  }

  if (!buildCoverUrl(info)) return false;

  return true;
}

async function fetchSearchResults(query, language, apiKey) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=${language}&maxResults=5&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Books request failed for ${query}: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function countBooksInCategory(client, categoryName) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM book_categories bc
     JOIN categories c ON c.category_id = bc.category_id
     WHERE LOWER(c.category_name) = LOWER($1)`,
    [categoryName]
  );
  return Number(result.rows[0]?.total || 0);
}

async function insertBookFromVolume(client, volume, categoryName) {
  const info = volume.volumeInfo || {};
  const title = String(info.title || '').trim();
  if (!title) return;

  if (!looksLikeRelevantBook(info, categoryName, title)) {
    return;
  }

  const authors = Array.isArray(info.authors) ? info.authors : [];
  const publisherName = String(info.publisher || 'Independent Publisher').trim();
  const description = String(info.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const isbn = extractIsbn(info) || `GOOGLE-${volume.id}`;
  const publicationYear = info.publishedDate ? Number(String(info.publishedDate).slice(0, 4)) : null;
  const coverUrl = buildCoverUrl(info);
  const categoryNames = Array.isArray(info.categories) ? info.categories : [];
  const mappedCategories = [...new Set(
    categoryNames
      .map((name) => normalizeCategoryName(name))
      .filter(Boolean)
  )];

  if (mappedCategories.length === 0) {
    return;
  }

  const bookCountForCategory = await countBooksInCategory(client, categoryName);
  if (bookCountForCategory >= MAX_PER_CATEGORY) {
    return;
  }

  const existingBook = await client.query(
    'SELECT book_id FROM books WHERE isbn = $1 OR LOWER(title) = LOWER($2)',
    [isbn, title]
  );

  let bookId;

  if (existingBook.rows[0]) {
    bookId = existingBook.rows[0].book_id;
  } else {
    const publisherId = await getOrCreatePublisher(client, publisherName);
    const bookResult = await client.query(
      `INSERT INTO books (title, isbn, description, price, stock_quantity, publication_year, cover_url, publisher_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING book_id`,
      [title, isbn, description || null, 0, 0, publicationYear, coverUrl || '/images/placeholder-book.jpg', publisherId]
    );
    bookId = bookResult.rows[0].book_id;
  }

  const alreadyLinked = await client.query(
    `SELECT 1 FROM book_categories bc
     JOIN categories c ON c.category_id = bc.category_id
     WHERE bc.book_id = $1 AND LOWER(c.category_name) = LOWER($2)
     LIMIT 1`,
    [bookId, categoryName]
  );

  if (alreadyLinked.rows[0]) {
    return;
  }

  for (const authorName of authors) {
    const authorId = await getOrCreateAuthor(client, authorName);
    if (authorId) {
      await client.query(
        'INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [bookId, authorId]
      );
    }
  }

  for (const categoryNameEntry of mappedCategories) {
    const categoryId = await getCategoryId(client, categoryNameEntry);
    const categoryTotal = await countBooksInCategory(client, categoryNameEntry);
    if (categoryTotal >= MAX_PER_CATEGORY) {
      continue;
    }

    await client.query(
      'INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [bookId, categoryId]
    );
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_BOOKS_API_KEY is missing in backend/.env');
  }

  await ensureCategories();

  const client = await pool.connect();

  try {
    for (const search of BOOK_SEARCHES) {
      for (const query of search.queries) {
        try {
          const items = await fetchSearchResults(query, search.language, apiKey);
          for (const item of items) {
            await insertBookFromVolume(client, item, search.category);
          }
        } catch (err) {
          console.warn(`Skipping query ${query}:`, err.message);
        }
        await delay(400);
      }
    }
  } finally {
    client.release();
  }

  console.log('Catalog seeding complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('Catalog seeding failed:', err.message);
  process.exit(1);
});
