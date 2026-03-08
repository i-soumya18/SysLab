/**
 * Advanced load pattern generation for realistic traffic simulation
 */

import { LoadPattern, LoadPatternType } from '../types';

export interface LoadPoint {
  timestamp: number;
  requestsPerSecond: number;
}

export interface TrafficGenerator {
  generateLoadPoints(pattern: LoadPattern, duration: number): LoadPoint[];
}

export class RealisticLoadGenerator implements TrafficGenerator {
  /**
   * Generate load points for the specified pattern and duration
   */
  generateLoadPoints(pattern: LoadPattern, duration: number): LoadPoint[] {
    switch (pattern.type) {
      case 'constant':
        return this.generateConstantLoad(pattern, duration);
      case 'ramp':
        return this.generateRampLoad(pattern, duration);
      case 'spike':
        return this.generateSpikeLoad(pattern, duration);
      case 'realistic':
        return this.generateRealisticLoad(pattern, duration);
      default:
        throw new Error(`Unsupported load pattern type: ${pattern.type}`);
    }
  }

  /**
   * Generate constant load pattern with minor variations
   */
  private generateConstantLoad(pattern: LoadPattern, duration: number): LoadPoint[] {
    const points: LoadPoint[] = [];
    const intervalMs = 1000; // Generate points every second
    const totalPoints = Math.floor(duration * 1000 / intervalMs);

    for (let i = 0; i < totalPoints; i++) {
      const timestamp = i * intervalMs;
      // Add small random variations (±10%) to make it more realistic
      const variation = 0.9 + Math.random() * 0.2;
      const load = pattern.baseLoad * variation;
      
      points.push({ timestamp, requestsPerSecond: load });
    }

    return points;
  }

  /**
   * Generate ramp load pattern with gradual increase
   */
  private generateRampLoad(pattern: LoadPattern, duration: number): LoadPoint[] {
    const points: LoadPoint[] = [];
    const intervalMs = 1000;
    const totalPoints = Math.floor(duration * 1000 / intervalMs);
    const peakLoad = pattern.peakLoad || pattern.baseLoad * 2;

    for (let i = 0; i < totalPoints; i++) {
      const timestamp = i * intervalMs;
      const progress = i / (totalPoints - 1); // 0 to 1
      
      // Linear ramp from baseLoad to peakLoad
      const load = pattern.baseLoad + (peakLoad - pattern.baseLoad) * progress;
      
      // Add some noise for realism
      const noise = 0.95 + Math.random() * 0.1;
      const finalLoad = Math.max(0, load * noise);
      
      points.push({ timestamp, requestsPerSecond: finalLoad });
    }

    return points;
  }

  /**
   * Generate spike load pattern with sudden traffic bursts
   */
  private generateSpikeLoad(pattern: LoadPattern, duration: number): LoadPoint[] {
    const points: LoadPoint[] = [];
    const intervalMs = 1000;
    const totalPoints = Math.floor(duration * 1000 / intervalMs);
    const peakLoad = pattern.peakLoad || pattern.baseLoad * 5;

    // Define spike parameters
    const spikeCount = Math.max(1, Math.floor(duration / 300)); // One spike every 5 minutes
    const spikeDuration = 30; // 30 seconds per spike
    const spikePositions = this.generateSpikePositions(spikeCount, duration, spikeDuration);

    for (let i = 0; i < totalPoints; i++) {
      const timestamp = i * intervalMs;
      const timeInSeconds = timestamp / 1000;
      
      let load = pattern.baseLoad;
      
      // Check if we're in a spike period
      for (const spike of spikePositions) {
        if (timeInSeconds >= spike.start && timeInSeconds <= spike.end) {
          // Calculate spike intensity (bell curve)
          const spikeProgress = (timeInSeconds - spike.start) / (spike.end - spike.start);
          const bellCurve = Math.exp(-Math.pow((spikeProgress - 0.5) * 4, 2));
          load = pattern.baseLoad + (peakLoad - pattern.baseLoad) * bellCurve;
          break;
        }
      }
      
      // Add random variations
      const variation = 0.9 + Math.random() * 0.2;
      const finalLoad = Math.max(0, load * variation);
      
      points.push({ timestamp, requestsPerSecond: finalLoad });
    }

    return points;
  }

