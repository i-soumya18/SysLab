/**
 * Scale Control Interface Component
 * 
 * Implements SRS FR-5.1: Dynamic scale adjustment from 1 user to 1 billion users
 * with logarithmic scale slider and real-time parameter updates
 */

import React, { useState, useCallback, useEffect } from 'react';
import './ScaleControl.css';

export interface ScalePoint {
  userCount: number;
  label: string;
  position: number; // 0-100 percentage on slider
}

export interface ScaleControlProps {
  currentScale: number;
  onScaleChange: (userCount: number) => void;
  isSimulationRunning: boolean;
  onStartSimulation?: () => void;
  onStopSimulation?: () => void;
  disabled?: boolean;
  liveUserCount?: number;
  liveScaleFactor?: number;
}

// Predefined scale points for logarithmic scale (SRS FR-5.1)
const SCALE_POINTS: ScalePoint[] = [
  { userCount: 1, label: '1 user', position: 0 },
  { userCount: 10, label: '10 users', position: 10 },
  { userCount: 100, label: '100 users', position: 20 },
  { userCount: 1000, label: '1K users', position: 30 },
  { userCount: 10000, label: '10K users', position: 40 },
  { userCount: 100000, label: '100K users', position: 50 },
  { userCount: 1000000, label: '1M users', position: 60 },
  { userCount: 10000000, label: '10M users', position: 70 },
  { userCount: 100000000, label: '100M users', position: 80 },
  { userCount: 1000000000, label: '1B users', position: 100 }
];

