/**
 * Resizable Card Component
 * A card/panel that can be resized vertically with a drag handle
 */

import React, { useRef, useState } from 'react';

interface ResizableCardProps {
  children: React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
  className?: string;
  title?: string;
  header?: React.ReactNode;
  onClose?: () => void;
  onResize?: (height: number) => void;
}

export const ResizableCard: React.FC<ResizableCardProps> = ({
  children,
  minHeight = 100,
  maxHeight = 800,
  defaultHeight = 200,
  className = '',
  title,
  header,
  onClose,
  onResize
}) => {
  const [height, setHeight] = useState(defaultHeight);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(defaultHeight);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = moveEvent.clientY - startYRef.current;
      const newHeight = Math.min(
        Math.max(startHeightRef.current + deltaY, minHeight),
        maxHeight
      );
      setHeight(newHeight);
      onResize?.(newHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col ${className}`}
      style={{ height: `${height}px` }}
    >
      {(title || header || onClose) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          {header || (title && <h3 className="text-sm font-semibold text-gray-800">{title}</h3>)}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">{children}</div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize card"
        className="h-1 cursor-row-resize bg-transparent hover:bg-blue-200 active:bg-blue-300 transition-colors"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};