  /**
   * Generate realistic load pattern with daily/weekly cycles
   */
  private generateRealisticLoad(pattern: LoadPattern, duration: number): LoadPoint[] {
    if (pattern.pattern && pattern.pattern.length > 0) {
      return this.generateCustomPatternLoad(pattern, duration);
    }

    const points: LoadPoint[] = [];
    const intervalMs = 1000;
    const totalPoints = Math.floor(duration * 1000 / intervalMs);

    for (let i = 0; i < totalPoints; i++) {
      const timestamp = i * intervalMs;
      const timeInSeconds = timestamp / 1000;
      
      // Calculate load based on realistic patterns
      const dailyMultiplier = this.getDailyTrafficMultiplier(timeInSeconds);
      const weeklyMultiplier = this.getWeeklyTrafficMultiplier(timeInSeconds);
      const seasonalMultiplier = this.getSeasonalTrafficMultiplier(timeInSeconds);
      
      // Combine all multipliers
      const totalMultiplier = dailyMultiplier * weeklyMultiplier * seasonalMultiplier;
      
      // Add random noise and micro-bursts
      const noise = this.generateTrafficNoise(timeInSeconds);
      const microBurst = this.generateMicroBurst(timeInSeconds);
      
      const load = pattern.baseLoad * totalMultiplier * noise * microBurst;
      const finalLoad = Math.max(0.1, load); // Minimum load to prevent zero traffic
      
      points.push({ timestamp, requestsPerSecond: finalLoad });
    }

    return points;
  }

  /**
   * Generate load from custom pattern array
   */
  private generateCustomPatternLoad(pattern: LoadPattern, duration: number): LoadPoint[] {
    const points: LoadPoint[] = [];
    const intervalMs = 1000;
    const totalPoints = Math.floor(duration * 1000 / intervalMs);
    const customPattern = pattern.pattern!;

    for (let i = 0; i < totalPoints; i++) {
      const timestamp = i * intervalMs;
      
      // Map current time to pattern index
      const patternIndex = Math.floor((i / totalPoints) * customPattern.length);
      const load = customPattern[patternIndex] || pattern.baseLoad;
      
      // Add small variations
      const variation = 0.95 + Math.random() * 0.1;
      const finalLoad = Math.max(0, load * variation);
      
      points.push({ timestamp, requestsPerSecond: finalLoad });
    }

    return points;
  }

  /**
   * Calculate daily traffic multiplier (0.3 to 1.5)
   * Models typical daily usage patterns
   */
  private getDailyTrafficMultiplier(timeInSeconds: number): number {
    const hoursInDay = 24;
    const secondsInHour = 3600;
    const currentHour = (timeInSeconds / secondsInHour) % hoursInDay;
    
    // Peak hours: 9-11 AM and 2-4 PM, 7-9 PM
    // Low hours: 12-6 AM
    if (currentHour >= 0 && currentHour < 6) {
      // Night hours - low traffic
      return 0.3 + 0.1 * Math.sin((currentHour / 6) * Math.PI);
    } else if (currentHour >= 6 && currentHour < 9) {
      // Morning ramp-up
      return 0.4 + 0.4 * ((currentHour - 6) / 3);
    } else if (currentHour >= 9 && currentHour < 11) {
      // Morning peak
      return 1.2 + 0.3 * Math.sin(((currentHour - 9) / 2) * Math.PI);
    } else if (currentHour >= 11 && currentHour < 14) {
      // Lunch dip and afternoon ramp
      return 0.8 + 0.2 * Math.sin(((currentHour - 11) / 3) * Math.PI);
    } else if (currentHour >= 14 && currentHour < 16) {
      // Afternoon peak
      return 1.1 + 0.4 * Math.sin(((currentHour - 14) / 2) * Math.PI);
    } else if (currentHour >= 16 && currentHour < 19) {
      // Evening transition
      return 0.9 + 0.2 * Math.sin(((currentHour - 16) / 3) * Math.PI);
    } else if (currentHour >= 19 && currentHour < 21) {
      // Evening peak
      return 1.0 + 0.3 * Math.sin(((currentHour - 19) / 2) * Math.PI);
    } else {
      // Late evening decline
      return 0.7 - 0.4 * ((currentHour - 21) / 3);
    }
  }

