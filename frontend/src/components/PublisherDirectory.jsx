import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Pagination from './Pagination';

const PAGE_SIZE = 18;

export default function PublisherDirectory() {
  const [publishers, setPublishers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    api.getPublishers()
      .then((data) => {
        if (active) setPublishers(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(publishers.length / PAGE_SIZE));
  const pagePublishers = publishers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="directory-page">
      <div className="directory-header">
        <span className="section-kicker">DISCOVER</span>
        <h2>Publishers</h2>
        <p>Explore publishers and the books they bring to the shelf.</p>
      </div>

      {loading ? (
        <div className="home-loading">Loading publishers...</div>
      ) : (
        <>
          <div className="directory-grid">
            {pagePublishers.map((publisher) => (
              <Link key={publisher.publisher_id} to={`/publishers/${publisher.publisher_id}`} className="directory-card">
                <div className="directory-card-body">
                  <h3>{publisher.name}</h3>
                  <p>{publisher.city || 'Unknown city'}{publisher.country ? `, ${publisher.country}` : ''}</p>
                  <small>{publisher.book_count || 0} books</small>
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