export const ScaleControl: React.FC<ScaleControlProps> = ({
  currentScale,
  onScaleChange,
  isSimulationRunning,
  onStartSimulation,
  onStopSimulation,
  disabled = false,
  liveUserCount,
  liveScaleFactor
}) => {
  const [sliderValue, setSliderValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Convert user count to slider position (logarithmic scale)
  const userCountToSliderPosition = useCallback((userCount: number): number => {
    if (userCount <= 1) return 0;
    if (userCount >= 1000000000) return 100;
    
    // Find the two scale points that bracket this user count
    for (let i = 0; i < SCALE_POINTS.length - 1; i++) {
      const current = SCALE_POINTS[i];
      const next = SCALE_POINTS[i + 1];
      
      if (userCount >= current.userCount && userCount <= next.userCount) {
        // Logarithmic interpolation between the two points
        const logCurrent = Math.log10(current.userCount);
        const logNext = Math.log10(next.userCount);
        const logValue = Math.log10(userCount);
        
        const ratio = (logValue - logCurrent) / (logNext - logCurrent);
        return current.position + ratio * (next.position - current.position);
      }
    }
    
    return 100;
  }, []);

  // Convert slider position to user count (logarithmic scale)
  const sliderPositionToUserCount = useCallback((position: number): number => {
    if (position <= 0) return 1;
    if (position >= 100) return 1000000000;
    
    // Find the two scale points that bracket this position
    for (let i = 0; i < SCALE_POINTS.length - 1; i++) {
      const current = SCALE_POINTS[i];
      const next = SCALE_POINTS[i + 1];
      
      if (position >= current.position && position <= next.position) {
        // Logarithmic interpolation between the two points
        const ratio = (position - current.position) / (next.position - current.position);
        const logCurrent = Math.log10(current.userCount);
        const logNext = Math.log10(next.userCount);
        const logValue = logCurrent + ratio * (logNext - logCurrent);
        
        return Math.round(Math.pow(10, logValue));
      }
    }
    
    return 1000000000;
  }, []);

  // Format user count for display
  const formatUserCount = useCallback((userCount: number): string => {
    if (userCount >= 1000000000) {
      return `${(userCount / 1000000000).toFixed(1)}B`;
    } else if (userCount >= 1000000) {
      return `${(userCount / 1000000).toFixed(1)}M`;
    } else if (userCount >= 1000) {
      return `${(userCount / 1000).toFixed(1)}K`;
    } else {
      return userCount.toString();
    }
  }, []);

  // Update slider position when currentScale changes
  useEffect(() => {
    if (!isDragging) {
      const position = userCountToSliderPosition(currentScale);
      setSliderValue(position);
    }
  }, [currentScale, userCountToSliderPosition, isDragging]);

  // Handle slider change
  const handleSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseFloat(event.target.value);
    setSliderValue(position);
    
    const userCount = sliderPositionToUserCount(position);
    onScaleChange(userCount);
  }, [sliderPositionToUserCount, onScaleChange]);

  // Handle mouse events for tooltip
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLInputElement>) => {
    if (showTooltip) {
      setTooltipPosition({ x: event.clientX, y: event.clientY - 40 });
    }
  }, [showTooltip]);

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setShowTooltip(false);
    }
  }, [isDragging]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    setShowTooltip(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setShowTooltip(false);
  }, []);

  // Handle preset scale point clicks
  const handleScalePointClick = useCallback((scalePoint: ScalePoint) => {
    if (disabled) return;
    
    setSliderValue(scalePoint.position);
    onScaleChange(scalePoint.userCount);
  }, [disabled, onScaleChange]);

  // Calculate current user count from slider
  const currentUserCount = sliderPositionToUserCount(sliderValue);

  return (
    <div className="scale-control">
      <div className="scale-control-header">
        <h3>Traffic Scale Control</h3>
        <div className="current-scale">
          <span className="scale-value">{formatUserCount(currentUserCount)}</span>
          <span className="scale-label">users</span>
        </div>
      </div>

      <div className="scale-slider-container">
        {/* Scale points markers */}
        <div className="scale-points">
          {SCALE_POINTS.map((point) => (
            <div
              key={point.userCount}
              className={`scale-point ${currentUserCount === point.userCount ? 'active' : ''}`}
              style={{ left: `${point.position}%` }}
              onClick={() => handleScalePointClick(point)}
              title={`${point.label} (${point.userCount.toLocaleString()})`}
            >
              <div className="scale-point-marker" />
              <div className="scale-point-label">{point.label}</div>
            </div>
          ))}
        </div>

        {/* Main slider */}
        <div className="slider-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={sliderValue}
            onChange={handleSliderChange}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            disabled={disabled}
            className="scale-slider"
          />
          
          {/* Slider track background with gradient */}
          <div className="slider-track">
            <div 
              className="slider-fill" 
              style={{ width: `${sliderValue}%` }}
            />
          </div>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="scale-tooltip"
            style={{
              position: 'fixed',
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translateX(-50%)',
              zIndex: 1000
            }}
          >
            <div className="tooltip-content">
              <div className="tooltip-value">{formatUserCount(currentUserCount)}</div>
              <div className="tooltip-exact">{currentUserCount.toLocaleString()} users</div>
            </div>
          </div>
        )}
      </div>

      {/* Simulation controls */}
      <div className="simulation-controls">
        <div className="simulation-status">
          <span className={`status-indicator ${isSimulationRunning ? 'running' : 'stopped'}`} />
          <span className="status-text">
            {isSimulationRunning ? 'Simulation Running' : 'Simulation Stopped'}
          </span>
        </div>

        {isSimulationRunning && typeof liveUserCount === 'number' && typeof liveScaleFactor === 'number' && (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 mt-2">
            Live Ramp: x{liveScaleFactor.toFixed(2)} ({formatUserCount(liveUserCount)} users)
          </div>
        )}

        <div className="control-buttons">
          {!isSimulationRunning ? (
            <button
              className="start-button"
              onClick={onStartSimulation}
              disabled={disabled}
            >
              <span className="button-icon">▶</span>
              Start Simulation
            </button>
          ) : (
            <button
              className="stop-button"
              onClick={onStopSimulation}
              disabled={disabled}
            >
              <span className="button-icon">⏹</span>
              Stop Simulation
            </button>
          )}
        </div>
      </div>

      {/* Scale information panel */}
      <div className="scale-info">
        <div className="info-item">
          <span className="info-label">Current Load:</span>
          <span className="info-value">{formatUserCount(currentUserCount)} concurrent users</span>
        </div>
        <div className="info-item">
          <span className="info-label">Est. QPS:</span>
          <span className="info-value">{Math.round(currentUserCount * 0.1).toLocaleString()}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Scale Factor:</span>
          <span className="info-value">{currentUserCount >= 1000000000 ? '10^9' : `10^${Math.floor(Math.log10(Math.max(1, currentUserCount)))}`}</span>
        </div>
      </div>
    </div>
  );
};