  /**
   * Calculate weekly traffic multiplier (0.7 to 1.2)
   * Models weekday vs weekend patterns
   */
  private getWeeklyTrafficMultiplier(timeInSeconds: number): number {
    const secondsInWeek = 7 * 24 * 3600;
    const dayOfWeek = Math.floor((timeInSeconds / (24 * 3600)) % 7);
    
    // Monday = 0, Sunday = 6
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Weekdays - higher traffic
      return 1.0 + 0.2 * Math.sin(((dayOfWeek - 1) / 4) * Math.PI);
    } else {
      // Weekends - lower traffic
      return 0.7 + 0.1 * Math.random();
    }
  }

  /**
   * Calculate seasonal traffic multiplier (0.8 to 1.3)
   * Models long-term seasonal variations
   */
  private getSeasonalTrafficMultiplier(timeInSeconds: number): number {
    const secondsInYear = 365 * 24 * 3600;
    const dayOfYear = (timeInSeconds / (24 * 3600)) % 365;
    
    // Simple seasonal model: higher in winter months, lower in summer
    const seasonalCycle = Math.sin((dayOfYear / 365) * 2 * Math.PI + Math.PI);
    return 1.0 + 0.15 * seasonalCycle;
  }

  /**
   * Generate traffic noise (0.8 to 1.2)
   * Adds realistic random variations
   */
  private generateTrafficNoise(timeInSeconds: number): number {
    // Use time-based seed for consistent but varied noise
    const seed = Math.sin(timeInSeconds * 0.01) * Math.cos(timeInSeconds * 0.007);
    return 0.9 + 0.2 * (0.5 + 0.5 * seed + 0.3 * Math.random());
  }

  /**
   * Generate micro-bursts (1.0 to 2.0)
   * Occasional small traffic spikes
   */
  private generateMicroBurst(timeInSeconds: number): number {
    // 5% chance of micro-burst every second
    if (Math.random() < 0.05) {
      return 1.5 + 0.5 * Math.random();
    }
    return 1.0;
  }

  /**
   * Generate random spike positions for spike load pattern
   */
  private generateSpikePositions(count: number, duration: number, spikeDuration: number): Array<{start: number, end: number}> {
    const positions: Array<{start: number, end: number}> = [];
    const minGap = spikeDuration * 2; // Minimum gap between spikes
    
    for (let i = 0; i < count; i++) {
      let start: number;
      let attempts = 0;
      
      do {
        start = Math.random() * (duration - spikeDuration);
        attempts++;
      } while (attempts < 100 && positions.some(pos => 
        Math.abs(start - pos.start) < minGap
      ));
      
      if (attempts < 100) {
        positions.push({
          start,
          end: start + spikeDuration
        });
      }
    }
    
    return positions.sort((a, b) => a.start - b.start);
  }
}

/**
 * Factory for creating different types of load generators
 */
export class LoadGeneratorFactory {
  static createGenerator(type: 'realistic' | 'simple' = 'realistic'): TrafficGenerator {
    switch (type) {
      case 'realistic':
        return new RealisticLoadGenerator();
      case 'simple':
      default:
        return new RealisticLoadGenerator(); // For now, use realistic for all
    }
  }
}