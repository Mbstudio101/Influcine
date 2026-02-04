import React, { useState } from 'react';
import { X, ExternalLink, Search, Loader2 } from 'lucide-react';
import Focusable from './Focusable';
import { createPortal } from 'react-dom';
import { useTrailerCache } from '../hooks/useTrailerCache';

interface TrailerModalProps {
  videoKey: string;
  title?: string;
  onClose: () => void;
}

const TrailerModal: React.FC<TrailerModalProps> = ({ videoKey, title, onClose }) => {
  const cachedUrl = useTrailerCache(videoKey);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!videoKey) return null;

  const handleSearchYoutube = () => {
    const query = encodeURIComponent(`${title || 'movie'} trailer`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return createPortal(
    <div className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <Focusable
        as="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors z-50"
        activeClassName="ring-2 ring-primary bg-white/20"
        autoFocus
      >
        <X size={24} />
      </Focusable>
      
      <div className="w-full max-w-5xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
        <div className="aspect-video rounded-xl overflow-hidden shadow-2xl bg-black border border-white/10 relative group">
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <Loader2 className="animate-spin text-primary" size={48} />
            </div>
          )}

          {hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white p-8 text-center">
              <div className="mb-4 text-white/50">
                 <Search size={48} />
              </div>
              <h3 className="text-xl font-bold mb-2">Trailer Unavailable</h3>
              <p className="text-white/60 mb-6 max-w-md">
                We couldn't load the official trailer for this title. You can search for it directly on YouTube.
              </p>
              <Focusable
                as="button"
                onClick={handleSearchYoutube}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                activeClassName="ring-4 ring-red-900 scale-105"
              >
                <ExternalLink size={18} />
                Search YouTube
              </Focusable>
            </div>
          ) : cachedUrl ? (
            <video
              src={cachedUrl}
              className={`w-full h-full ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
              controls
              autoPlay
              playsInline
              onLoadedData={handleLoad}
              onError={handleError}
            />
          ) : (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className={`w-full h-full ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
              onLoad={handleLoad}
              onError={handleError}
            ></iframe>
          )}
        </div>
        
        {!cachedUrl && !hasError && (
          <div className="flex justify-center">
            <a 
              href={`https://www.youtube.com/watch?v=${videoKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-bold transition-all text-sm"
            >
              <ExternalLink size={16} />
              Watch on YouTube
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default TrailerModal;
