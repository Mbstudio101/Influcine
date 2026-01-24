import React from 'react';
import clsx from 'clsx';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  textClassName?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'md', textClassName = '' }) => {
  const sizeClasses = {
    sm: { container: 'w-6 h-6', icon: 'w-3 h-3', text: 'text-sm', subtext: 'text-[8px]' },
    md: { container: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-xl', subtext: 'text-[10px]' },
    lg: { container: 'w-16 h-16', icon: 'w-8 h-8', text: 'text-3xl', subtext: 'text-xs' },
    xl: { container: 'w-32 h-32', icon: 'w-16 h-16', text: 'text-6xl', subtext: 'text-xl' },
  };

  const s = sizeClasses[size];

  return (
    <div className={clsx("flex items-center gap-3 select-none", className)}>
      <div className={clsx("relative flex items-center justify-center shrink-0", s.container)}>
        <div className="absolute inset-0 bg-primary/20 rounded-xl transform rotate-6 transition-transform group-hover:rotate-12"></div>
        <div className="absolute inset-0 bg-primary/20 rounded-xl transform -rotate-6 transition-transform group-hover:-rotate-12"></div>
        <div className="relative w-full h-full bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.3)] group-hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] transition-shadow duration-300">
           <svg 
             viewBox="0 0 24 24" 
             fill="none" 
             stroke="currentColor" 
             strokeWidth="0" 
             className={clsx("text-primary drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]", s.icon)}
           >
             <path d="M5 3L19 12L5 21V3Z" fill="currentColor" />
           </svg>
        </div>
      </div>
      
      {showText && (
        <div className={clsx("flex flex-col justify-center whitespace-nowrap", textClassName)}>
          <h1 className={clsx("font-black tracking-tight bg-linear-to-r from-white via-primary/50 to-white bg-clip-text text-transparent leading-none", s.text)}>
            Influcine
          </h1>
          {size !== 'sm' && (
            <span className={clsx("font-bold text-primary tracking-[0.3em] uppercase leading-none opacity-80 mt-0.5", s.subtext)}>
              Stream
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
