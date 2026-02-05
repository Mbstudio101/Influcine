import React from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import MediaCard from './MediaCard';
import { Media } from '../types';
import { motion } from 'framer-motion';

interface VirtualMediaGridProps {
  items: Media[];
  header?: React.ReactNode;
  renderItem?: (item: Media) => React.ReactNode;
}

const GridList = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{
      ...style,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', // Standard card width
      gap: '1.5rem', // gap-6
      paddingTop: '2.5rem',
      paddingBottom: '2.5rem',
      paddingLeft: '4rem',
      paddingRight: '4rem',
    }}
  >
    {children}
  </div>
));

const VirtualMediaGrid: React.FC<VirtualMediaGridProps> = ({ items, header, renderItem }) => {
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <VirtuosoGrid
        totalCount={items.length}
        components={{ Header: () => <>{header}</>, List: GridList }}
        itemContent={(index) => {
            const item = items[index];
            if (renderItem) return <>{renderItem(item)}</>;
            return (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                >
                    <MediaCard media={item} />
                </motion.div>
            );
        }}
      />
    </div>
  );
};

export default VirtualMediaGrid;
