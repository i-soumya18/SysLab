/**
 * Connection Configuration Panel - Allows editing connection properties
 * Provides interface for configuring bandwidth, latency, protocol, and reliability
 */

import React, { useState, useEffect } from 'react';
import type { Connection, ConnectionConfig } from '../types';

interface ConnectionConfigPanelProps {
  connection: Connection | null;
  onUpdate: (connectionId: string, config: ConnectionConfig) => void;
  onClose: () => void;
}

export const ConnectionConfigPanel: React.FC<ConnectionConfigPanelProps> = ({
  connection,
  onUpdate,
  onClose
}) => {
  const [config, setConfig] = useState<ConnectionConfig>({
    bandwidth: 1000,
    latency: 10,
    protocol: 'HTTP',
    reliability: 0.99
  });

  // Update local config when connection changes
  useEffect(() => {
    if (connection) {
      setConfig(connection.configuration);
    }
  }, [connection]);

  if (!connection) return null;

  // Handle configuration changes
  const handleConfigChange = (field: keyof ConnectionConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onUpdate(connection.id, newConfig);
  };

  // Get protocol options based on connection type
  const getProtocolOptions = () => {
    return [
      { value: 'HTTP', label: 'HTTP', description: 'Web traffic, REST APIs' },
      { value: 'TCP', label: 'TCP', description: 'Reliable connection-oriented' },
      { value: 'UDP', label: 'UDP', description: 'Fast, connectionless' },
      { value: 'DATABASE', label: 'Database', description: 'Database connections' }
    ];
  };

  // Format bandwidth display
  const formatBandwidth = (bandwidth: number): string => {
    if (bandwidth >= 1000) {
      return `${bandwidth / 1000} Gbps`;
    }
    return `${bandwidth} Mbps`;
  };

  // Format latency display
  const formatLatency = (latency: number): string => {
    return `${latency} ms`;
  };

  // Format reliability display
  const formatReliability = (reliability: number): string => {
    return `${(reliability * 100).toFixed(1)}%`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        padding: '20px',
        width: '400px',
        zIndex: 1000
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: '#333' }}>Connection Configuration</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
          Connection ID: {connection.id.slice(0, 8)}...
        </div>
      </div>

      {/* Protocol Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
          Protocol
        </label>
        <select
          value={config.protocol}
          onChange={(e) => handleConfigChange('protocol', e.target.value as ConnectionConfig['protocol'])}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          {getProtocolOptions().map(option => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
      </div>

      {/* Bandwidth Configuration */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
          Bandwidth: {formatBandwidth(config.bandwidth)}
        </label>
        <input
          type="range"
          min="10"
          max="10000"
          step="10"
          value={config.bandwidth}
          onChange={(e) => handleConfigChange('bandwidth', parseInt(e.target.value))}
          style={{ width: '100%', marginBottom: '5px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
          <span>10 Mbps</span>
          <span>10 Gbps</span>
        </div>
      </div>

      {/* Latency Configuration */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
          Latency: {formatLatency(config.latency)}
        </label>
        <input
          type="range"
          min="1"
          max="1000"
          step="1"
          value={config.latency}
          onChange={(e) => handleConfigChange('latency', parseInt(e.target.value))}
          style={{ width: '100%', marginBottom: '5px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
          <span>1 ms</span>
          <span>1000 ms</span>
        </div>
      </div>

      {/* Reliability Configuration */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
          Reliability: {formatReliability(config.reliability)}
        </label>
        <input
          type="range"
          min="0.5"
          max="1"
          step="0.01"
          value={config.reliability}
          onChange={(e) => handleConfigChange('reliability', parseFloat(e.target.value))}
          style={{ width: '100%', marginBottom: '5px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Configuration Summary */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '12px', 
        borderRadius: '4px', 
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>Summary:</strong> {config.protocol} connection with {formatBandwidth(config.bandwidth)} bandwidth, 
        {formatLatency(config.latency)} latency, and {formatReliability(config.reliability)} reliability.
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};