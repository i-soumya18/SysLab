/**
 * Context Menu Component
 * Provides right-click context menu for canvas components
 */

import React, { useEffect, useRef } from 'react';
import type { Component } from '../types';

interface ContextMenuProps {
  component: Component;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (componentId: string) => void;
  onDuplicate: (component: Component) => void;
  onConfigure: (component: Component) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  component,
  position,
  onClose,
  onDelete,
  onDuplicate,
  onConfigure
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close menu on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleDelete = () => {
    onDelete(component.id);
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicate(component);
    onClose();
  };

  const handleConfigure = () => {
    onConfigure(component);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        minWidth: '150px',
        padding: '4px 0'
      }}
    >
      <div
        onClick={handleConfigure}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#333',
          borderBottom: '1px solid #eee'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        ⚙️ Configure
      </div>
      
      <div
        onClick={handleDuplicate}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#333',
          borderBottom: '1px solid #eee'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        📋 Duplicate
      </div>
      
      <div
        onClick={handleDelete}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#dc3545'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        🗑️ Delete
      </div>
    </div>
  );
};