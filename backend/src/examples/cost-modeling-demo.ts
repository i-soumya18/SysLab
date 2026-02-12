/**
 * Cost Modeling Service Demo
 * Demonstrates the capabilities of the SRS FR-8 Cost Modeling Engine
 */

import { costModelingService, storageCostAnalyzer, networkCostAnalyzer, trafficCostScalingAnalyzer, costPerformanceTradeoffAnalyzer } from '../services/costModelingService';
import type { Component, ComponentType } from '../types';

// Sample system architecture: E-commerce platform
const sampleEcommerceSystem: Component[] = [
  {
    id: 'lb-1',
    type: 'load-balancer' as ComponentType,
    position: { x: 100, y: 50 },
    configuration: {
      capacity: 50000,
      latency: 2,
      failureRate: 0.0001,
      algorithm: 'round-robin',
      maxConnections: 50000,
      scalingOptions: {
        autoScaling: { enabled: true },
        horizontal: { maxInstances: 10 }
      }
    },
    metadata: {
      name: 'AWS Application Load Balancer',
      version: '1.0',
      description: 'High-performance load balancer for e-commerce traffic'
    }
  },
  {
    id: 'service-1',
    type: 'service' as ComponentType,
    position: { x: 200, y: 100 },
    configuration: {
      capacity: 5000,
      latency: 15,
      failureRate: 0.002,
      runtime: 'Node.js 18',
      scalingOptions: {
        autoScaling: { enabled: true },
        horizontal: { minInstances: 2, maxInstances: 20 }
      }
    },
    metadata: {
      name: 'E-commerce API Service',
      version: '1.0',
      description: 'Main API service handling product catalog and orders'
    }
  },
  {
    id: 'cache-1',
    type: 'cache' as ComponentType,
    position: { x: 300, y: 50 },
    configuration: {
      capacity: 10000,
      latency: 1,
      failureRate: 0.0005,
      evictionPolicy: 'LRU',
      memorySize: '8GB',
      clustering: true
    },
    metadata: {
      name: 'Redis Cache Cluster',
      version: '7.0',
      description: 'High-performance cache for product data and sessions'
    }
  },
  {
    id: 'db-1',
    type: 'database' as ComponentType,
    position: { x: 400, y: 100 },
    configuration: {
      capacity: 2000,
      latency: 8,
      failureRate: 0.001,
      storageType: 'gp3',
      replicationFactor: 3,
      acidCompliance: {
        atomicity: true,
        consistency: 'strong',
        isolation: 'repeatable-read',
        durability: true
      }
    },
    metadata: {
      name: 'PostgreSQL Database',
      version: '15.0',
      description: 'Primary database for product catalog and order data'
    }
  },
  {
    id: 'cdn-1',
    type: 'cdn' as ComponentType,
    position: { x: 50, y: 150 },
    configuration: {
      capacity: 100000,
      latency: 50,
      failureRate: 0.00001,
      edgeLocations: 200,
      cacheHitRatio: 0.95,
      compressionEnabled: true
    },
    metadata: {
      name: 'CloudFlare CDN',
      version: 'latest',
      description: 'Global CDN for static assets and product images'
    }
  }
];

