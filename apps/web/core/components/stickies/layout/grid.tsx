/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { forwardRef, useEffect, useRef, useState } from "react";
import Masonry from "react-masonry-component";
export function StickyColumns({ children }: { children: (columns: number) => React.ReactNode }) {
  const [width, setWidth] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.offsetWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const columns = width === null ? 4 : width < 640 ? 2 : width < 850 ? 3 : width < 1024 ? 4 : width < 1280 ? 5 : 6;
  return (
    <div ref={ref} className="size-full">
      {children(columns)}
    </div>
  );
}
export function StickyMasonry({ children }: { children: React.ReactNode }) {
  return (
    <div className="transition-opacity duration-300 ease-in-out">
      {
        // @ts-expect-error react-masonry-component's declaration omits supported children.
        <Masonry elementType="div" enableResizableChildren>
          {children}
        </Masonry>
      }
    </div>
  );
}

export const StickyGridItem = forwardRef<HTMLDivElement, { width: string; children: React.ReactNode }>(
  function StickyGridItem({ width, children }, ref) {
    return (
      <div ref={ref} className="box-border flex flex-col p-[8px]" style={{ width }}>
        {children}
      </div>
    );
  }
);
