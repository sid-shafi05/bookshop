import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function AuthorDirectory() {
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <div className="directory-grid">
          {authors.map((author) => (
            <Link key={author.author_id} to={`/authors/${author.author_id}`} className="directory-card">
              <div className="directory-image-wrap">
                {author.photo_url ? (
                  <img src={author.photo_url.startsWith('http') ? author.photo_url : `http://localhost:3000${author.photo_url}`} alt={author.name} />
                ) : (
                  <div className="directory-placeholder">✒</div>
                )}
              </div>
              <div className="directory-card-body">
                <h3>{author.name}</h3>
                <p>{author.nationality || 'Unknown nationality'}</p>
                <small>{author.book_count || 0} books</small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
