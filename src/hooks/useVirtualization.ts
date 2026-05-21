import { useState, useMemo, useEffect } from 'react';

interface UseVirtualizationOptions {
  itemHeight: number;
  overscan?: number;
  containerHeight?: number;
}

export function useVirtualization<T>(
  items: T[],
  { itemHeight, overscan = 5, containerHeight = 400 }: UseVirtualizationOptions
) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const virtualItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index,
      top: (startIndex + index) * itemHeight,
    }));
  }, [items, startIndex, endIndex, itemHeight]);

  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    onScroll,
  };
}
