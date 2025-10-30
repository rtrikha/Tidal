/**
 * Clean Bull Queue Script
 * Removes all jobs from the ingestion queue (pending, active, completed, failed, delayed)
 */

import * as BullModule from 'bull';

const Queue = BullModule.default;

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

async function cleanQueue() {
  try {
    console.log('🔧 Connecting to Redis...');
    
    const queueConfig = {
      redis: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        ...(REDIS_PASSWORD && { password: REDIS_PASSWORD }),
      },
    };

    const queue = new Queue('tidal-ingestion', queueConfig);

    console.log('📊 Checking queue status...');
    
    // Get job counts before cleaning
    const jobCounts = await queue.getJobCounts();
    console.log('📈 Jobs before cleaning:');
    console.log(`   ⏳ Pending: ${jobCounts.wait}`);
    console.log(`   ▶️  Active: ${jobCounts.active}`);
    console.log(`   ✅ Completed: ${jobCounts.completed}`);
    console.log(`   ❌ Failed: ${jobCounts.failed}`);
    console.log(`   ⏱️  Delayed: ${jobCounts.delayed}`);

    // Clean all job states
    console.log('\n🗑️  Cleaning queue...');
    
    // Remove all jobs by state
    await queue.clean(0, 'completed');
    await queue.clean(0, 'failed');
    await queue.clean(0, 'delayed');
    
    // Get all jobs and remove them
    const allJobs = await queue.getJobs(['active', 'wait', 'paused']);
    console.log(`   Found ${allJobs.length} jobs to remove...`);
    
    for (const job of allJobs) {
      try {
        await job.remove();
      } catch (e) {
        // Job might already be removed
      }
    }
    
    // Finally, empty the queue
    await queue.empty();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newJobCounts = await queue.getJobCounts();
    console.log('\n✅ Jobs after cleaning:');
    console.log(`   ⏳ Pending: ${newJobCounts.wait}`);
    console.log(`   ▶️  Active: ${newJobCounts.active}`);
    console.log(`   ✅ Completed: ${newJobCounts.completed}`);
    console.log(`   ❌ Failed: ${newJobCounts.failed}`);
    console.log(`   ⏱️  Delayed: ${newJobCounts.delayed}`);

    console.log('\n🎉 Queue cleaned successfully!');
    
    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning queue:', error);
    process.exit(1);
  }
}

cleanQueue();
