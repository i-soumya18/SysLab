/**
 * Traffic Pattern Generation Demo
 * 
 * Demonstrates the enhanced traffic pattern generation capabilities
 * implemented for Requirement 7.5
 */

import { LoadSimulationEngine } from '../simulation/LoadSimulationEngine';
import { SystemGraphEngine } from '../simulation/SystemGraphEngine';
import { PriorityQueueEventScheduler } from '../simulation/EventScheduler';
import { 
  Component, 
  LoadPattern, 
  TrafficBurst, 
  GradualRampUp, 
  RealisticUserBehavior,
  GeographicDistribution,
  TrafficPattern 
} from '../types';

/**
 * Demo: Enhanced Traffic Pattern Generation
 */
export function demonstrateTrafficPatterns(): void {
  console.log('🚀 Traffic Pattern Generation Demo');
  console.log('=====================================\n');

  // Initialize the simulation components
  const systemGraph = new SystemGraphEngine();
  const eventScheduler = new PriorityQueueEventScheduler();
  const loadEngine = new LoadSimulationEngine(systemGraph, eventScheduler);

  // Create a simple system architecture
  const webServer: Component = {
    id: 'web-server',
    type: 'web-server',
    position: { x: 100, y: 100 },
    configuration: { capacity: 1000, latency: 50, failureRate: 0.01 },
    metadata: { name: 'Web Server', version: '1.0' }
  };

  const database: Component = {
    id: 'database',
    type: 'database',
    position: { x: 300, y: 100 },
    configuration: { capacity: 500, latency: 100, failureRate: 0.02 },
    metadata: { name: 'Database', version: '1.0' }
  };

  systemGraph.addNode(webServer);
  systemGraph.addNode(database);

  // Initialize load simulation
  const baseLoadPattern: LoadPattern = {
    type: 'constant',
    baseLoad: 100 // 100 requests per second
  };

  loadEngine.initializeLoadSimulation(baseLoadPattern, 10000); // 10K users

  console.log('✅ System initialized with base load: 100 RPS for 10K users\n');

  // Demo 1: Burst Traffic Patterns
  console.log('📈 Demo 1: Burst Traffic Patterns');
  console.log('----------------------------------');

  // Spike pattern - immediate burst
  const spikePattern: TrafficBurst = {
    startTime: 5000,
    duration: 10000,
    multiplier: 5.0,
    pattern: 'spike'
  };

  loadEngine.addEnhancedTrafficBurst(spikePattern);
  console.log('🔥 Added spike burst: 5x traffic for 10 seconds starting at t=5s');

  // Plateau pattern - gradual rise and fall
  const plateauPattern: TrafficBurst = {
    startTime: 20000,
    duration: 30000,
    multiplier: 3.0,
    pattern: 'plateau'
  };

  loadEngine.addEnhancedTrafficBurst(plateauPattern);
  console.log('📊 Added plateau burst: 3x traffic with gradual rise/fall over 30s');

  // Wave pattern - sinusoidal
  const wavePattern: TrafficBurst = {
    startTime: 60000,
    duration: 40000,
    multiplier: 2.5,
    pattern: 'wave'
  };

  loadEngine.addEnhancedTrafficBurst(wavePattern);
  console.log('🌊 Added wave burst: 2.5x traffic in sinusoidal pattern over 40s\n');

  // Demo 2: Gradual Ramp-Up Scenarios
  console.log('📈 Demo 2: Gradual Ramp-Up Scenarios');
  console.log('------------------------------------');

  // Linear ramp-up
  const linearRamp: GradualRampUp = {
    startTime: 120000,
    duration: 60000,
    startMultiplier: 1.0,
    endMultiplier: 4.0,
    curve: 'linear'
  };

  loadEngine.addGradualRampUp(linearRamp);
  console.log('📏 Added linear ramp: 1x to 4x traffic over 60 seconds');

  // Exponential ramp-up
  const exponentialRamp: GradualRampUp = {
    startTime: 200000,
    duration: 45000,
    startMultiplier: 1.0,
    endMultiplier: 6.0,
    curve: 'exponential'
  };

  loadEngine.addGradualRampUp(exponentialRamp);
  console.log('📈 Added exponential ramp: 1x to 6x traffic with exponential curve');

  // Logarithmic ramp-up
  const logarithmicRamp: GradualRampUp = {
    startTime: 260000,
    duration: 50000,
    startMultiplier: 2.0,
    endMultiplier: 5.0,
    curve: 'logarithmic'
  };

  loadEngine.addGradualRampUp(logarithmicRamp);
  console.log('📉 Added logarithmic ramp: 2x to 5x traffic with logarithmic curve\n');

  // Demo 3: Realistic User Behavior
  console.log('👥 Demo 3: Realistic User Behavior Modeling');
  console.log('-------------------------------------------');

  const realisticBehavior: RealisticUserBehavior = {
    // Daily pattern: low at night, peak during business hours
    dailyPattern: Array.from({ length: 24 }, (_, hour) => {
      if (hour >= 2 && hour <= 6) return 0.2; // Night: 20% traffic
      if (hour >= 9 && hour <= 17) return 1.5; // Business hours: 150% traffic
      if (hour >= 18 && hour <= 22) return 1.2; // Evening: 120% traffic
      return 0.8; // Other times: 80% traffic
    }),
    
    // Weekly pattern: lower on weekends
    weeklyPattern: [0.9, 1.0, 1.0, 1.0, 1.0, 1.1, 0.7], // Mon-Sun
    
    seasonalEvents: [
      {
        name: 'Black Friday Sale',
        startDate: new Date(Date.now() + 86400000), // Tomorrow
        endDate: new Date(Date.now() + 172800000), // Day after tomorrow
        trafficMultiplier: 8.0,
        pattern: 'sudden'
      },
      {
        name: 'Holiday Season',
        startDate: new Date(Date.now() + 259200000), // 3 days from now
        endDate: new Date(Date.now() + 604800000), // 1 week from now
        trafficMultiplier: 2.5,
        pattern: 'gradual'
      }
    ],
    
    userSessionDuration: 1800, // 30 minutes average
    concurrentSessionRatio: 0.3, // 30% of users are concurrent
    
    retryBehavior: {
      maxRetries: 3,
      backoffMultiplier: 2.0,
      retryProbability: 0.75 // 75% of users retry on failure
    }
  };

  loadEngine.setRealisticUserBehavior(realisticBehavior);
  console.log('🕐 Set daily pattern: 20% at night, 150% during business hours');
  console.log('📅 Set weekly pattern: Lower traffic on weekends');
  console.log('🎉 Added seasonal events: Black Friday (8x) and Holiday Season (2.5x)');
  console.log('🔄 Configured retry behavior: 75% retry probability with exponential backoff\n');

  // Demo 4: Geographic Distribution
  console.log('🌍 Demo 4: Geographic Distribution Simulation');
  console.log('---------------------------------------------');

  const geographicDistribution: GeographicDistribution = {
    regions: [
      {
        id: 'us-east',
        name: 'US East Coast',
        userPercentage: 35,
        peakHours: [9, 10, 11, 14, 15, 16, 17], // EST business hours
        baseLatency: 50,
        networkQuality: 'excellent'
      },
      {
        id: 'us-west',
        name: 'US West Coast',
        userPercentage: 25,
        peakHours: [9, 10, 11, 14, 15, 16, 17], // PST business hours
        baseLatency: 60,
        networkQuality: 'excellent'
      },
      {
        id: 'europe',
        name: 'Europe',
        userPercentage: 30,
        peakHours: [8, 9, 10, 13, 14, 15, 16], // CET business hours
        baseLatency: 100,
        networkQuality: 'good'
      },
      {
        id: 'asia-pacific',
        name: 'Asia Pacific',
        userPercentage: 10,
        peakHours: [9, 10, 11, 13, 14, 15], // JST business hours
        baseLatency: 150,
        networkQuality: 'fair'
      }
    ],
    timeZoneOffsets: [-5, -8, 1, 9], // EST, PST, CET, JST
    latencyMatrix: [
      [0, 70, 100, 180],    // US East to others
      [70, 0, 120, 150],    // US West to others
      [100, 120, 0, 200],   // Europe to others
      [180, 150, 200, 0]    // Asia Pacific to others
    ],
    loadBalancing: 'geographic'
  };

  loadEngine.setGeographicDistribution(geographicDistribution);
  console.log('🇺🇸 US East: 35% users, excellent network (50ms base latency)');
  console.log('🇺🇸 US West: 25% users, excellent network (60ms base latency)');
  console.log('🇪🇺 Europe: 30% users, good network (100ms base latency)');
  console.log('🌏 Asia Pacific: 10% users, fair network (150ms base latency)');
  console.log('⏰ Each region has timezone-specific peak hours\n');

  // Demo 5: Traffic Pattern Management
  console.log('🎛️  Demo 5: Traffic Pattern Management');
  console.log('--------------------------------------');

  const managedPatterns: TrafficPattern[] = [
    {
      id: 'morning-rush',
      name: 'Morning Rush Hour',
      type: 'burst',
      configuration: {
        startTime: 32400000, // 9 AM
        duration: 3600000,   // 1 hour
        multiplier: 3.0,
        pattern: 'plateau'
      } as TrafficBurst,
      isActive: true,
      priority: 1
    },
    {
      id: 'lunch-peak',
      name: 'Lunch Time Peak',
      type: 'burst',
      configuration: {
        startTime: 43200000, // 12 PM
        duration: 1800000,   // 30 minutes
        multiplier: 2.5,
        pattern: 'spike'
      } as TrafficBurst,
      isActive: true,
      priority: 2
    },
    {
      id: 'evening-ramp',
      name: 'Evening Ramp Down',
      type: 'ramp',
      configuration: {
        startTime: 64800000, // 6 PM
        duration: 7200000,   // 2 hours
        startMultiplier: 1.5,
        endMultiplier: 0.5,
        curve: 'logarithmic'
      } as GradualRampUp,
      isActive: true,
      priority: 3
    }
  ];

  managedPatterns.forEach(pattern => {
    loadEngine.addTrafficPattern(pattern);
    console.log(`➕ Added pattern: ${pattern.name} (${pattern.type})`);
  });

  const activePatterns = loadEngine.getActiveTrafficPatterns();
  console.log(`\n📊 Total active patterns: ${activePatterns.length}`);

  // Simulate some time steps to show the patterns in action
  console.log('\n⏱️  Running simulation steps...');
  console.log('================================');

  for (let step = 0; step < 5; step++) {
    const result = loadEngine.step(1000); // 1 second steps
    console.log(`Step ${step + 1}: t=${result.timestamp}ms, Active Requests: ${result.activeRequests}, Completed: ${result.completedRequests}, Dropped: ${result.droppedRequests}`);
  }

  console.log('\n✅ Traffic Pattern Generation Demo Complete!');
  console.log('All enhanced traffic patterns are now active and ready for simulation.');
  console.log('\nKey Features Demonstrated:');
  console.log('• Burst patterns (spike, plateau, wave)');
  console.log('• Gradual ramp-up scenarios (linear, exponential, logarithmic)');
  console.log('• Realistic user behavior (daily/weekly patterns, seasonal events, retry behavior)');
  console.log('• Geographic distribution (multi-region with timezone-aware peaks)');
  console.log('• Traffic pattern management (add, remove, prioritize patterns)');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateTrafficPatterns();
}