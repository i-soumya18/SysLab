import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import { componentLibrarySEO } from '../../config/seoPages';

interface ComponentSpec {
  name: string;
  icon: string;
  category: string;
  description: string;
  capacity: string;
  latency: string;
  characteristics: string[];
  scalingStrategies: string[];
  failureModes: string[];
  configurationOptions: {name: string; description: string}[];
  realWorldExamples: string[];
  behavioralModel: {
    queueing: string;
    backpressure: string;
    retry: string;
    timeout: string;
  };
}

const COMPONENT_LIBRARY: ComponentSpec[] = [
  {
    name: 'Load Balancer',
    icon: '⚖️',
    category: 'Traffic Management',
    description: 'Distributes incoming requests across multiple backend servers using configurable algorithms. Performs health checking and removes failed instances from rotation. Critical for horizontal scaling and high availability.',
    capacity: '10,000 - 100,000 RPS',
    latency: '1-5ms overhead',
    characteristics: [
      'Request distribution (Round-robin, Least connections, Weighted, IP hash)',
      'Health checking with configurable intervals',
      'Session persistence (sticky sessions)',
      'SSL termination',
      'Connection pooling',
      'Request buffering during backend slowness'
    ],
    scalingStrategies: [
      'Horizontal: Add more load balancer instances',
      'Vertical: Upgrade to higher throughput LB',
      'Geographic: Deploy regional load balancers',
      'Layer 4 (TCP) vs Layer 7 (HTTP) selection'
    ],
    failureModes: [
      'Backend server failure → Remove from pool',
      'All backends down → 503 Service Unavailable',
      'LB instance failure → DNS failover to backup',
      'Overload → Connection queueing, eventual timeout'
    ],
    configurationOptions: [
      {name: 'Algorithm', description: 'Round-robin, least-connections, weighted, IP hash'},
      {name: 'Health Check Interval', description: 'Frequency of backend health probes (1-60 seconds)'},
      {name: 'Health Check Timeout', description: 'Max time to wait for health response'},
      {name: 'Unhealthy Threshold', description: 'Failed checks before removing backend'},
      {name: 'Connection Timeout', description: 'Max time to establish backend connection'},
      {name: 'Idle Timeout', description: 'Max idle time before closing connection'},
      {name: 'Max Connections', description: 'Concurrent connection limit'}
    ],
    realWorldExamples: ['AWS ELB/ALB', 'Azure Load Balancer', 'GCP Cloud Load Balancing', 'NGINX', 'HAProxy'],
    behavioralModel: {
      queueing: 'Requests queue when all backends are at capacity. Queue length affects latency. If queue overflows, connections are refused.',
      backpressure: 'When backends are slow, LB accumulates connections. Once max connections reached, new requests fail immediately.',
      retry: 'Failed requests can be retried to different backends. Configurable retry count and backoff strategy.',
      timeout: 'Connection timeout triggers failover to next backend. Total request timeout causes 504 Gateway Timeout.'
    }
  },
  {
    name: 'Database (SQL)',
    icon: '💾',
    category: 'Data Storage',
    description: 'Relational database with ACID transactions, SQL queries, and data persistence. Provides strong consistency but limited horizontal scalability. Primary-replica replication for read scaling.',
    capacity: '1,000 - 10,000 QPS (writes), 10,000 - 100,000 QPS (reads)',
    latency: '1-10ms (cached), 10-100ms (disk I/O)',
    characteristics: [
      'ACID transactions (Atomicity, Consistency, Isolation, Durability)',
      'SQL query execution with query planner',
      'Connection pooling (limited connections ~ 100-1000)',
      'B-tree indexes for fast lookups',
      'Write-Ahead Logging (WAL) for durability',
      'Lock-based concurrency control',
      'Query cache for repeated reads'
    ],
    scalingStrategies: [
      'Vertical: Increase CPU/RAM/IOPS',
      'Read replicas: Asynchronous replication (eventual consistency)',
      'Connection pooling: Reuse connections efficiently',
      'Caching: Add Redis/Memcached layer',
      'Sharding: Partition data across multiple DBs (complex)',
      'Read/write splitting: Route reads to replicas'
    ],
    failureModes: [
      'Connection pool exhaustion → Clients wait or timeout',
      'Lock contention → Transaction delays, deadlocks',
      'Disk full → Write failures',
      'Replication lag → Stale reads from replicas',
      'Primary failure → Automatic failover to replica (30-60s downtime)',
      'Slow queries → Resource starvation for other queries'
    ],
    configurationOptions: [
      {name: 'Max Connections', description: 'Total concurrent connections (50-1000)'},
      {name: 'Connection Timeout', description: 'Max time to acquire connection from pool'},
      {name: 'Query Timeout', description: 'Max query execution time before cancellation'},
      {name: 'Replication Type', description: 'Synchronous (strong consistency) vs Asynchronous (eventual consistency)'},
      {name: 'Replication Lag', description: 'Delay between primary and replica writes'},
      {name: 'Transaction Isolation', description: 'Read Uncommitted, Read Committed, Repeatable Read, Serializable'},
      {name: 'Cache Size', description: 'In-memory buffer pool size'},
      {name: 'WAL Size', description: 'Write-ahead log buffer for durability'}
    ],
    realWorldExamples: ['PostgreSQL', 'MySQL', 'AWS RDS', 'Azure SQL', 'Google Cloud SQL'],
    behavioralModel: {
      queueing: 'Requests wait in connection pool queue if all connections are in use. Long queues indicate pool exhaustion.',
      backpressure: 'When DB is overloaded, queries slow down. Connection acquisition times increase. Eventually clients timeout.',
      retry: 'Transient errors (deadlocks, timeouts) can be retried. Permanent errors (constraint violations) should not be retried.',
      timeout: 'Query timeout kills long-running queries. Connection timeout fails to acquire connection. Transaction timeout rolls back long transactions.'
    }
  },
  {
    name: 'Cache (Redis/Memcached)',
    icon: '⚡',
    category: 'Data Storage',
    description: 'In-memory key-value store for ultra-fast data access. Used to reduce database load and improve read latency. Data is ephemeral with TTL-based expiration.',
    capacity: '100,000 - 1,000,000 RPS',
    latency: '<1ms (memory access)',
    characteristics: [
      'In-memory storage (volatile by default)',
      'Key-value data model',
      'Configurable eviction policies (LRU, LFU, FIFO)',
      'TTL (Time To Live) for automatic expiration',
      'Hit/miss ratio tracking',
      'Cache warming strategies',
      'Distributed caching with consistent hashing'
    ],
    scalingStrategies: [
      'Vertical: More RAM for larger cache',
      'Horizontal: Add cache nodes with sharding',
      'Read replicas: For read-heavy workloads',
      'Multi-tier caching: L1 (local) + L2 (distributed)',
      'Cache-aside vs Write-through patterns'
    ],
    failureModes: [
      'Cache miss → Database query (latency spike)',
      'Cache eviction → Popular keys removed under memory pressure',
      'Hot key problem → Single key causes load concentration',
      'Cache stampede → Multiple clients request same missing key simultaneously',
      'Cache invalidation → Stale data if not properly invalidated',
      'Node failure → Lost data, increased DB load'
    ],
    configurationOptions: [
      {name: 'Eviction Policy', description: 'LRU (Least Recently Used), LFU (Least Frequently Used), FIFO, Random'},
      {name: 'Max Memory', description: 'Total memory allocated for cache'},
      {name: 'Default TTL', description: 'Time before keys expire automatically'},
      {name: 'Persistence', description: 'None (volatile), AOF (append-only file), RDB (snapshots)'},
      {name: 'Replication', description: 'Primary-replica for high availability'},
      {name: 'Sharding Strategy', description: 'Consistent hashing for distributed caching'}
    ],
    realWorldExamples: ['Redis', 'Memcached', 'AWS ElastiCache', 'Azure Cache for Redis'],
    behavioralModel: {
      queueing: 'Single-threaded execution (Redis). Commands queue if processing is slow. Pipelining can batch commands.',
      backpressure: 'Memory pressure triggers evictions based on policy. Clients may see increased cache misses.',
      retry: 'Network failures can be retried. Cache misses should fall back to database.',
      timeout: 'Operations timeout if cache node is unresponsive. Client should have short timeout to avoid cascading delays.'
    }
  },
  {
    name: 'Message Queue',
    icon: '📨',
    category: 'Asynchronous Processing',
    description: 'Decouples producers and consumers with reliable message delivery. Provides buffering during consumer slowness and enables asynchronous processing patterns.',
    capacity: '1,000 - 100,000 messages/sec',
    latency: '1-10ms (in-memory), 10-100ms (persistent)',
    characteristics: [
      'Message ordering guarantees (FIFO, priority, unordered)',
      'Delivery semantics (at-least-once, at-most-once, exactly-once)',
      'Message persistence (durable vs in-memory)',
      'Dead letter queue for failed messages',
      'Consumer groups for parallel processing',
      'Backpressure handling',
      'Message retention and replay'
    ],
    scalingStrategies: [
      'Horizontal: Add more queue partitions',
      'Consumer scaling: Increase consumer instances',
      'Partitioning: Shard messages by key',
      'Priority queues: Separate queues by urgency',
      'Batch processing: Process messages in batches'
    ],
    failureModes: [
      'Consumer lag → Messages accumulate',
      'Full queue → Producer blocking or message rejection',
      'Poison message → Repeated failures move to DLQ',
      'Consumer crash → Message redelivery',
      'Network partition → Duplicate messages possible',
      'Broker failure → Data loss if not replicated'
    ],
    configurationOptions: [
      {name: 'Ordering', description: 'FIFO (strict order), Priority (importance-based), Unordered (fastest)'},
      {name: 'Delivery Guarantee', description: 'At-least-once, At-most-once, Exactly-once'},
      {name: 'Persistence', description: 'In-memory (fast, volatile), Disk (durable, slower)'},
      {name: 'Retention Period', description: 'How long to keep acknowledged messages'},
      {name: 'Consumer Group', description: 'Parallel consumers with load balancing'},
      {name: 'Visibility Timeout', description: 'Time before message redelivery after fetch'},
      {name: 'Max Message Size', description: 'Upper limit on message payload'},
      {name: 'DLQ Threshold', description: 'Failed delivery attempts before moving to DLQ'}
    ],
    realWorldExamples: ['RabbitMQ', 'Apache Kafka', 'AWS SQS', 'Azure Service Bus', 'Google Pub/Sub'],
    behavioralModel: {
      queueing: 'Messages queue until consumers are ready. Queue depth indicates consumer lag.',
      backpressure: 'When consumers are slow, queue depth grows. Eventually queue may block producers or reject messages.',
      retry: 'Failed messages are redelivered based on visibility timeout. After max retries, moved to DLQ.',
      timeout: 'Visibility timeout controls redelivery. Consumer processing timeout causes message to become visible again.'
    }
  },
  {
    name: 'CDN (Content Delivery Network)',
    icon: '🌍',
    category: 'Content Distribution',
    description: 'Geographically distributed cache network that serves static content from edge locations closest to users. Dramatically reduces latency and origin server load.',
    capacity: '1,000,000+ RPS globally',
    latency: '10-50ms (edge hit), 100-500ms (origin fetch)',
    characteristics: [
      'Geographic distribution (edge locations)',
      'Cache hit ratio optimization',
      'Origin request minimization',
      'Cache invalidation (purge, TTL)',
      'SSL/TLS termination at edge',
      'Smart routing to nearest edge',
      'Cache warming and prefetching'
    ],
    scalingStrategies: [
      'Geographic expansion: More edge locations',
      'Cache optimization: Increase edge cache size',
      'Origin shielding: Intermediate caching layer',
      'Smart invalidation: Minimize origin requests',
      'Multi-CDN: Use multiple CDN providers'
    ],
    failureModes: [
      'Edge cache miss → Origin request (latency spike)',
      'Origin overload → Cascade effect from cache misses',
      'Cache poisoning → Stale/incorrect content cached',
      'Edge location failure → Fallback to other edges',
      'Network partition → Some regions isolated'
    ],
    configurationOptions: [
      {name: 'Cache TTL', description: 'Time before content expires (seconds to days)'},
      {name: 'Edge Locations', description: 'Geographic regions to serve from'},
      {name: 'Origin Server', description: 'Backend server for cache misses'},
      {name: 'Cache Behavior', description: 'Which content to cache vs bypass'},
      {name: 'Invalidation Strategy', description: 'TTL, manual purge, versioned URLs'},
      {name: 'Compression', description: 'Gzip/Brotli compression at edge'}
    ],
    realWorldExamples: ['CloudFlare', 'AWS CloudFront', 'Azure CDN', 'Akamai', 'Fastly'],
    behavioralModel: {
      queueing: 'Edge serves cached content immediately. Origin requests queue during cache misses.',
      backpressure: 'Origin overload triggers circuit breaker. CDN may serve stale content to protect origin.',
      retry: 'Failed origin requests retry with backoff. After threshold, serve stale or error page.',
      timeout: 'Origin timeout triggers fallback behavior. Edge may serve stale content or error page.'
    }
  },
  {
    name: 'Application Service',
    icon: '⚙️',
    category: 'Compute',
    description: 'Stateless application server that processes business logic. Horizontally scalable behind load balancer. Communicates with databases, caches, and other services.',
    capacity: '100 - 1,000 RPS per instance',
    latency: '10-100ms (simple), 100ms-1s (complex)',
    characteristics: [
      'Stateless design for horizontal scaling',
      'Request processing and business logic',
      'Database and cache integration',
      'Circuit breaker for dependency failures',
      'Rate limiting and throttling',
      'Autoscaling based on metrics',
      'Health check endpoints'
    ],
    scalingStrategies: [
      'Horizontal: Add more service instances',
      'Autoscaling: Based on CPU, memory, request count',
      'Vertical: Upgrade instance size',
      'Caching: Reduce external dependencies',
      'Asynchronous processing: Offload to queues'
    ],
    failureModes: [
      'Dependency failure → Circuit breaker opens',
      'Memory leak → Gradual performance degradation',
      'CPU saturation → Request timeout',
      'Thread pool exhaustion → Queue backlog',
      'Cascading failures → Dependency timeouts propagate'
    ],
    configurationOptions: [
      {name: 'Instance Count', description: 'Number of running instances'},
      {name: 'Instance Size', description: 'CPU and memory allocation'},
      {name: 'Thread Pool Size', description: 'Concurrent request handling'},
      {name: 'Request Timeout', description: 'Max processing time per request'},
      {name: 'Circuit Breaker', description: 'Failure threshold and recovery time'},
      {name: 'Rate Limit', description: 'Requests per second per client'},
      {name: 'Autoscaling Policy', description: 'Scale up/down thresholds'}
    ],
    realWorldExamples: ['Node.js', 'Java Spring Boot', 'Python Django', 'Go services'],
    behavioralModel: {
      queueing: 'Requests queue in thread pool when all workers are busy. Queue overflow causes request rejection.',
      backpressure: 'When dependencies are slow, request latency increases. Circuit breaker opens to prevent cascading failures.',
      retry: 'Failed requests can be retried with exponential backoff. Idempotent operations are safe to retry.',
      timeout: 'Request timeout cancels long-running operations. Circuit breaker timeout triggers fallback behavior.'
    }
  },
  {
    name: 'API Gateway',
    icon: '🚪',
    category: 'Traffic Management',
    description: 'Unified entry point for all API requests. Handles authentication, rate limiting, request routing, and protocol translation. Essential for microservices architecture.',
    capacity: '10,000 - 100,000 RPS',
    latency: '5-20ms overhead',
    characteristics: [
      'Request routing to microservices',
      'Authentication and authorization',
      'Rate limiting and throttling',
      'Request/response transformation',
      'Protocol translation (REST, GraphQL, gRPC)',
      'API versioning',
      'Monitoring and analytics'
    ],
    scalingStrategies: [
      'Horizontal: Add more gateway instances',
      'Geographic distribution: Regional gateways',
      'Caching: Response caching at gateway',
      'Request batching: Combine multiple requests'
    ],
    failureModes: [
      'Downstream service failure → Fallback responses',
      'Authentication service down → Block all requests',
      'Rate limit exceeded → 429 Too Many Requests',
      'Gateway overload → Connection refusal'
    ],
    configurationOptions: [
      {name: 'Routing Rules', description: 'Path-based routing to backend services'},
      {name: 'Auth Strategy', description: 'JWT, OAuth, API keys'},
      {name: 'Rate Limiting', description: 'Requests per time window per client'},
      {name: 'Timeout', description: 'Max upstream request time'},
      {name: 'Retry Policy', description: 'Automatic retry configuration'},
      {name: 'CORS Policy', description: 'Cross-origin resource sharing rules'}
    ],
    realWorldExamples: ['Kong', 'AWS API Gateway', 'Azure API Management', 'Apigee'],
    behavioralModel: {
      queueing: 'Requests queue during upstream slowness. Rate limiting prevents queue overflow.',
      backpressure: 'Upstream failures trigger circuit breaker. Gateway returns cached or fallback responses.',
      retry: 'Failed upstream requests retry with exponential backoff. After max retries, return error.',
      timeout: 'Upstream timeout triggers fallback response or error. Gateway timeout protects clients from hanging.'
    }
  },
  {
    name: 'Object Storage',
    icon: '🗄️',
    category: 'Data Storage',
    description: 'Scalable, durable storage for unstructured data (images, videos, documents). Provides HTTP-based access with eventual consistency. Infinitely scalable.',
    capacity: 'Virtually unlimited (petabytes)',
    latency: '50-200ms (first byte)',
    characteristics: [
      'Object-based storage (not file system)',
      'HTTP REST API access',
      'Eventual consistency guarantee',
      'Automatic replication across zones',
      'Versioning and lifecycle policies',
      'Built-in CDN integration',
      'Durability: 99.999999999% (11 nines)'
    ],
    scalingStrategies: [
      'Automatic scaling: Managed service',
      'Multi-region replication',
      'CDN integration for hot objects',
      'Tiered storage: Hot, warm, cold, archive'
    ],
    failureModes: [
      'Network failure → Retry with exponential backoff',
      'Transient errors → Automatic retry',
      'Rate limiting → 503 Slow Down',
      'Object not found → 404 error'
    ],
    configurationOptions: [
      {name: 'Storage Class', description: 'Standard, Infrequent Access, Glacier'},
      {name: 'Replication', description: 'Cross-region replication'},
      {name: 'Versioning', description: 'Keep multiple versions of objects'},
      {name: 'Lifecycle Rules', description: 'Automatic transitions and expiration'},
      {name: 'Access Control', description: 'Public, private, signed URLs'}
    ],
    realWorldExamples: ['AWS S3', 'Azure Blob Storage', 'Google Cloud Storage'],
    behavioralModel: {
      queueing: 'Requests queue during rate limiting. Automatic throttling prevents overload.',
      backpressure: 'Rate limits enforced per bucket. Clients should implement exponential backoff.',
      retry: 'Transient errors (500, 503) should be retried. 4xx errors should not be retried.',
      timeout: 'Long upload/download timeouts. clients should implement resumable uploads for large objects.'
    }
  }
];

