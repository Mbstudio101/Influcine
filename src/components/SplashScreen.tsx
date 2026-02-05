import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import introSound from '../assets/sounds/intro.mp3';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const initSequence = async () => {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(introSound);
          audioRef.current.volume = 0.5;
        }

        const startPlayback = async () => {
            if (!mounted || startedRef.current) return;
            startedRef.current = true;
            
            try {
                await audioRef.current?.play();
            } catch (e) {
                // Autoplay might be blocked, continue anyway
            }
            
            setIsReady(true);
            
            // Sequence:
            // 0s: Start (Audio + Visuals)
            // 2.0s: Fade out
            // 2.5s: Complete
            setTimeout(() => {
                if (mounted) {
                    setIsVisible(false);
                }
            }, 2000);
        };

        // Try to wait for audio, but don't block too long
        if (audioRef.current) {
            if (audioRef.current.readyState >= 3) {
                startPlayback();
            } else {
                audioRef.current.addEventListener('canplaythrough', startPlayback, { once: true });
                // Fallback if audio fails to load quickly
                setTimeout(() => {
                    if (mounted) startPlayback();
                }, 1000);
            }
        } else {
            startPlayback();
        }

      } catch (error) {
        if (mounted && !startedRef.current) {
            startedRef.current = true;
            setIsReady(true);
            setIsVisible(false);
        }
      }
    };

    initSequence();

    return () => {
      mounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1, ease: "easeInOut" } }}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden drag-region"
        >
            {isReady && (
                <>
                {/* Ambient Background Effects */}
                <motion.div 
                    animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3] 
                    }}
                    transition={{ duration: 4, ease: "easeInOut" }}
                    className="absolute inset-0 bg-radial-gradient from-primary/20 to-transparent opacity-30"
                />

                <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                    initial={{ scale: 0.5, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ 
                        duration: 1.5, 
                        ease: "easeOut",
                        type: "spring",
                        bounce: 0.3
                    }}
                    >
                    <Logo size="xl" showText={false} />
                    </motion.div>
                    
                    <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    transition={{ delay: 1.0, duration: 1.0 }}
                    className="mt-6 overflow-hidden whitespace-nowrap"
                    >
                    <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-linear-to-r from-primary via-white to-primary tracking-[0.2em] uppercase font-['Cinzel']">
                        Influcine
                    </h1>
                    </motion.div>
                    
                    <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.5, duration: 0.8 }}
                    className="h-[2px] w-32 bg-primary mt-4 rounded-full"
                    />
                </div>
                </>
            )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
