import React, { useEffect, useState, useRef } from 'react';
import { Media } from '../types';
import MediaCard from './MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Focusable from './Focusable';

interface ContentRowProps {
  title: string;
  fetcher: () => Promise<Media[]>;
  cardSize?: 'small' | 'medium' | 'large';
}

const ContentRow: React.FC<ContentRowProps> = ({ title, fetcher, cardSize = 'medium' }) => {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetcher();
        setMedia(data);
      } catch (error) {
        console.error(`Failed to fetch data for ${title}:`, error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fetcher, title]);

  const handleScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10); // 10px buffer
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' 
        ? rowRef.current.scrollLeft - clientWidth * 0.75 
        : rowRef.current.scrollLeft + clientWidth * 0.75;
      
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const getSizeClass = () => {
    switch (cardSize) {
      case 'small':
        return 'min-w-[120px] md:min-w-[150px]';
      case 'large':
        return 'min-w-[200px] md:min-w-[300px]';
      case 'medium':
      default:
        return 'min-w-[160px] md:min-w-[200px]';
    }
  };

  if (loading) return <div className="h-40 animate-pulse bg-white/5 rounded-xl my-6 mx-10"></div>;
  if (media.length === 0) return null;

  return (
    <div className="mb-10 group/row relative px-10">
      <h2 className="text-2xl font-bold mb-5 text-white flex items-center gap-2 group/title cursor-pointer">
        <Focusable as="span" className="bg-linear-to-r from-white to-white/70 bg-clip-text text-transparent group-hover/title:from-primary group-hover/title:to-purple-500 transition-all duration-300">
          {title}
        </Focusable>
        <ChevronRight size={20} className="text-primary opacity-0 -translate-x-2 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all duration-300" />
      </h2>
      
      <div className="relative">
        {showLeftArrow && (
          <Focusable
            as="button"
            onClick={() => scroll('left')}
            className="absolute -left-5 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-black/40 hover:bg-primary/90 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 backdrop-blur-md rounded-full shadow-lg hover:scale-110 border border-white/10"
            activeClassName="ring-2 ring-primary opacity-100 scale-110 bg-primary"
          >
            <ChevronLeft size={24} className="text-white" />
          </Focusable>
        )}

        <div
          ref={rowRef}
          onScroll={handleScroll}
          className="flex gap-5 overflow-x-auto pb-8 pt-2 scrollbar-hide scroll-smooth snap-x snap-mandatory px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {media.map((item) => (
            <div key={item.id} className={`${getSizeClass()} snap-start`}>
              <MediaCard media={item} />
            </div>
          ))}
        </div>

        {showRightArrow && (
          <Focusable
            as="button"
            onClick={() => scroll('right')}
            className="absolute -right-5 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-black/40 hover:bg-primary/90 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 backdrop-blur-md rounded-full shadow-lg hover:scale-110 border border-white/10"
            activeClassName="ring-2 ring-primary opacity-100 scale-110 bg-primary"
          >
            <ChevronRight size={24} className="text-white" />
          </Focusable>
        )}
      </div>
    </div>
  );
};

export default ContentRow;
