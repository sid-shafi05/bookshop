import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export default function PublisherDetail() {
  const { publisherId } = useParams();
  const [publisher, setPublisher] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getPublisherDetail(publisherId)
      .then((data) => {
        if (active) {
          setPublisher(data.publisher);
          setBooks(Array.isArray(data.books) ? data.books : []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [publisherId]);

  if (loading) return <div className="home-loading">Loading publisher...</div>;
  if (!publisher) return <div className="home-loading">Publisher not found.</div>;

  return (
    <main className="directory-page">
      <div className="directory-header narrow">
        <Link to="/publishers" className="back-link">← Back to Publishers</Link>
        <h2>{publisher.name}</h2>
      </div>

      <section className="author-profile">
        <div className="directory-card-body full">
          <p><strong>Location:</strong> {publisher.city || 'Unknown'}{publisher.country ? `, ${publisher.country}` : ''}</p>
          {publisher.website_url && <p><strong>Website:</strong> <a href={publisher.website_url} target="_blank" rel="noreferrer">{publisher.website_url}</a></p>}
          <p><strong>Books:</strong> {publisher.book_count || 0}</p>
        </div>
      </section>

      <section className="directory-results">
        <h3>Books from {publisher.name}</h3>
        <div className="book-grid">
          {books.map((book) => (
            <Link key={book.book_id} to={`/books/${book.book_id}`} className="book-card">
              <div className="cover-wrapper">
                {book.cover_url ? (
                  <img
                    className="book-cover-photo"
                    src={book.cover_url.startsWith('http') ? book.cover_url : `http://localhost:3000${book.cover_url}`}
                    alt={book.title}
                  />
                ) : (
                  <div className="book-cover-art">{book.title}</div>
                )}
              </div>
              <div className="book-meta">
                <p className="title-text">{book.title}</p>
                <p className="author-text">{book.publisher_name || 'Independent Publisher'}</p>
                <div className="price-row">
                  <span className="price-tag">Tk {Number(book.price).toFixed(2)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}