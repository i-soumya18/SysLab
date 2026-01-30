/**
 * Connection Wire Component - Renders visual connections between components
 * Handles wire drawing, selection, and styling based on connection type
 */

import React from 'react';
import type { Connection, Component } from '../types';

interface ConnectionWireProps {
  connection: Connection;
  sourceComponent: Component;
  targetComponent: Component;
  isSelected?: boolean;
  onSelect?: (connection: Connection) => void;
  onDelete?: (connectionId: string) => void;
  onContextMenu?: (connection: Connection, position: { x: number; y: number }) => void;
}

export const ConnectionWire: React.FC<ConnectionWireProps> = ({
  connection,
  sourceComponent,
  targetComponent,
  isSelected = false,
  onSelect,
  onDelete,
  onContextMenu
}) => {
  // Calculate connection points based on component positions and ports
  const getConnectionPoint = (component: Component, port: string) => {
    const baseX = component.position.x + 50; // Center of component (100px width / 2)
    const baseY = component.position.y + 40; // Center of component (80px height / 2)
    
    switch (port) {
      case 'top':
        return { x: baseX, y: component.position.y };
      case 'bottom':
        return { x: baseX, y: component.position.y + 80 };
      case 'left':
        return { x: component.position.x, y: baseY };
      case 'right':
        return { x: component.position.x + 100, y: baseY };
      default:
        return { x: baseX, y: baseY };
    }
  };

  const sourcePoint = getConnectionPoint(sourceComponent, connection.sourcePort);
  const targetPoint = getConnectionPoint(targetComponent, connection.targetPort);

  // Calculate control points for curved wire
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Create curved path for better visual appeal
  const controlOffset = Math.min(distance * 0.3, 100);
  const control1X = sourcePoint.x + (connection.sourcePort === 'right' ? controlOffset : 
                                   connection.sourcePort === 'left' ? -controlOffset : 0);
  const control1Y = sourcePoint.y + (connection.sourcePort === 'bottom' ? controlOffset : 
                                   connection.sourcePort === 'top' ? -controlOffset : 0);
  const control2X = targetPoint.x + (connection.targetPort === 'left' ? -controlOffset : 
                                   connection.targetPort === 'right' ? controlOffset : 0);
  const control2Y = targetPoint.y + (connection.targetPort === 'top' ? -controlOffset : 
                                   connection.targetPort === 'bottom' ? controlOffset : 0);

  const pathData = `M ${sourcePoint.x} ${sourcePoint.y} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetPoint.x} ${targetPoint.y}`;

  // Get wire styling based on connection type
  const getWireStyle = (protocol: string) => {
    const styles = {
      'HTTP': { 
        color: '#4CAF50', 
        strokeWidth: 2, 
        strokeDasharray: 'none',
        description: 'HTTP'
      },
      'TCP': { 
        color: '#2196F3', 
        strokeWidth: 3, 
        strokeDasharray: 'none',
        description: 'TCP'
      },
      'UDP': { 
        color: '#FF9800', 
        strokeWidth: 2, 
        strokeDasharray: '5,5',
        description: 'UDP'
      },
      'DATABASE': { 
        color: '#9C27B0', 
        strokeWidth: 4, 
        strokeDasharray: 'none',
        description: 'DB'
      }
    };
    return styles[protocol as keyof typeof styles] || styles.HTTP;
  };

  const wireStyle = getWireStyle(connection.configuration.protocol);

  // Get wire thickness based on bandwidth
  const getBandwidthThickness = (bandwidth: number): number => {
    // Scale bandwidth (10-10000 Mbps) to stroke width (1-8)
    const minBandwidth = 10;
    const maxBandwidth = 10000;
    const minWidth = 1;
    const maxWidth = 8;
    
    const normalizedBandwidth = Math.max(minBandwidth, Math.min(maxBandwidth, bandwidth));
    const thickness = minWidth + ((normalizedBandwidth - minBandwidth) / (maxBandwidth - minBandwidth)) * (maxWidth - minWidth);
    return Math.round(thickness);
  };

  // Get wire opacity based on reliability
  const getReliabilityOpacity = (reliability: number): number => {
    // Scale reliability (0.5-1.0) to opacity (0.4-1.0)
    return 0.4 + (reliability - 0.5) * 1.2;
  };

  const finalStrokeWidth = Math.max(wireStyle.strokeWidth, getBandwidthThickness(connection.configuration.bandwidth));
  const finalOpacity = isSelected ? 1 : getReliabilityOpacity(connection.configuration.reliability);

  // Handle wire click for selection
  const handleWireClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(connection);
  };

  // Handle right-click for context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(connection, { x: e.clientX, y: e.clientY });
    }
  };

  // Handle wire deletion
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && isSelected) {
      e.preventDefault();
      onDelete?.(connection.id);
    }
  };

  return (
    <g 
      className={`connection-wire ${isSelected ? 'connection-wire--selected' : ''}`}
      onClick={handleWireClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Main wire path */}
      <path
        d={pathData}
        fill="none"
        stroke={wireStyle.color}
        strokeWidth={finalStrokeWidth}
        strokeDasharray={wireStyle.strokeDasharray}
        opacity={finalOpacity}
        style={{
          cursor: 'pointer',
          filter: isSelected ? 'drop-shadow(0 0 6px rgba(0, 123, 255, 0.6))' : 'none'
        }}
      />
      
      {/* Invisible wider path for easier clicking */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(12, finalStrokeWidth + 8)}
        style={{ cursor: 'pointer' }}
      />
      
      {/* Arrow marker at target */}
      <defs>
        <marker
          id={`arrowhead-${connection.id}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={wireStyle.color}
            opacity={finalOpacity}
          />
        </marker>
      </defs>
      
      {/* Arrow path */}
      <path
        d={pathData}
        fill="none"
        stroke={wireStyle.color}
        strokeWidth={finalStrokeWidth}
        strokeDasharray={wireStyle.strokeDasharray}
        markerEnd={`url(#arrowhead-${connection.id})`}
        opacity={finalOpacity}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Connection label */}
      {isSelected && (
        <g>
          <text
            x={(sourcePoint.x + targetPoint.x) / 2}
            y={(sourcePoint.y + targetPoint.y) / 2 - 15}
            textAnchor="middle"
            fontSize="12"
            fill={wireStyle.color}
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            {wireStyle.description}
          </text>
          <text
            x={(sourcePoint.x + targetPoint.x) / 2}
            y={(sourcePoint.y + targetPoint.y) / 2 - 2}
            textAnchor="middle"
            fontSize="10"
            fill="#666"
            style={{ pointerEvents: 'none' }}
          >
            {connection.configuration.bandwidth >= 1000 
              ? `${connection.configuration.bandwidth / 1000}Gbps` 
              : `${connection.configuration.bandwidth}Mbps`}
          </text>
          <text
            x={(sourcePoint.x + targetPoint.x) / 2}
            y={(sourcePoint.y + targetPoint.y) / 2 + 11}
            textAnchor="middle"
            fontSize="10"
            fill="#666"
            style={{ pointerEvents: 'none' }}
          >
            {connection.configuration.latency}ms, {(connection.configuration.reliability * 100).toFixed(1)}%
          </text>
        </g>
      )}
      
      {/* Selection indicator */}
      {isSelected && (
        <circle
          cx={(sourcePoint.x + targetPoint.x) / 2}
          cy={(sourcePoint.y + targetPoint.y) / 2}
          r="6"
          fill="rgba(0, 123, 255, 0.3)"
          stroke="#007bff"
          strokeWidth="2"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  );
};