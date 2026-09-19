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
        <div className="directory-grid">
          {books.map((book) => (
            <Link key={book.book_id} to={`/books/${book.book_id}`} className="directory-card">
              <div className="directory-image-wrap small">
                {book.cover_url ? (
                  <img src={book.cover_url.startsWith('http') ? book.cover_url : `http://localhost:3000${book.cover_url}`} alt={book.title} />
                ) : (
                  <div className="directory-placeholder small">📖</div>
                )}
              </div>
              <div className="directory-card-body">
                <h3>{book.title}</h3>
                <p>{book.publisher_name || 'Independent Publisher'}</p>
                <small>Tk {Number(book.price).toFixed(2)}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
