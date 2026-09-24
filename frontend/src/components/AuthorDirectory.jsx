import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Pagination from './Pagination';

const PAGE_SIZE = 18;

export default function AuthorDirectory() {
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    api.getAuthors()
      .then((data) => {
        if (active) setAuthors(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) console.error(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(authors.length / PAGE_SIZE));
  const pageAuthors = authors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="directory-page">
      <div className="directory-header">
        <span className="section-kicker">DISCOVER</span>
        <h2>Authors</h2>
        <p>Browse authors and explore the books they wrote.</p>
      </div>

      {loading ? (
        <div className="home-loading">Loading authors...</div>
      ) : (
        <>
          <div className="author-grid">
            {pageAuthors.map((author) => (
              <Link key={author.author_id} to={`/authors/${author.author_id}`} className="author-card">
                <div className="author-avatar">
                  {author.photo_url ? (
                    <img
                      src={author.photo_url.startsWith('http') ? author.photo_url : `http://localhost:3000${author.photo_url}`}
                      alt={author.name}
                    />
                  ) : (
                    <svg viewBox="0 0 24 24" className="author-avatar-placeholder">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                    </svg>
                  )}
                </div>
                <div className="author-card-body">
                  <h3>{author.name}</h3>
                  <p>{author.nationality || 'Unknown nationality'}</p>
                  <small>{author.book_count || 0} books</small>
                </div>
              </Link>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </main>
  );
}