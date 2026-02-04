
import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
  width?: string | number;
  height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  variant = 'rectangular',
  width,
  height
}) => {
  const baseStyles = "bg-white/10 animate-pulse";
  const variantStyles = {
    rectangular: "rounded-lg",
    circular: "rounded-full",
    text: "rounded h-4"
  };

  const style = {
    width: width,
    height: height
  };

  return (
    <div 
      className={clsx(baseStyles, variantStyles[variant], className)} 
      style={style}
    />
  );
};

export default Skeleton;
