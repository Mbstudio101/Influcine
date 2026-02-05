import { useState, useEffect } from 'react';
import { electronService } from '../services/electron';
import { parseSubtitle, SubtitleCue } from '../utils/subtitleParser';

export interface SubtitleFile {
  url: string;
  lang: string;
  label: string;
}

export function usePlayerSubtitles(
  videoRef: React.RefObject<HTMLVideoElement>,
  isEmbed: boolean,
  mediaData: { imdbId?: string; season?: number; episode?: number } | undefined,
  src: string | undefined
) {
  const [availableSubtitles, setAvailableSubtitles] = useState<TextTrack[]>([]);
  const [externalSubtitles, setExternalSubtitles] = useState<SubtitleFile[]>([]);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(-1); // -1 = Off
  const [customSubtitles, setCustomSubtitles] = useState<SubtitleCue[]>([]);
  const [embedTracks, setEmbedTracks] = useState<{index: number, label: string, language: string}[]>([]);
  const [activeEmbedTrackIndex, setActiveEmbedTrackIndex] = useState(-1);
  const [autoSubtitles, setAutoSubtitles] = useState<{label: string, content: string}[]>([]);
  const [activeAutoSubtitleIndex, setActiveAutoSubtitleIndex] = useState(-1);
  const [isSearchingSubs, setIsSearchingSubs] = useState(false);

  // Fetch External Subtitles (Trailer protocol)
  useEffect(() => {
    if (src && src.startsWith('trailer://')) {
      const videoId = src.replace('trailer://', '').replace('.mp4', '');
      electronService.getSubtitles(videoId)
        .then((subs) => {
          setExternalSubtitles(subs);
        })
        .catch(() => setExternalSubtitles([]));
    } else {
      setExternalSubtitles([]);
    }
  }, [src]);

  // Sync textTracks from Video Element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isEmbed) return;

    const updateSubtitles = () => {
      const subs: TextTrack[] = [];
      let activeIndex = -1;
      if (video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          subs.push(track);
          if (track.mode === 'showing') {
            activeIndex = i;
          }
        }
      }
      setAvailableSubtitles(subs);
      setActiveSubtitleIndex(activeIndex);
    };

    updateSubtitles();

    const tracks = video.textTracks;
    if (tracks) {
      tracks.addEventListener('addtrack', updateSubtitles);
      tracks.addEventListener('removetrack', updateSubtitles);
      tracks.addEventListener('change', updateSubtitles);
      
      return () => {
        tracks.removeEventListener('addtrack', updateSubtitles);
        tracks.removeEventListener('removetrack', updateSubtitles);
        tracks.removeEventListener('change', updateSubtitles);
      };
    }
  }, [isEmbed, externalSubtitles, videoRef]);

  // Auto-Fetch Subtitles for Embeds
  useEffect(() => {
    if (!mediaData?.imdbId || !isEmbed) return;
    
    const fetchSubs = async () => {
        setIsSearchingSubs(true);
        try {
            const subs = await electronService.autoFetchSubtitles(mediaData);
            if (subs && subs.length > 0) {
                setAutoSubtitles(subs);
                // If no embed tracks found, auto-select first result
                if (embedTracks.length === 0 && customSubtitles.length === 0) {
                    const cues = parseSubtitle(subs[0].content);
                    setCustomSubtitles(cues);
                    setActiveAutoSubtitleIndex(0);
                }
            }
        } catch (e) {
            // console.error("Auto-fetch failed", e);
        } finally {
            setIsSearchingSubs(false);
        }
    };

    fetchSubs();
  }, [mediaData?.imdbId, isEmbed, embedTracks.length, customSubtitles.length, mediaData]);

  const loadAutoSubtitle = (index: number) => {
      if (index === -1) {
          setActiveAutoSubtitleIndex(-1);
          if (activeEmbedTrackIndex === -1) setCustomSubtitles([]);
          return;
      }
      
      const sub = autoSubtitles[index];
      if (sub) {
          const cues = parseSubtitle(sub.content);
          setCustomSubtitles(cues);
          setActiveAutoSubtitleIndex(index);
          setActiveEmbedTrackIndex(-1); // Deselect embed track
      }
  };

  return {
    availableSubtitles,
    externalSubtitles,
    activeSubtitleIndex,
    setActiveSubtitleIndex,
    customSubtitles,
    setCustomSubtitles,
    embedTracks,
    setEmbedTracks,
    activeEmbedTrackIndex,
    setActiveEmbedTrackIndex,
    autoSubtitles,
    activeAutoSubtitleIndex,
    loadAutoSubtitle,
    isSearchingSubs
  };
}
