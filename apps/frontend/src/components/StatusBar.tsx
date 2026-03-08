/**
 * Status Bar Component
 * Shows current selection status and keyboard shortcuts
 */

import React from 'react';
import type { Component } from '../types';

interface StatusBarProps {
  selectedComponent: Component | null;
  componentCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  selectedComponent,
  componentCount
}) => {
  return (
    <div style={{
      height: '30px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '12px',
      color: '#666'
    }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <span>Components: {componentCount}</span>
        {selectedComponent && (
          <span style={{ color: '#007bff', fontWeight: 'bold' }}>
            Selected: {selectedComponent.metadata.name}
          </span>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
        <span>Right-click: Context menu</span>
        <span>Del: Delete</span>
        <span>Ctrl+D: Duplicate</span>
        <span>Esc: Deselect</span>
      </div>
    </div>
  );
};