const CATEGORIES = ['All', 'Traffic Management', 'Data Storage', 'Asynchronous Processing', 'Content Distribution', 'Compute'];

export function ComponentLibraryPage() {
  useSEO(componentLibrarySEO);
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedComponent, setSelectedComponent] = useState<ComponentSpec | null>(null);
  const navigate = useNavigate();

  const filteredComponents = selectedCategory === 'All'
    ? COMPONENT_LIBRARY
    : COMPONENT_LIBRARY.filter(c => c.category === selectedCategory);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900">Component Library</h1>
          <p className="mt-4 text-xl text-gray-600">
            Industry-standard distributed system components with production-ready behavior models.
            Each component simulates real-world characteristics including capacity limits, latency, failure modes, and scaling strategies.
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="border-b border-gray-200 bg-white py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Component Grid */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredComponents.map(component => (
            <button
              key={component.name}
              onClick={() => setSelectedComponent(component)}
              className="rounded-xl border-2 border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-blue-500 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="text-4xl">{component.icon}</div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                  {component.category}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">{component.name}</h3>
              <p className="mt-2 text-sm text-gray-600 line-clamp-3">{component.description}</p>
              <div className="mt-4 space-y-1">
                <div className="text-xs text-gray-500">Capacity: {component.capacity}</div>
                <div className="text-xs text-gray-500">Latency: {component.latency}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Component Detail Modal */}
      {selectedComponent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl">
              {/* Modal Header */}
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">{selectedComponent.icon}</div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900">{selectedComponent.name}</h2>
                      <span className="inline-block mt-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                        {selectedComponent.category}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedComponent(null)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="max-h-[70vh] overflow-y-auto p-6">
                {/* Description */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Description</h3>
                  <p className="mt-2 text-gray-700">{selectedComponent.description}</p>
                </div>

                {/* Specifications */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <div className="text-sm font-medium text-blue-900">Capacity</div>
                    <div className="mt-1 text-lg font-semibold text-blue-700">{selectedComponent.capacity}</div>
                  </div>
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="text-sm font-medium text-green-900">Latency</div>
                    <div className="mt-1 text-lg font-semibold text-green-700">{selectedComponent.latency}</div>
                  </div>
                </div>

                {/* Characteristics */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Key Characteristics</h3>
                  <ul className="mt-2 space-y-2">
                    {selectedComponent.characteristics.map((char, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1 text-blue-500">•</span>
                        <span className="text-gray-700">{char}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Behavioral Model */}
                <div className="mb-6 rounded-lg bg-purple-50 p-4">
                  <h3 className="text-lg font-semibold text-purple-900">Behavioral Model</h3>
                  <div className="mt-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-purple-800">Queueing Behavior</h4>
                      <p className="mt-1 text-sm text-purple-700">{selectedComponent.behavioralModel.queueing}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-purple-800">Backpressure Handling</h4>
                      <p className="mt-1 text-sm text-purple-700">{selectedComponent.behavioralModel.backpressure}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-purple-800">Retry Logic</h4>
                      <p className="mt-1 text-sm text-purple-700">{selectedComponent.behavioralModel.retry}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-purple-800">Timeout Behavior</h4>
                      <p className="mt-1 text-sm text-purple-700">{selectedComponent.behavioralModel.timeout}</p>
                    </div>
                  </div>
                </div>

                {/* Scaling Strategies */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Scaling Strategies</h3>
                  <div className="mt-2 space-y-2">
                    {selectedComponent.scalingStrategies.map((strategy, idx) => (
                      <div key={idx} className="rounded-lg bg-green-50 p-3">
                        <span className="text-sm text-green-900">{strategy}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Failure Modes */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Failure Modes</h3>
                  <div className="mt-2 space-y-2">
                    {selectedComponent.failureModes.map((failure, idx) => (
                      <div key={idx} className="rounded-lg bg-red-50 p-3">
                        <span className="text-sm text-red-900">{failure}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configuration Options */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Configuration Options</h3>
                  <div className="mt-2 space-y-3">
                    {selectedComponent.configurationOptions.map((option, idx) => (
                      <div key={idx} className="border-l-4 border-blue-500 bg-gray-50 p-3">
                        <div className="font-semibold text-gray-900">{option.name}</div>
                        <div className="mt-1 text-sm text-gray-700">{option.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-World Examples */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Real-World Examples</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedComponent.realWorldExamples.map((example, idx) => (
                      <span key={idx} className="rounded-full bg-gray-200 px-3 py-1 text-sm text-gray-700">
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedComponent(null)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setSelectedComponent(null);
                      navigate('/dashboard');
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Use in Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
