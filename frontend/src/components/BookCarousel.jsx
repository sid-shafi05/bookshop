import { useEffect, useRef, useState } from 'react';
import BookCard from './BookCard';

export default function BookCarousel({ books, onAddToCart, onHeartClick, onOpenDetails }) {
  const trackRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const getStep = () => {
    const track = trackRef.current;
    if (!track) return 216;
    const firstItem = track.querySelector('.book-carousel-item');
    if (!firstItem) return 216;
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap || '16');
    return firstItem.getBoundingClientRect().width + gap;
  };

  const advance = () => {
    const track = trackRef.current;
    if (!track) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    const step = getStep();

    if (track.scrollLeft >= maxScroll - 2) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      track.scrollTo({
        left: Math.min(track.scrollLeft + step, maxScroll),
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (isHovered || !books.length) return;
    const interval = setInterval(advance, 3000);
    return () => clearInterval(interval);
  }, [isHovered, books.length]);

  const scrollManual = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const step = getStep();

    if (direction === 'left') {
      track.scrollTo({ left: Math.max(track.scrollLeft - step, 0), behavior: 'smooth' });
    } else {
      if (track.scrollLeft >= maxScroll - 2) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollTo({ left: Math.min(track.scrollLeft + step, maxScroll), behavior: 'smooth' });
      }
    }
  };

  if (!books.length) return null;

  return (
    <div
      className="book-carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button className="carousel-arrow carousel-arrow-left" onClick={() => scrollManual('left')} aria-label="Scroll left">
        ‹
      </button>

      <div className="book-carousel-track" ref={trackRef}>
        {books.map((book) => (
          <div className="book-carousel-item" key={book.book_id}>
            <BookCard
              book={book}
              onAddToCart={onAddToCart}
              onHeartClick={onHeartClick}
              onOpenDetails={onOpenDetails}
            />
          </div>
        ))}
      </div>

      <button className="carousel-arrow carousel-arrow-right" onClick={() => scrollManual('right')} aria-label="Scroll right">
        ›
      </button>
    </div>
  );
}