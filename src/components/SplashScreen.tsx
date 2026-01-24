import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;

    // Play sound
    const playSound = async () => {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('/sounds/intro.mp3');
          audioRef.current.volume = 0.5;
        }
        
        if (mounted && audioRef.current) {
          await audioRef.current.play();
        }
      } catch (error: unknown) {
        // Ignore AbortError which happens if component unmounts quickly (e.g. React StrictMode)
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error("Audio playback failed:", error);
        }
      }
    };

    playSound();

    // Sequence:
    // 0s: Start
    // 0.5s: Logo fade in
    // 3.5s: Fade out
    // 4.0s: Complete
    
    const timer = setTimeout(() => {
      if (mounted) {
        setIsVisible(false);
        setTimeout(onComplete, 1000); // Wait for exit animation
      }
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1, ease: "easeInOut" } }}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden drag-region"
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
