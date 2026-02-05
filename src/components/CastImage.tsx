import React, { useState, useEffect } from 'react';
import { electronService } from '../services/electron';
import { getImageUrl } from '../services/tmdb';

interface CastImageProps {
  name: string;
  profilePath: string | null;
  className?: string;
  alt: string;
}

export const CastImage: React.FC<CastImageProps> = ({ name, profilePath, className, alt }) => {
  const [src, setSrc] = useState<string | null>(profilePath ? getImageUrl(profilePath) : null);

  useEffect(() => {
    let mounted = true;

    const fetchImage = async () => {
      // If we have a TMDB profile path, use it
      if (profilePath) {
        setSrc(getImageUrl(profilePath));
        return;
      }

      // Try to fetch from local cache first
      const cacheKey = `actor_img_${name}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        if (mounted) {
            setSrc(cached);
        }
        return;
      }

      try {
        // Fallback to Google Search scrape via Electron Main Process
        const url = await electronService.getActorImage(name);
        if (mounted && url) {
          setSrc(url);
          sessionStorage.setItem(cacheKey, url);
        }
      } catch (e) {
        // console.error(e);
      }
    };

    fetchImage();

    return () => { mounted = false; };
  }, [name, profilePath]);

  if (!src) {
    // Render Initials or Placeholder
    return (
      <div className={`${className} bg-gray-800 flex items-center justify-center text-gray-400 border border-white/10`}>
         <span className="text-xs font-bold">{name.substring(0, 2).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        // If the fetched URL fails, hide the image and show fallback
        e.currentTarget.style.display = 'none';
        // We could replace with initials, but for now just let it be hidden or show parent background
      }}
    />
  );
};
