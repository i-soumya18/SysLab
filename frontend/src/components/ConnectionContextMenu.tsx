/**
 * Connection Context Menu - Right-click menu for connections
 * Provides options to configure or delete connections
 */

import React, { useEffect, useRef } from 'react';
import type { Connection } from '../types';

interface ConnectionContextMenuProps {
  connection: Connection;
  position: { x: number; y: number };
  onClose: () => void;
  onConfigure: (connection: Connection) => void;
  onDelete: (connectionId: string) => void;
}

export const ConnectionContextMenu: React.FC<ConnectionContextMenuProps> = ({
  connection,
  position,
  onClose,
  onConfigure,
  onDelete
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

  // Handle keyboard shortcuts
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

  const handleConfigure = () => {
    onConfigure(connection);
    onClose();
  };

  const handleDelete = () => {
    onDelete(connection.id);
    onClose();
  };

  // Get protocol color for visual indication
  const getProtocolColor = (protocol: string) => {
    const colors = {
      'HTTP': '#4CAF50',
      'TCP': '#2196F3',
      'UDP': '#FF9800',
      'DATABASE': '#9C27B0'
    };
    return colors[protocol as keyof typeof colors] || '#666';
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '8px 0',
        minWidth: '180px',
        zIndex: 1000,
        fontSize: '14px'
      }}
    >
      {/* Connection Info Header */}
      <div style={{ 
        padding: '8px 16px', 
        borderBottom: '1px solid #eee', 
        marginBottom: '4px',
        color: '#666',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '12px', 
              height: '3px', 
              backgroundColor: getProtocolColor(connection.configuration.protocol),
              borderRadius: '2px'
            }} 
          />
          <span>{connection.configuration.protocol} Connection</span>
        </div>
        <div style={{ marginTop: '4px' }}>
          {connection.configuration.bandwidth >= 1000 
            ? `${connection.configuration.bandwidth / 1000} Gbps` 
            : `${connection.configuration.bandwidth} Mbps`} • {connection.configuration.latency}ms
        </div>
      </div>

      {/* Menu Items */}
      <button
        onClick={handleConfigure}
        style={{
          width: '100%',
          padding: '8px 16px',
          border: 'none',
          backgroundColor: 'transparent',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>⚙️</span>
        Configure Connection
      </button>

      <button
        onClick={handleDelete}
        style={{
          width: '100%',
          padding: '8px 16px',
          border: 'none',
          backgroundColor: 'transparent',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#dc3545',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>🗑️</span>
        Delete Connection
      </button>
    </div>
  );
};