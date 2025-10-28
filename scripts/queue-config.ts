import * as BullModule from 'bull';
const Queue = BullModule.default;

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

export const createIngestionQueue = () => {
  const queueConfig = {
    redis: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      ...(REDIS_PASSWORD && { password: REDIS_PASSWORD }),
    },
    defaultJobOptions: {
      timeout: 300000,  // 5 minutes timeout per job
    },
    settings: {
      maxStalledCount: 2,  // Allow 2 stall retries before failing
      stalledInterval: 60000,  // Check for stalled jobs every 60 seconds
      lockDuration: 60000,  // Job lock duration 60 seconds
      lockRenewTime: 30000,  // Renew lock every 30 seconds
    },
  };

  const queue = new Queue('tidal-ingestion', queueConfig);

  queue.on('error', (err) => {
    console.error('❌ Queue error:', err);
  });

  queue.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
  });

  queue.on('stalled', (job) => {
    console.warn(`⚠️  Job ${job.id} stalled - will be retried`);
  });

  return queue;
};
