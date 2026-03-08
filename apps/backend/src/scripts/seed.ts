/**
 * Database Seed Script
 * Creates demo user and sample scenarios for testing
 */

import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'system_design_simulator',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

interface SampleScenario {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  trafficLoad: number;
  constraints: Record<string, any>;
  components: any[];
  learningObjectives: string[];
}

const sampleScenarios: SampleScenario[] = [
  {
    title: 'Simple Web Application',
    description: 'Design a basic web application that can handle 1000 concurrent users with low latency requirements.',
    difficulty: 'beginner',
    category: 'web-applications',
    trafficLoad: 1000,
    constraints: {
      maxLatency: 200,
      maxErrorRate: 0.01,
      budget: 5000
    },
    components: [
      {
        type: 'load-balancer',
        name: 'Load Balancer',
        position: { x: 100, y: 200 },
        config: { algorithm: 'round-robin' }
      },
      {
        type: 'web-server',
        name: 'Web Server',
        position: { x: 300, y: 200 },
        config: { replicas: 1 }
      },
      {
        type: 'database',
        name: 'Database',
        position: { x: 500, y: 200 },
        config: { type: 'postgresql' }
      }
    ],
    learningObjectives: [
      'Understand basic web architecture patterns',
      'Learn about load balancing',
      'Identify database bottlenecks'
    ]
  },
  {
    title: 'High-Traffic E-commerce Platform',
    description: 'Build a scalable e-commerce platform that handles 50,000 concurrent users during peak shopping hours.',
    difficulty: 'intermediate',
    category: 'e-commerce',
    trafficLoad: 50000,
    constraints: {
      maxLatency: 100,
      maxErrorRate: 0.005,
      budget: 25000
    },
    components: [
      {
        type: 'cdn',
        name: 'Content Delivery Network',
        position: { x: 100, y: 100 },
        config: { enabled: true }
      },
      {
        type: 'load-balancer',
        name: 'Load Balancer',
        position: { x: 100, y: 250 },
        config: { algorithm: 'least-connections' }
      },
      {
        type: 'web-server',
        name: 'Web Server Pool',
        position: { x: 300, y: 250 },
        config: { replicas: 3 }
      },
      {
        type: 'cache',
        name: 'Redis Cache',
        position: { x: 500, y: 150 },
        config: { type: 'redis', ttl: 300 }
      },
      {
        type: 'database',
        name: 'Primary Database',
        position: { x: 500, y: 300 },
        config: { type: 'postgresql', replicas: 1 }
      },
      {
        type: 'message-queue',
        name: 'Order Queue',
        position: { x: 700, y: 250 },
        config: { type: 'rabbitmq' }
      }
    ],
    learningObjectives: [
      'Design for horizontal scalability',
      'Implement caching strategies',
      'Handle high-traffic scenarios',
      'Use message queues for async processing'
    ]
  },
  {
    title: 'Social Media Feed System',
    description: 'Design a social media platform that delivers personalized feeds to 100,000 concurrent users in real-time.',
    difficulty: 'intermediate',
    category: 'social-media',
    trafficLoad: 100000,
    constraints: {
      maxLatency: 150,
      maxErrorRate: 0.01,
      budget: 50000
    },
    components: [
      {
        type: 'load-balancer',
        name: 'Global Load Balancer',
        position: { x: 100, y: 250 },
        config: { algorithm: 'least-connections' }
      },
      {
        type: 'web-server',
        name: 'API Servers',
        position: { x: 300, y: 250 },
        config: { replicas: 5 }
      },
      {
        type: 'cache',
        name: 'Feed Cache',
        position: { x: 500, y: 150 },
        config: { type: 'redis', ttl: 60 }
      },
      {
        type: 'database',
        name: 'User Database',
        position: { x: 500, y: 300 },
        config: { type: 'postgresql', sharded: true }
      },
      {
        type: 'message-queue',
        name: 'Event Stream',
        position: { x: 700, y: 250 },
        config: { type: 'kafka' }
      },
      {
        type: 'storage',
        name: 'Media Storage',
        position: { x: 700, y: 400 },
        config: { type: 's3' }
      }
    ],
    learningObjectives: [
      'Design real-time feed systems',
      'Implement caching for personalized content',
      'Handle read-heavy workloads',
      'Use event streaming for notifications'
    ]
  },
  {
    title: 'Video Streaming Service',
    description: 'Build a video streaming platform serving 200,000 concurrent users with minimal buffering.',
    difficulty: 'advanced',
    category: 'media-streaming',
    trafficLoad: 200000,
    constraints: {
      maxLatency: 50,
      maxErrorRate: 0.001,
      budget: 100000
    },
    components: [
      {
        type: 'cdn',
        name: 'Multi-Region CDN',
        position: { x: 100, y: 200 },
        config: { regions: ['us-east', 'us-west', 'eu-west', 'ap-south'] }
      },
      {
        type: 'load-balancer',
        name: 'Origin Load Balancer',
        position: { x: 300, y: 200 },
        config: { algorithm: 'least-bandwidth' }
      },
      {
        type: 'storage',
        name: 'Video Origin Servers',
        position: { x: 500, y: 200 },
        config: { type: 's3', replicated: true }
      },
      {
        type: 'web-server',
        name: 'API Servers',
        position: { x: 300, y: 350 },
        config: { replicas: 10 }
      },
      {
        type: 'cache',
        name: 'Metadata Cache',
        position: { x: 500, y: 350 },
        config: { type: 'redis', ttl: 600 }
      },
      {
        type: 'database',
        name: 'User & Content DB',
        position: { x: 700, y: 350 },
        config: { type: 'postgresql', readReplicas: 3 }
      }
    ],
    learningObjectives: [
      'Design globally distributed systems',
      'Optimize for bandwidth-heavy content delivery',
      'Implement multi-region redundancy',
      'Balance origin load with CDN caching'
    ]
  },
  {
    title: 'Real-Time Collaboration Tool',
    description: 'Create a collaborative document editing platform supporting 10,000 concurrent users with real-time sync.',
    difficulty: 'advanced',
    category: 'real-time-collaboration',
    trafficLoad: 10000,
    constraints: {
      maxLatency: 50,
      maxErrorRate: 0.001,
      budget: 30000
    },
    components: [
      {
        type: 'load-balancer',
        name: 'WebSocket Load Balancer',
        position: { x: 100, y: 250 },
        config: { algorithm: 'sticky-sessions' }
      },
      {
        type: 'web-server',
        name: 'WebSocket Servers',
        position: { x: 300, y: 250 },
        config: { replicas: 5, protocol: 'websocket' }
      },
      {
        type: 'cache',
        name: 'State Cache',
        position: { x: 500, y: 150 },
        config: { type: 'redis', pubsub: true }
      },
      {
        type: 'message-queue',
        name: 'Conflict Resolution Queue',
        position: { x: 500, y: 250 },
        config: { type: 'kafka' }
      },
      {
        type: 'database',
        name: 'Document Store',
        position: { x: 700, y: 250 },
        config: { type: 'mongodb', replicated: true }
      },
      {
        type: 'storage',
        name: 'Document Snapshots',
        position: { x: 700, y: 400 },
        config: { type: 's3' }
      }
    ],
    learningObjectives: [
      'Design WebSocket-based real-time systems',
      'Implement operational transformation',
      'Handle conflict resolution',
      'Optimize for low-latency bidirectional communication'
    ]
  }
];

