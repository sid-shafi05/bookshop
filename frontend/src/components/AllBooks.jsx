
import { useEffect, useState } from 'react';
import { api } from '../api';
import BookCard from './BookCard';
import Pagination from './Pagination';

export default function AllBooks({
  selectedCategory,
  setSelectedCategory,
  categories,
  searchQuery,
  setSearchQuery,
  onAddToCart,
  onHeartClick,
  onOpenDetails
}) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sortBy, setSortBy] = useState('featured');

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });

  const limit = 12;


  /*
    Reset to page 1 whenever the user
    changes category or search.
  */
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchQuery]);


  /*
    Load books from backend.
  */
  useEffect(() => {

    let cancelled = false;

    async function loadBooks() {

      try {

        setLoading(true);

        const res = await api.getBooks({
          genre: selectedCategory,
          page,
          limit
        });

        if (cancelled) return;

        const rows = Array.isArray(res?.data)
          ? res.data
          : [];

        setBooks(rows);

        setPagination(
          res?.pagination || {
            page,
            totalPages: 1,
            total: rows.length
          }
        );

      } catch (error) {

        console.error(
          'Loading books failed:',
          error
        );

        if (!cancelled) {

          setBooks([]);

          setPagination({
            page: 1,
            totalPages: 1,
            total: 0
          });

        }

      } finally {

        if (!cancelled) {
          setLoading(false);
        }

      }

    }

    loadBooks();

    return () => {
      cancelled = true;
    };

  }, [selectedCategory, page]);


  /*
    Search.
  */
  let displayedBooks = [...books];

  if (searchQuery.trim()) {

    const query =
      searchQuery.toLowerCase().trim();

    displayedBooks =
      displayedBooks.filter((book) => {

        const titleMatch =
          book?.title &&
          String(book.title)
            .toLowerCase()
            .includes(query);

        const authorMatch =
          Array.isArray(book?.authors) &&
          book.authors.some(
            (author) =>
              author &&
              String(author)
                .toLowerCase()
                .includes(query)
          );

        return titleMatch || authorMatch;

      });

  }


  /*
    Sorting.
  */
  if (sortBy === 'price-low') {

    displayedBooks.sort(
      (a, b) =>
        Number(a.price || 0) -
        Number(b.price || 0)
    );

  }

  if (sortBy === 'price-high') {

    displayedBooks.sort(
      (a, b) =>
        Number(b.price || 0) -
        Number(a.price || 0)
    );

  }


  return (

    <main className="all-books-page">

      {/* ================= HEADER ================= */}

      <div className="all-books-header">

        <div>

          <span className="section-kicker">
            OUR COLLECTION
          </span>

          <h2>
            All Books
          </h2>

          <p>
            {pagination.total} books in our collection
          </p>

        </div>


        <div className="all-books-actions">

          <select
            value={selectedCategory}
            onChange={(e) =>
              setSelectedCategory(e.target.value)
            }
          >

            {categories.map((category) => (

              <option
                key={category}
                value={category}
              >
                {category}
              </option>

            ))}

          </select>


          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value)
            }
          >

            <option value="featured">
              Featured / Newest
            </option>

            <option value="price-low">
              Price: Low to High
            </option>

            <option value="price-high">
              Price: High to Low
            </option>

          </select>

        </div>

      </div>


      {/* ================= SEARCH ================= */}

      <div className="all-books-search">

        <input
          type="text"
          value={searchQuery}
          placeholder="Search this collection..."
          onChange={(e) =>
            setSearchQuery(e.target.value)
          }
        />

        {searchQuery && (

          <button
            onClick={() => setSearchQuery('')}
          >
            Clear
          </button>

        )}

      </div>


      {/* ================= BOOKS ================= */}

      {loading ? (

        <div className="empty-state">
          Loading books...
        </div>

      ) : displayedBooks.length === 0 ? (

        <div className="empty-state">
          No books found.
        </div>

      ) : (

        <>

          <div className="book-grid">

            {displayedBooks.map((book) => (

              <BookCard
                key={book.book_id}
                book={book}
                onAddToCart={onAddToCart}
                onHeartClick={onHeartClick}
                onOpenDetails={onOpenDetails}
              />

            ))}

          </div>


          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages || 1}
            onPageChange={setPage}
          />

        </>

      )}

    </main>

  );
}
