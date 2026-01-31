# Traffic Pattern Generation Implementation

## Overview

This document describes the enhanced traffic pattern generation functionality implemented for **Requirement 7.5** of the System Design Simulator. The implementation adds burst traffic patterns, gradual ramp-up scenarios, realistic user behavior modeling, and geographic distribution simulation to the Load Simulation Engine.

## Features Implemented

### 1. Enhanced Burst Traffic Patterns

Three different burst patterns are supported:

#### Spike Pattern
- **Description**: Immediate traffic spike to peak level, then immediate drop
- **Use Case**: Flash sales, viral content, breaking news
- **Configuration**: `{ pattern: 'spike', multiplier: 5.0, duration: 10000 }`

#### Plateau Pattern  
- **Description**: Gradual rise to peak (20%), sustained plateau (60%), gradual fall (20%)
- **Use Case**: Scheduled events, planned promotions, regular peak hours
- **Configuration**: `{ pattern: 'plateau', multiplier: 3.0, duration: 30000 }`

#### Wave Pattern
- **Description**: Sinusoidal wave pattern with configurable amplitude
- **Use Case**: Cyclical traffic patterns, testing resilience to varying loads
- **Configuration**: `{ pattern: 'wave', multiplier: 2.5, duration: 40000 }`

### 2. Gradual Ramp-Up Scenarios

Three ramp-up curve types are supported:

#### Linear Ramp-Up
- **Description**: Constant rate of traffic increase
- **Formula**: `multiplier = start + (end - start) * progress`
- **Use Case**: Steady growth scenarios, controlled load testing

#### Exponential Ramp-Up
- **Description**: Accelerating traffic increase (slow start, fast finish)
- **Formula**: `multiplier = start + (end - start) * progress²`
- **Use Case**: Viral growth, exponential user adoption

#### Logarithmic Ramp-Up
- **Description**: Decelerating traffic increase (fast start, slow finish)
- **Formula**: `multiplier = start + (end - start) * √progress`
- **Use Case**: Initial surge followed by stabilization

### 3. Realistic User Behavior Modeling

#### Daily Traffic Patterns
- **24-hour cycle**: Configurable hourly multipliers (0-1 scale)
- **Business hours**: Higher traffic during 9 AM - 5 PM
- **Night hours**: Reduced traffic during 2 AM - 6 AM
- **Example**: `[0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.0, 1.2, 1.5, 1.5, 1.5, 1.4, 1.3, 1.4, 1.5, 1.5, 1.4, 1.2, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3]`

#### Weekly Traffic Patterns
- **7-day cycle**: Different patterns for weekdays vs weekends
- **Weekend reduction**: Typically 70-90% of weekday traffic
- **Example**: `[0.9, 1.0, 1.0, 1.0, 1.0, 1.1, 0.7]` (Mon-Sun)

#### Seasonal Events
- **Black Friday**: 8x traffic multiplier with sudden pattern
- **Holiday Season**: 2.5x traffic multiplier with gradual pattern
- **Custom Events**: Configurable start/end dates, multipliers, and patterns

#### User Retry Behavior
- **Retry Probability**: 75% of users retry after failure
- **Backoff Multiplier**: Exponential backoff (2x delay per retry)
- **Max Retries**: Configurable limit (typically 3)

### 4. Geographic Distribution Simulation

#### Multi-Region Support
- **US East Coast**: 35% users, excellent network (50ms latency)
- **US West Coast**: 25% users, excellent network (60ms latency)  
- **Europe**: 30% users, good network (100ms latency)
- **Asia Pacific**: 10% users, fair network (150ms latency)

#### Timezone-Aware Peak Hours
- **Regional Peaks**: Each region has specific peak hours
- **Time Zone Offsets**: EST (-5), PST (-8), CET (+1), JST (+9)
- **Load Balancing**: Geographic, latency-based, or round-robin

#### Network Quality Impact
- **Excellent**: 100% traffic generation rate
- **Good**: 90% traffic generation rate
- **Fair**: 70% traffic generation rate
- **Poor**: 50% traffic generation rate

## API Usage

### Adding Burst Traffic
```typescript
const burst: TrafficBurst = {
  startTime: 5000,
  duration: 10000,
  multiplier: 3.0,
  pattern: 'plateau'
};
loadEngine.addEnhancedTrafficBurst(burst);
```

### Adding Gradual Ramp-Up
```typescript
const ramp: GradualRampUp = {
  startTime: 10000,
  duration: 30000,
  startMultiplier: 1.0,
  endMultiplier: 5.0,
  curve: 'exponential'
};
loadEngine.addGradualRampUp(ramp);
```

### Setting Realistic User Behavior
```typescript
const behavior: RealisticUserBehavior = {
  dailyPattern: [...], // 24 hourly multipliers
  weeklyPattern: [...], // 7 daily multipliers
  seasonalEvents: [...],
  userSessionDuration: 1800,
  concurrentSessionRatio: 0.3,
  retryBehavior: {
    maxRetries: 3,
    backoffMultiplier: 2.0,
    retryProbability: 0.75
  }
};
loadEngine.setRealisticUserBehavior(behavior);
```

### Setting Geographic Distribution
```typescript
const distribution: GeographicDistribution = {
  regions: [...],
  timeZoneOffsets: [-5, -8, 1, 9],
  latencyMatrix: [...],
  loadBalancing: 'geographic'
};
loadEngine.setGeographicDistribution(distribution);
```

### Managing Traffic Patterns
```typescript
// Add pattern
const pattern: TrafficPattern = {
  id: 'morning-rush',
  name: 'Morning Rush Hour',
  type: 'burst',
  configuration: burst,
  isActive: true,
  priority: 1
};
loadEngine.addTrafficPattern(pattern);

// Remove pattern
loadEngine.removeTrafficPattern('morning-rush');

// Get active patterns
const activePatterns = loadEngine.getActiveTrafficPatterns();
```

## Implementation Details

### Event Scheduling
- All traffic patterns use the event scheduler for precise timing
- Load changes are scheduled as discrete events
- Multiple patterns can be active simultaneously with priority handling

### Load Multiplier Application
- Base arrival rates are stored and preserved
- Current multipliers are applied to base rates
- Multiple patterns combine multiplicatively

### Backpressure Integration
- Traffic patterns respect existing backpressure mechanisms
- Throttled requests are properly counted as dropped
- Circuit breakers remain functional during pattern execution

### Performance Considerations
- Efficient event scheduling with priority queue
- Minimal memory overhead for pattern storage
- O(1) pattern lookup and modification operations

## Testing

Comprehensive test suite covers:
- All burst pattern types (spike, plateau, wave)
- All ramp-up curves (linear, exponential, logarithmic)
- Realistic user behavior with daily/weekly patterns
- Geographic distribution with multiple regions
- Traffic pattern management (add, remove, list)
- Integration with existing simulation engine

## Requirements Satisfied

✅ **Requirement 7.5**: Add burst traffic patterns and gradual ramp-up scenarios  
✅ **Requirement 7.5**: Create realistic user behavior modeling  
✅ **Requirement 7.5**: Implement geographic distribution simulation

The implementation provides a comprehensive traffic pattern generation system that enables realistic simulation of various load scenarios, from simple bursts to complex multi-regional user behavior patterns.