async function createDemoUser(): Promise<string> {
  const email = 'demo@example.com';
  const password = 'DemoPass123';
  const firstName = 'Demo';
  const lastName = 'User';

  // Check if user already exists
  const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

  if (existingUser.rows.length > 0) {
    console.log('✅ Demo user already exists:', email);
    return existingUser.rows[0].id;
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, email_verified, subscription_tier, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id`,
    [email, passwordHash, firstName, lastName, true, 'pro']
  );

  console.log('✅ Created demo user:', email, '/ Password:', password);
  return result.rows[0].id;
}

async function createScenarios(userId: string): Promise<void> {
  for (const scenario of sampleScenarios) {
    // Check if scenario already exists
    const existing = await pool.query(
      'SELECT id FROM scenarios WHERE name = $1',
      [scenario.title]
    );

    if (existing.rows.length > 0) {
      console.log(`⏭️  Scenario already exists: ${scenario.title}`);
      continue;
    }

    // Create scenario
    const scenarioResult = await pool.query(
      `INSERT INTO scenarios (
        name, description, objectives, initial_setup, evaluation_criteria,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id`,
      [
        scenario.title,
        scenario.description,
        JSON.stringify({
          learningObjectives: scenario.learningObjectives,
          difficulty: scenario.difficulty,
          category: scenario.category
        }),
        JSON.stringify({
          trafficLoad: scenario.trafficLoad,
          components: scenario.components
        }),
        JSON.stringify(scenario.constraints)
      ]
    );

    const scenarioId = scenarioResult.rows[0].id;

    // Create workspace for scenario
    const workspaceResult = await pool.query(
      `INSERT INTO workspaces (
        user_id, name, description, configuration,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id`,
      [
        userId,
        `${scenario.title} - Workspace`,
        `Workspace for ${scenario.title}`,
        JSON.stringify({
          scenarioId,
          difficulty: scenario.difficulty,
          category: scenario.category,
          trafficLoad: scenario.trafficLoad
        })
      ]
    );

    const workspaceId = workspaceResult.rows[0].id;

    // Create components in workspace
    for (const component of scenario.components) {
      await pool.query(
        `INSERT INTO components (
          workspace_id, type, position, configuration, metadata,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          workspaceId,
          component.type,
          JSON.stringify({ x: component.position.x, y: component.position.y }),
          JSON.stringify(component.config),
          JSON.stringify({ name: component.name })
        ]
      );
    }

    console.log(`✅ Created scenario: ${scenario.title} (${scenario.difficulty}) with ${scenario.components.length} components`);
  }
}

async function seed(): Promise<void> {
  try {
    console.log('🌱 Starting database seed...\n');

    // Create demo user
    const userId = await createDemoUser();

    // Create sample scenarios
    console.log('\n📦 Creating sample scenarios...\n');
    await createScenarios(userId);

    console.log('\n✅ Database seed completed successfully!');
    console.log('\n📝 Demo Credentials:');
    console.log('   Email: demo@example.com');
    console.log('   Password: DemoPass123');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seed
seed();
