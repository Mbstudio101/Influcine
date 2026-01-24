import React, { useEffect, useRef, useId } from 'react';
import { useTVNavigation } from '../context/TVNavigationContext';
import clsx from 'clsx';

interface FocusableProps {
  children?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: () => void;
  className?: string;
  activeClassName?: string; // Class to apply when focused
  as?: React.ElementType; // Allow rendering as different tags (button, div, etc.)
  autoFocus?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const Focusable: React.FC<FocusableProps> = ({
  children,
  onFocus,
  onBlur,
  onEnter,
  className,
  activeClassName = 'ring-4 ring-primary scale-105 z-10', // Default TV focus style
  as: Component = 'div',
  autoFocus = false,
  onClick,
  ...props
}) => {
  const { focusedId, register, unregister, setFocusedId } = useTVNavigation();
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const isFocused = focusedId === id;

  useEffect(() => {
    if (ref.current) {
      register(id, ref.current);
    }
    return () => {
      unregister(id);
    };
  }, [id, register, unregister]);

  useEffect(() => {
    if (autoFocus) {
      setFocusedId(id);
    }
  }, [autoFocus, id, setFocusedId]);

  useEffect(() => {
    if (isFocused && onFocus) {
      onFocus();
    } else if (!isFocused && onBlur) {
      onBlur();
    }
  }, [isFocused, onFocus, onBlur]);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    setFocusedId(id, { preventScroll: true });
    if (onClick) onClick(e);
    if (onEnter) onEnter();
  };

  return (
    <Component
      ref={ref}
      className={clsx(
        'transition-all duration-200 outline-none',
        className,
        isFocused && activeClassName
      )}
      onClick={handleClick}
      data-focusable="true"
      {...props}
    >
      {children}
    </Component>
  );
};

export default Focusable;
