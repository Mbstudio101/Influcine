import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Media } from '../types';
import MediaCard from './MediaCard';
import Skeleton from './Skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Focusable from './Focusable';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

interface ContentRowProps {
  title: string;
  fetcher?: () => Promise<Media[]>;
  data?: Media[];
  cardSize?: 'small' | 'medium' | 'large';
  cardVariant?: 'poster' | 'backdrop';
  staleTime?: number;
}

const ContentRow: React.FC<ContentRowProps> = ({
  title,
  fetcher,
  data,
  cardSize = 'medium',
  cardVariant = 'poster',
  staleTime = 1000 * 60 * 15,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [containerRef, isVisible] = useIntersectionObserver({ freezeOnceVisible: true, rootMargin: '200px' });

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const { data: fetchedMedia = [], isFetching, error } = useQuery({
    queryKey: ['content-row', title],
    queryFn: fetcher || (() => Promise.resolve([])),
    enabled: !!fetcher && !data && isVisible,
    staleTime,
  });

  const media = data || fetchedMedia;
  const loading = !data && !!fetcher && isFetching;

  if (error) {
    console.error(`Failed to fetch data for ${title}:`, error);
  }

  const handleScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? rowRef.current.scrollLeft - clientWidth * 0.75 : rowRef.current.scrollLeft + clientWidth * 0.75;

      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const getSizeClass = () => {
    if (cardVariant === 'backdrop') {
      switch (cardSize) {
        case 'small':
          return 'min-w-[180px] md:min-w-[210px]';
        case 'large':
          return 'min-w-[240px] md:min-w-[290px]';
        case 'medium':
        default:
          return 'min-w-[220px] md:min-w-[260px]';
      }
    }

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

  if (loading)
    return (
      <div className="mb-8 px-4 md:px-8 lg:px-10">
        <div className="h-6 w-44 bg-white/10 rounded mb-4 animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className={`${getSizeClass()} ${cardVariant === 'backdrop' ? 'aspect-video' : 'aspect-2/3'} rounded-xl`} />
          ))}
        </div>
      </div>
    );

  if (media.length === 0 && !loading) return <div ref={containerRef} className="h-1" />;

  return (
    <div ref={containerRef} className="mb-8 group/row relative px-4 md:px-8 lg:px-10">
      <h2 className="text-xl md:text-2xl font-semibold mb-4 text-white flex items-center gap-2 group/title cursor-pointer tracking-tight">
        <Focusable as="span" className="bg-linear-to-r from-[#ffd3e8] via-[#ff9ac9] to-[#9f9dff] bg-clip-text text-transparent transition-colors duration-300">
          {title}
        </Focusable>
        <ChevronRight size={18} className="text-[#ff9ac9] opacity-0 -translate-x-2 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all duration-300" />
      </h2>

      <div className="relative">
        {showLeftArrow && (
          <Focusable
            as="button"
            onClick={() => scroll('left')}
            className="absolute -left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-[#040b16]/85 hover:bg-[rgba(255,79,163,0.28)] flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 rounded-full border border-[rgba(255,122,182,0.5)]"
            activeClassName="ring-2 ring-primary opacity-100 scale-110"
          >
            <ChevronLeft size={20} className="text-white" />
          </Focusable>
        )}

        <div
          ref={rowRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-hide scroll-smooth snap-x snap-mandatory px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {media.map(item => (
            <div key={item.id} className={`${getSizeClass()} snap-start`}>
              <MediaCard media={item} variant={cardVariant} />
            </div>
          ))}
        </div>

        {showRightArrow && (
          <Focusable
            as="button"
            onClick={() => scroll('right')}
            className="absolute -right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-[#040b16]/85 hover:bg-[rgba(125,123,255,0.28)] flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 rounded-full border border-[rgba(125,123,255,0.45)]"
            activeClassName="ring-2 ring-primary opacity-100 scale-110"
          >
            <ChevronRight size={20} className="text-white" />
          </Focusable>
        )}
      </div>
    </div>
  );
};

export default ContentRow;
