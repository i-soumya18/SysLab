import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

export async function setupRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500)
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  redisClient.on('ready', () => {
    console.log('Redis Client Ready');
  });

  redisClient.on('end', () => {
    console.log('Redis Client Disconnected');
  });

  try {
    await redisClient.connect();
    
    // Test Redis connection
    await redisClient.ping();
    console.log('✅ Redis connection successful');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call setupRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}