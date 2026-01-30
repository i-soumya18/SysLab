/**
 * Component Configuration Panel
 * Dynamic configuration UI based on component type with parameter validation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Component, ComponentConfig, ComponentType } from '../types';
import { componentLibrary } from './ComponentLibrary';

interface ComponentConfigPanelProps {
  component: Component;
  onUpdate: (component: Component) => void;
  onClose?: () => void;
  enableRealTimeUpdates?: boolean;
  enablePreview?: boolean;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'boolean' | 'slider';
  value: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: any; label: string }[];
  unit?: string;
  description?: string;
  validation?: (value: any) => string | null;
}

interface ConfigHistoryEntry {
  timestamp: number;
  config: ComponentConfig;
  description: string;
}

export const ComponentConfigPanel: React.FC<ComponentConfigPanelProps> = ({
  component,
  onUpdate,
  onClose,
  enableRealTimeUpdates = true,
  enablePreview: _enablePreview = true
}) => {
  const [config, setConfig] = useState<ComponentConfig>(component.configuration);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [_previewMode, _setPreviewMode] = useState(false);
  const realTimeUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when component changes
  useEffect(() => {
    setConfig(component.configuration);
    setErrors({});
    setHasChanges(false);
    
    // Initialize history with current configuration
    const initialEntry: ConfigHistoryEntry = {
      timestamp: Date.now(),
      config: component.configuration,
      description: 'Initial configuration'
    };
    setHistory([initialEntry]);
    setHistoryIndex(0);
  }, [component]);

  // Add configuration to history
  const addToHistory = useCallback((newConfig: ComponentConfig, description: string) => {
    const entry: ConfigHistoryEntry = {
      timestamp: Date.now(),
      config: { ...newConfig },
      description
    };
    
    setHistory(prev => {
      // Remove any entries after current index (when undoing and making new changes)
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(entry);
      
      // Limit history to 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Undo configuration change
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const previousEntry = history[historyIndex - 1];
      setConfig(previousEntry.config);
      setHistoryIndex(prev => prev - 1);
      setHasChanges(true);
      
      if (enableRealTimeUpdates) {
        // Apply undo immediately in real-time mode
        const updatedComponent = {
          ...component,
          configuration: previousEntry.config
        };
        onUpdate(updatedComponent);
      }
    }
  }, [historyIndex, history, component, onUpdate, enableRealTimeUpdates]);

  // Redo configuration change
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextEntry = history[historyIndex + 1];
      setConfig(nextEntry.config);
      setHistoryIndex(prev => prev + 1);
      setHasChanges(true);
      
      if (enableRealTimeUpdates) {
        // Apply redo immediately in real-time mode
        const updatedComponent = {
          ...component,
          configuration: nextEntry.config
        };
        onUpdate(updatedComponent);
      }
    }
  }, [historyIndex, history, component, onUpdate, enableRealTimeUpdates]);

  // Real-time update with debouncing
  const scheduleRealTimeUpdate = useCallback((newConfig: ComponentConfig) => {
    if (!enableRealTimeUpdates) return;
    
    // Clear existing timeout
    if (realTimeUpdateTimeoutRef.current) {
      clearTimeout(realTimeUpdateTimeoutRef.current);
    }
    
    // Schedule new update with debouncing (300ms delay)
    realTimeUpdateTimeoutRef.current = setTimeout(() => {
      const updatedComponent = {
        ...component,
        configuration: newConfig
      };
      onUpdate(updatedComponent);
    }, 300);
  }, [component, onUpdate, enableRealTimeUpdates]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (realTimeUpdateTimeoutRef.current) {
        clearTimeout(realTimeUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Generate configuration fields based on component type
  const getConfigFields = useCallback((componentType: ComponentType, currentConfig: ComponentConfig): ConfigField[] => {
    const baseFields: ConfigField[] = [
      {
        key: 'capacity',
        label: 'Capacity',
        type: 'slider',
        value: currentConfig.capacity,
        min: 100,
        max: 100000,
        step: 100,
        unit: 'req/s',
        description: 'Maximum requests per second the component can handle',
        validation: (value) => value <= 0 ? 'Capacity must be greater than 0' : null
      },
      {
        key: 'latency',
        label: 'Latency',
        type: 'slider',
        value: currentConfig.latency,
        min: 0.1,
        max: 1000,
        step: 0.1,
        unit: 'ms',
        description: 'Average response time in milliseconds',
        validation: (value) => value < 0 ? 'Latency cannot be negative' : null
      },
      {
        key: 'failureRate',
        label: 'Failure Rate',
        type: 'slider',
        value: currentConfig.failureRate,
        min: 0,
        max: 0.1,
        step: 0.0001,
        unit: '%',
        description: 'Probability of request failure (0-10%)',
        validation: (value) => (value < 0 || value > 1) ? 'Failure rate must be between 0 and 1' : null
      }
    ];

    // Add component-specific fields
    switch (componentType) {
      case 'database':
        return [
          ...baseFields,
          {
            key: 'connectionPool',
            label: 'Connection Pool Size',
            type: 'slider',
            value: currentConfig.connectionPool || 100,
            min: 10,
            max: 1000,
            step: 10,
            description: 'Maximum number of concurrent database connections'
          },
          {
            key: 'queryCache',
            label: 'Query Cache',
            type: 'boolean',
            value: currentConfig.queryCache ?? true,
            description: 'Enable query result caching'
          },
          {
            key: 'replicationEnabled',
            label: 'Replication',
            type: 'boolean',
            value: currentConfig.replicationEnabled ?? false,
            description: 'Enable database replication for high availability'
          },
          {
            key: 'storageType',
            label: 'Storage Type',
            type: 'select',
            value: currentConfig.storageType || 'SSD',
            options: [
              { value: 'SSD', label: 'SSD (Fast)' },
              { value: 'HDD', label: 'HDD (Slow)' },
              { value: 'NVMe', label: 'NVMe (Fastest)' }
            ],
            description: 'Type of storage medium'
          }
        ];

      case 'load-balancer':
        return [
          ...baseFields,
          {
            key: 'algorithm',
            label: 'Load Balancing Algorithm',
            type: 'select',
            value: currentConfig.algorithm || 'round-robin',
            options: [
              { value: 'round-robin', label: 'Round Robin' },
              { value: 'least-connections', label: 'Least Connections' },
              { value: 'weighted-round-robin', label: 'Weighted Round Robin' },
              { value: 'ip-hash', label: 'IP Hash' }
            ],
            description: 'Algorithm for distributing requests'
          },
          {
            key: 'healthCheck',
            label: 'Health Checks',
            type: 'boolean',
            value: currentConfig.healthCheck ?? true,
            description: 'Enable health checking of backend servers'
          },
          {
            key: 'sslTermination',
            label: 'SSL Termination',
            type: 'boolean',
            value: currentConfig.sslTermination ?? false,
            description: 'Terminate SSL connections at the load balancer'
          }
        ];

      case 'web-server':
        return [
          ...baseFields,
          {
            key: 'maxConnections',
            label: 'Max Connections',
            type: 'slider',
            value: currentConfig.maxConnections || 1000,
            min: 50,
            max: 10000,
            step: 50,
            description: 'Maximum concurrent connections'
          },
          {
            key: 'keepAlive',
            label: 'Keep-Alive',
            type: 'boolean',
            value: currentConfig.keepAlive ?? true,
            description: 'Enable HTTP keep-alive connections'
          },
          {
            key: 'compression',
            label: 'Compression',
            type: 'boolean',
            value: currentConfig.compression ?? true,
            description: 'Enable response compression (gzip)'
          },
          {
            key: 'caching',
            label: 'Static Caching',
            type: 'boolean',
            value: currentConfig.caching ?? false,
            description: 'Enable static file caching'
          }
        ];

      case 'cache':
        return [
          ...baseFields,
          {
            key: 'memorySize',
            label: 'Memory Size',
            type: 'select',
            value: currentConfig.memorySize || '4GB',
            options: [
              { value: '1GB', label: '1 GB' },
              { value: '2GB', label: '2 GB' },
              { value: '4GB', label: '4 GB' },
              { value: '8GB', label: '8 GB' },
              { value: '16GB', label: '16 GB' }
            ],
            description: 'Amount of memory allocated for caching'
          },
          {
            key: 'hitRatio',
            label: 'Target Hit Ratio',
            type: 'slider',
            value: currentConfig.hitRatio || 0.85,
            min: 0.1,
            max: 0.99,
            step: 0.01,
            unit: '%',
            description: 'Target cache hit ratio'
          },
          {
            key: 'evictionPolicy',
            label: 'Eviction Policy',
            type: 'select',
            value: currentConfig.evictionPolicy || 'LRU',
            options: [
              { value: 'LRU', label: 'Least Recently Used' },
              { value: 'LFU', label: 'Least Frequently Used' },
              { value: 'FIFO', label: 'First In, First Out' },
              { value: 'random', label: 'Random' }
            ],
            description: 'Policy for removing items when cache is full'
          }
        ];

      case 'message-queue':
        return [
          ...baseFields,
          {
            key: 'partitions',
            label: 'Partitions',
            type: 'slider',
            value: currentConfig.partitions || 10,
            min: 1,
            max: 100,
            step: 1,
            description: 'Number of message partitions'
          },
          {
            key: 'replication',
            label: 'Replication Factor',
            type: 'slider',
            value: currentConfig.replication || 3,
            min: 1,
            max: 10,
            step: 1,
            description: 'Number of message replicas'
          },
          {
            key: 'retention',
            label: 'Message Retention',
            type: 'select',
            value: currentConfig.retention || '7d',
            options: [
              { value: '1h', label: '1 Hour' },
              { value: '1d', label: '1 Day' },
              { value: '7d', label: '7 Days' },
              { value: '30d', label: '30 Days' }
            ],
            description: 'How long to keep messages'
          }
        ];

      case 'cdn':
        return [
          ...baseFields,
          {
            key: 'edgeLocations',
            label: 'Edge Locations',
            type: 'slider',
            value: currentConfig.edgeLocations || 200,
            min: 10,
            max: 500,
            step: 10,
            description: 'Number of edge server locations'
          },
          {
            key: 'cacheHitRatio',
            label: 'Cache Hit Ratio',
            type: 'slider',
            value: currentConfig.cacheHitRatio || 0.95,
            min: 0.5,
            max: 0.99,
            step: 0.01,
            unit: '%',
            description: 'Percentage of requests served from cache'
          },
          {
            key: 'compressionEnabled',
            label: 'Compression',
            type: 'boolean',
            value: currentConfig.compressionEnabled ?? true,
            description: 'Enable content compression'
          }
        ];

      case 'proxy':
        return [
          ...baseFields,
          {
            key: 'forwardProxy',
            label: 'Forward Proxy',
            type: 'boolean',
            value: currentConfig.forwardProxy ?? true,
            description: 'Enable forward proxy functionality'
          },
          {
            key: 'reverseProxy',
            label: 'Reverse Proxy',
            type: 'boolean',
            value: currentConfig.reverseProxy ?? false,
            description: 'Enable reverse proxy functionality'
          },
          {
            key: 'cacheSize',
            label: 'Cache Size',
            type: 'select',
            value: currentConfig.cacheSize || '1GB',
            options: [
              { value: '256MB', label: '256 MB' },
              { value: '512MB', label: '512 MB' },
              { value: '1GB', label: '1 GB' },
              { value: '2GB', label: '2 GB' }
            ],
            description: 'Size of proxy cache'
          }
        ];

      default:
        return baseFields;
    }
  }, []);

  const configFields = getConfigFields(component.type, config);

  // Handle field value changes
  const handleFieldChange = useCallback((key: string, value: any, addToHistoryFlag = true) => {
    const field = configFields.find(f => f.key === key);
    
    // Validate the new value
    let error = null;
    if (field?.validation) {
      error = field.validation(value);
    }

    // Update errors
    setErrors(prev => ({
      ...prev,
      [key]: error || ''
    }));

    // Update config
    const newConfig = {
      ...config,
      [key]: value
    };
    
    setConfig(newConfig);
    setHasChanges(true);

    // Add to history if requested and no validation errors
    if (addToHistoryFlag && !error) {
      addToHistory(newConfig, `Changed ${field?.label || key} to ${value}`);
    }

    // Schedule real-time update if enabled and no validation errors
    if (!error) {
      scheduleRealTimeUpdate(newConfig);
    }
  }, [configFields, config, addToHistory, scheduleRealTimeUpdate]);

  // Apply changes to component
  const handleApply = useCallback(() => {
    // Check for validation errors
    const hasErrors = Object.values(errors).some(error => error);
    if (hasErrors) {
      return;
    }

    const updatedComponent = {
      ...component,
      configuration: config
    };

    onUpdate(updatedComponent);
    setHasChanges(false);
    
    // Add to history
    addToHistory(config, 'Applied configuration changes');
  }, [component, config, errors, onUpdate, addToHistory]);

  // Reset to original values
  const handleReset = useCallback(() => {
    const originalConfig = component.configuration;
    setConfig(originalConfig);
    setErrors({});
    setHasChanges(false);
    
    // Add to history
    addToHistory(originalConfig, 'Reset to original configuration');
    
    // Apply reset immediately if real-time updates are enabled
    if (enableRealTimeUpdates) {
      const updatedComponent = {
        ...component,
        configuration: originalConfig
      };
      onUpdate(updatedComponent);
    }
  }, [component, addToHistory, enableRealTimeUpdates, onUpdate]);

  // Load preset configuration
  const handleLoadPreset = useCallback((presetName: string) => {
    const presets = componentLibrary.getPresetConfigurations(component.type);
    const preset = presets[presetName];
    
    if (preset) {
      setConfig(preset);
      setErrors({});
      setHasChanges(true);
      
      // Add to history
      addToHistory(preset, `Loaded preset: ${presetName}`);
      
      // Apply preset immediately if real-time updates are enabled
      if (enableRealTimeUpdates) {
        scheduleRealTimeUpdate(preset);
      }
    }
  }, [component.type, addToHistory, enableRealTimeUpdates, scheduleRealTimeUpdate]);

  // Render input field based on type
  const renderField = (field: ConfigField) => {
    const hasError = errors[field.key];

    switch (field.type) {
      case 'slider':
        return (
          <div key={field.key} style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: hasError ? '#dc3545' : '#333'
            }}>
              {field.label}
              {field.unit && (
                <span style={{ fontWeight: 'normal', color: '#666' }}>
                  {' '}({field.unit})
                </span>
              )}
            </label>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={field.value}
                onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: '#ddd',
                  outline: 'none'
                }}
              />
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={field.value}
                onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value))}
                style={{
                  width: '80px',
                  padding: '4px 8px',
                  border: `1px solid ${hasError ? '#dc3545' : '#ddd'}`,
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              />
            </div>
            
            {field.description && (
              <div style={{
                fontSize: '11px',
                color: '#666',
                marginTop: '4px'
              }}>
                {field.description}
              </div>
            )}
            
            {hasError && (
              <div style={{
                fontSize: '11px',
                color: '#dc3545',
                marginTop: '4px'
              }}>
                {hasError}
              </div>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.key} style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: hasError ? '#dc3545' : '#333'
            }}>
              {field.label}
            </label>
            
            <select
              value={field.value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${hasError ? '#dc3545' : '#ddd'}`,
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: '#fff'
              }}
            >
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            {field.description && (
              <div style={{
                fontSize: '11px',
                color: '#666',
                marginTop: '4px'
              }}>
                {field.description}
              </div>
            )}
            
            {hasError && (
              <div style={{
                fontSize: '11px',
                color: '#dc3545',
                marginTop: '4px'
              }}>
                {hasError}
              </div>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.key} style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px'
                }}
              />
              {field.label}
            </label>
            
            {field.description && (
              <div style={{
                fontSize: '11px',
                color: '#666',
                marginTop: '4px',
                marginLeft: '24px'
              }}>
                {field.description}
              </div>
            )}
          </div>
        );

      case 'number':
      case 'text':
      default:
        return (
          <div key={field.key} style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: hasError ? '#dc3545' : '#333'
            }}>
              {field.label}
              {field.unit && (
                <span style={{ fontWeight: 'normal', color: '#666' }}>
                  {' '}({field.unit})
                </span>
              )}
            </label>
            
            <input
              type={field.type}
              value={field.value}
              onChange={(e) => handleFieldChange(field.key, 
                field.type === 'number' ? parseFloat(e.target.value) : e.target.value
              )}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${hasError ? '#dc3545' : '#ddd'}`,
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            
            {field.description && (
              <div style={{
                fontSize: '11px',
                color: '#666',
                marginTop: '4px'
              }}>
                {field.description}
              </div>
            )}
            
            {hasError && (
              <div style={{
                fontSize: '11px',
                color: '#dc3545',
                marginTop: '4px'
              }}>
                {hasError}
              </div>
            )}
          </div>
        );
    }
  };

  // Get available presets for this component type
  const presets = componentLibrary.getPresetConfigurations(component.type);
  const presetNames = Object.keys(presets);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            if (e.shiftKey) {
              // Ctrl+Shift+Z or Cmd+Shift+Z for redo
              e.preventDefault();
              handleRedo();
            } else {
              // Ctrl+Z or Cmd+Z for undo
              e.preventDefault();
              handleUndo();
            }
            break;
          case 'y':
            // Ctrl+Y or Cmd+Y for redo (alternative)
            e.preventDefault();
            handleRedo();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
      <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      width: '350px',
      maxHeight: '80vh',
      backgroundColor: '#fff',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #eee',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            Configure Component
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#666',
                padding: '0',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          )}
        </div>
        
        <div style={{
          fontSize: '14px',
          color: '#666',
          marginTop: '4px'
        }}>
          {component.metadata.name}
        </div>
        
        {/* Real-time and History Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          gap: '8px'
        }}>
          {/* Real-time toggle */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#333',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={enableRealTimeUpdates}
              onChange={(_e) => {
                // This would need to be passed from parent component
                // For now, just show the current state
              }}
              disabled={true}
              style={{ width: '14px', height: '14px' }}
            />
            Real-time Updates
          </label>
          
          {/* History controls */}
          <div style={{
            display: 'flex',
            gap: '4px'
          }}>
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
              style={{
                padding: '4px 8px',
                backgroundColor: historyIndex > 0 ? '#6c757d' : '#e9ecef',
                color: historyIndex > 0 ? '#fff' : '#6c757d',
                border: 'none',
                borderRadius: '3px',
                cursor: historyIndex > 0 ? 'pointer' : 'not-allowed',
                fontSize: '11px'
              }}
            >
              ↶ Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
              style={{
                padding: '4px 8px',
                backgroundColor: historyIndex < history.length - 1 ? '#6c757d' : '#e9ecef',
                color: historyIndex < history.length - 1 ? '#fff' : '#6c757d',
                border: 'none',
                borderRadius: '3px',
                cursor: historyIndex < history.length - 1 ? 'pointer' : 'not-allowed',
                fontSize: '11px'
              }}
            >
              ↷ Redo
            </button>
          </div>
        </div>
        
        {/* History indicator */}
        {history.length > 1 && (
          <div style={{
            fontSize: '10px',
            color: '#666',
            marginTop: '4px'
          }}>
            History: {historyIndex + 1} of {history.length}
            {history[historyIndex] && (
              <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                {history[historyIndex].description}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Presets */}
      {presetNames.length > 0 && (
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #eee',
          backgroundColor: '#f8f9fa'
        }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#333'
          }}>
            Load Preset Configuration
          </label>
          <select
            onChange={(e) => e.target.value && handleLoadPreset(e.target.value)}
            value=""
            style={{
              width: '100%',
              padding: '6px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: '#fff'
            }}
          >
            <option value="">Select a preset...</option>
            {presetNames.map(name => (
              <option key={name} value={name}>
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Configuration Fields */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto'
      }}>
        {configFields.map(renderField)}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #eee',
        backgroundColor: '#f8f9fa'
      }}>
        {/* Real-time status indicator */}
        {enableRealTimeUpdates && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#28a745'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#28a745',
              animation: hasChanges ? 'pulse 1.5s infinite' : 'none'
            }} />
            {hasChanges ? 'Applying changes...' : 'Real-time updates active'}
          </div>
        )}
        
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            style={{
              padding: '8px 16px',
              backgroundColor: hasChanges ? '#6c757d' : '#e9ecef',
              color: hasChanges ? '#fff' : '#6c757d',
              border: 'none',
              borderRadius: '4px',
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            Reset
          </button>
          {!enableRealTimeUpdates && (
            <button
              onClick={handleApply}
              disabled={!hasChanges || Object.values(errors).some(error => error)}
              style={{
                padding: '8px 16px',
                backgroundColor: (hasChanges && !Object.values(errors).some(error => error)) ? '#007bff' : '#e9ecef',
                color: (hasChanges && !Object.values(errors).some(error => error)) ? '#fff' : '#6c757d',
                border: 'none',
                borderRadius: '4px',
                cursor: (hasChanges && !Object.values(errors).some(error => error)) ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Apply Changes
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
};