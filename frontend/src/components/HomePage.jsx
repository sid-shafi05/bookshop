import { useEffect, useState } from 'react';
import { api } from '../api';
import BookCard from './BookCard';
import BookCarousel from './BookCarousel';

export default function HomePage({
  categories,
  onAddToCart,
  onHeartClick,
  onOpenDetails,
  onBrowseCategory,
  onBrowseAll
}) {
  const [hotPicks, setHotPicks] = useState([]);
  const [categoryBooks, setCategoryBooks] = useState({});
  const [loading, setLoading] = useState(true);

  const featuredCategories = categories
    .filter((category) => category !== 'All')
    .slice(0, 3);

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      try {
        setLoading(true);

        const hotRes = await api.getBooks({ genre: 'All', page: 1, limit: 8 });
        if (cancelled) return;
        setHotPicks(Array.isArray(hotRes?.data) ? hotRes.data : []);

        const grouped = {};
        for (const category of featuredCategories) {
          const res = await api.getBooks({ genre: category, page: 1, limit: 5 });
          grouped[category] = Array.isArray(res?.data) ? res.data : [];
        }
        if (!cancelled) setCategoryBooks(grouped);

      } catch (error) {
        console.error('Homepage loading error:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHome();
    return () => { cancelled = true; };
  }, [categories.join('|')]);

  if (loading) {
    return (
      <main className="home-page">
        <div className="home-loading">Loading the bookstore...</div>
      </main>
    );
  }

  return (
    <main className="home-page">

      {/* ================= HERO ================= */}
      <section className="store-hero">
        <div className="hero-content">
          <span className="hero-eyebrow">YOUR NEXT GREAT READ</span>
          <h2>Stories worth<br />keeping.</h2>
          <p>Discover something new from our collection of books, stories and ideas.</p>
          <button className="hero-button" onClick={onBrowseAll}>Browse all books</button>
        </div>
      </section>

      {/* ================= HOT PICKS (carousel) ================= */}
      <section className="home-book-section">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">RECOMMENDED</span>
            <h2>Hot Picks</h2>
            <p>Books worth picking up right now.</p>
          </div>
          <button className="see-all-btn" onClick={onBrowseAll}>See all →</button>
        </div>

        <BookCarousel
          books={hotPicks}
          onAddToCart={onAddToCart}
          onHeartClick={onHeartClick}
          onOpenDetails={onOpenDetails}
        />
      </section>

      {/* ================= CATEGORY SECTIONS ================= */}
      {featuredCategories.map((category) => {
        const books = categoryBooks[category] || [];
        if (books.length === 0) return null;

        return (
          <section className="home-book-section" key={category}>
            <div className="section-heading-row">
              <div>
                <span className="section-kicker">EXPLORE</span>
                <h2>{category}</h2>
                <p>A few picks from our {category.toLowerCase()} collection.</p>
              </div>
              <button className="see-all-btn" onClick={() => onBrowseCategory(category)}>See all →</button>
            </div>

            <div className="home-book-row">
              {books.map((book) => (
                <BookCard
                  key={book.book_id}
                  book={book}
                  onAddToCart={onAddToCart}
                  onHeartClick={onHeartClick}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* ================= CATEGORY DISCOVERY (grid scales with categories) ================= */}
      <section className="category-discovery">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">EXPLORE</span>
            <h2>Find your kind of book</h2>
            <p>Browse our collection by category.</p>
          </div>
          <button className="see-all-btn" onClick={onBrowseAll}>All books →</button>
        </div>

        <div className="category-chip-grid">
          {categories
            .filter((category) => category !== 'All')
            .map((category) => (
              <button
                key={category}
                className="category-chip"
                onClick={() => onBrowseCategory(category)}
              >
                <span>{category}</span>
                <span>→</span>
              </button>
            ))}
        </div>
      </section>

    </main>
  );
}