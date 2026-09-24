import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export default function AuthorDetail() {
  const { authorId } = useParams();
  const [author, setAuthor] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getAuthorDetail(authorId)
      .then((data) => {
        if (active) {
          setAuthor(data.author);
          setBooks(Array.isArray(data.books) ? data.books : []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [authorId]);

  if (loading) return <div className="home-loading">Loading author...</div>;
  if (!author) return <div className="home-loading">Author not found.</div>;

  return (
    <main className="directory-page">
      <div className="directory-header narrow">
        <Link to="/authors" className="back-link">← Back to Authors</Link>
        <h2>{author.name}</h2>
      </div>

      <section className="author-profile">
        <div className="directory-image-wrap large">
          {author.photo_url ? (
            <img src={author.photo_url.startsWith('http') ? author.photo_url : `http://localhost:3000${author.photo_url}`} alt={author.name} />
          ) : (
            <div className="directory-placeholder large">✒</div>
          )}
        </div>
        <div>
          <p><strong>Nationality:</strong> {author.nationality || 'Not specified'}</p>
          <p><strong>Books:</strong> {author.book_count || 0}</p>
          <p>{author.bio || 'No bio available yet.'}</p>
        </div>
      </section>

      <section className="directory-results">
        <h3>Books by {author.name}</h3>
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