// src/components/CategoryCarousel.jsx
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import BookCard from './BookCard';

export default function CategoryCarousel({ category, onAddToCart, onHeartClick, onOpenDetails }) {
  const [books, setBooks] = useState([]);
  const trackRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    api.getBooks({ genre: category, page: 1, limit: 10 })
      .then((res) => { if (mounted) setBooks(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [category]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame;
    const step = () => {
      if (!pausedRef.current && track) {
        track.scrollLeft += 0.6;
        if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 1) track.scrollLeft = 0;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [books]);

  if (!books.length) return null;

  return (
    <div className="category-carousel">
      <h3 className="carousel-heading">{category}</h3>
      <div
        className="carousel-track"
        ref={trackRef}
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        {[...books, ...books].map((b, i) => (
          <div className="carousel-item" key={`${b.book_id}-${i}`}>
            <BookCard book={b} onAddToCart={onAddToCart} onHeartClick={onHeartClick} onOpenDetails={onOpenDetails} />
          </div>
        ))}
      </div>
    </div>
  );
}