async function demonstrateCostModeling() {
  console.log('🚀 Cost Modeling Service Demo - E-commerce Platform\n');

  // Demo 1: SRS FR-8.1 - Compute Cost Estimation
  console.log('📊 SRS FR-8.1: Compute Cost Estimation');
  console.log('=====================================');
  
  const userScales = [1000, 10000, 100000, 1000000];
  
  for (const userCount of userScales) {
    const computeCost = costModelingService.calculateComputeCost(
      sampleEcommerceSystem[1], // API Service
      userCount,
      'aws'
    );
    
    console.log(`${userCount.toLocaleString()} users: $${computeCost.hourlyRate.toFixed(2)}/hour (${computeCost.instanceType}, ${computeCost.vcpus} vCPUs, ${computeCost.memory}GB RAM)`);
  }
  console.log();

  // Demo 2: SRS FR-8.2 - Storage Cost Modeling
  console.log('💾 SRS FR-8.2: Storage Cost Modeling');
  console.log('===================================');
  
  const storageAnalysis = storageCostAnalyzer.analyzeStorageTiers(
    sampleEcommerceSystem[3], // Database
    1000, // 1TB of data
    {
      readFrequency: 500, // reads per day
      writeFrequency: 100, // writes per day
      dataRetention: 2555 // 7 years
    },
    'aws'
  );
  
  console.log(`Current Storage: ${storageAnalysis.currentTier} - $${storageAnalysis.currentCost.toFixed(2)}/month`);
  console.log(`Recommended: ${storageAnalysis.recommendedTier} - $${storageAnalysis.projectedCost.toFixed(2)}/month`);
  console.log(`Potential Savings: $${storageAnalysis.savings.toFixed(2)}/month (${((storageAnalysis.savings / storageAnalysis.currentCost) * 100).toFixed(1)}%)`);
  console.log();

  // Demo 3: SRS FR-8.3 - Network Cost Estimation
  console.log('🌐 SRS FR-8.3: Network Cost Estimation');
  console.log('=====================================');
  
  const userDistribution = [
    { region: 'us-east-1', userPercentage: 40, dataVolumeGB: 200 },
    { region: 'eu-west-1', userPercentage: 30, dataVolumeGB: 150 },
    { region: 'ap-southeast-1', userPercentage: 20, dataVolumeGB: 100 },
    { region: 'sa-east-1', userPercentage: 10, dataVolumeGB: 50 }
  ];

  const geoAnalysis = networkCostAnalyzer.analyzeGeographicCosts(
    sampleEcommerceSystem,
    userDistribution,
    'aws'
  );
  
  console.log(`Total Network Cost: $${geoAnalysis.totalCost.toFixed(2)}/month`);
  console.log('Regional Breakdown:');
  geoAnalysis.regionalCosts.forEach(cost => {
    const totalRegionCost = Object.values(cost.dataTransferCosts).reduce((sum, c) => sum + c, 0);
    console.log(`  ${cost.region}: $${totalRegionCost.toFixed(2)}/month`);
  });
  console.log();

  // Demo 4: SRS FR-8.4 - Traffic-Based Cost Scaling
  console.log('📈 SRS FR-8.4: Traffic-Based Cost Scaling');
  console.log('========================================');
  
  const trafficScaling = {
    userCount: 50000,
    requestsPerUser: 20,
    dataVolumePerUser: 2, // 2MB per user
    peakMultiplier: 4, // Black Friday traffic
    averageMultiplier: 1.2,
    sessionDuration: 25
  };

  const scalingAnalysis = costModelingService.calculateTrafficBasedCostScaling(
    sampleEcommerceSystem,
    trafficScaling,
    'aws'
  );
  
  console.log(`Average Cost: $${scalingAnalysis.averageCost.total.toFixed(2)}/hour`);
  console.log(`Peak Cost (Black Friday): $${scalingAnalysis.peakCost.total.toFixed(2)}/hour`);
  console.log(`Cost Variability: ${scalingAnalysis.scalingAnalysis.costVariability.toFixed(1)}%`);
  console.log(`Peak-to-Average Ratio: ${scalingAnalysis.scalingAnalysis.peakToAverageRatio.toFixed(1)}x`);
  console.log();

  // Demo 5: SRS FR-8.5 - Cost vs Performance Tradeoff Analysis
  console.log('⚖️  SRS FR-8.5: Cost vs Performance Tradeoff Analysis');
  console.log('==================================================');
  
  const performanceRequirements = {
    maxLatency: 100, // 100ms max response time
    minThroughput: 5000, // 5000 requests/second
    minAvailability: 99.9 // 99.9% uptime
  };

  const tradeoffMatrix = costPerformanceTradeoffAnalyzer.generatePerformanceCostMatrix(
    sampleEcommerceSystem,
    50000, // 50K users
    performanceRequirements,
    'aws'
  );
  
  console.log('Optimization Scenarios:');
  tradeoffMatrix.scenarios.forEach(scenario => {
    console.log(`\n${scenario.name}:`);
    console.log(`  Cost: $${scenario.metrics.cost.total.toFixed(2)}/hour`);
    console.log(`  Latency: ${scenario.metrics.performance.latency.p95.toFixed(0)}ms (p95)`);
    console.log(`  Throughput: ${scenario.metrics.performance.throughput.toLocaleString()} req/s`);
    console.log(`  Availability: ${scenario.metrics.performance.availability.toFixed(1)}%`);
    console.log(`  Cost Efficiency: ${scenario.score.costEfficiency.toFixed(1)}`);
  });

  console.log(`\n🎯 Recommended Scenario: ${tradeoffMatrix.recommendations.userRecommended.name}`);
  console.log(`   Sweet Spot Cost: $${tradeoffMatrix.tradeoffAnalysis.sweetSpot.cost.toFixed(2)}/hour`);
  console.log(`   Sweet Spot Performance: ${tradeoffMatrix.tradeoffAnalysis.sweetSpot.performance.toFixed(1)}/100`);
  console.log();

  // Demo 6: Real-time Cost Estimation
  console.log('⏱️  Real-time Cost Estimation');
  console.log('============================');
  
  const realTimeCosts = costModelingService.getRealTimeCostEstimate(
    sampleEcommerceSystem,
    50000,
    'aws'
  );
  
  console.log(`Current Hourly Cost: $${realTimeCosts.hourly.total.toFixed(2)}`);
  console.log(`Daily Cost: $${realTimeCosts.daily.total.toFixed(2)}`);
  console.log(`Monthly Cost: $${realTimeCosts.monthly.total.toFixed(2)}`);
  
  console.log('\nCost Projections by User Scale:');
  realTimeCosts.projections.forEach(projection => {
    console.log(`  ${projection.userCount.toLocaleString()} users: $${projection.cost.toFixed(2)}/month`);
  });
  console.log();

  // Demo 7: Cost Optimization Recommendations
  console.log('💡 Cost Optimization Recommendations');
  console.log('===================================');
  
  const optimizations = costPerformanceTradeoffAnalyzer.analyzeCostOptimizationOpportunities(
    sampleEcommerceSystem,
    realTimeCosts.monthly,
    {
      latency: { p50: 50, p95: 100, p99: 200 },
      throughput: 5000,
      availability: 99.9,
      reliability: 99.5,
      scalability: 85
    },
    {
      latencyIncrease: 20, // Accept up to 20% latency increase
      throughputDecrease: 10, // Accept up to 10% throughput decrease
      availabilityDecrease: 0.1 // Accept minimal availability decrease
    }
  );
  
  console.log('Top Optimization Opportunities:');
  optimizations.slice(0, 3).forEach((opt, index) => {
    console.log(`\n${index + 1}. ${opt.opportunity}`);
    console.log(`   Description: ${opt.description}`);
    console.log(`   Potential Savings: $${opt.costSavings.toFixed(2)}/month`);
    console.log(`   Implementation: ${opt.implementationEffort} effort, ${opt.feasibility} feasibility`);
    console.log(`   Recommendation: ${opt.recommendation.toUpperCase()}`);
  });

  console.log('\n✅ Cost Modeling Demo Complete!');
  console.log('\nKey Insights:');
  console.log('- Auto-scaling can reduce costs by 30-60% during low-traffic periods');
  console.log('- CDN implementation can reduce network costs by 60% while improving performance');
  console.log('- Storage tiering can save 20-40% on storage costs with minimal performance impact');
  console.log('- Right-sizing instances can reduce compute costs by 25% with proper monitoring');
  console.log('- Peak traffic planning is crucial for e-commerce (4x cost increase during sales events)');
}

// Run the demo
if (require.main === module) {
  demonstrateCostModeling().catch(console.error);
}

export { demonstrateCostModeling };