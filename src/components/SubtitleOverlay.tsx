import React, { useEffect, useState } from 'react';
import { SubtitleCue } from '../utils/subtitleParser';

interface SubtitleOverlayProps {
  subtitles: SubtitleCue[];
  currentTime: number;
  offset?: number; // In seconds
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ subtitles, currentTime, offset = 0 }) => {
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);

  useEffect(() => {
    const time = currentTime + offset;
    // Find active cue
    // Optimize: if cues are sorted, we can binary search or keep track of index
    // For now, simple linear scan (usually < 2000 items)
    const cue = subtitles.find(c => time >= c.start && time <= c.end);
    setActiveCue(cue || null);
  }, [currentTime, subtitles, offset]);

  if (!activeCue) return null;

  return (
    <div className="absolute bottom-16 left-0 right-0 text-center pointer-events-none z-50 px-4">
      <span 
        className="inline-block px-3 py-1 bg-black/60 text-white text-lg md:text-xl lg:text-2xl font-medium rounded-lg shadow-lg backdrop-blur-sm"
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
        dangerouslySetInnerHTML={{ __html: activeCue.text }}
      />
    </div>
  );
};
