/**
 * Retry utility for handling Supabase connection timeouts
 */

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a connection timeout/fetch failed error
      const isTimeoutError = 
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('Connection timed out') ||
        error?.message?.includes('522') ||
        error?.code === 'ECONNRESET';
      
      if (isTimeoutError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`  ⏳ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay/1000}s...`);
        console.log(`     Reason: ${error.message || 'Connection timeout'}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

export async function waitForSupabaseWakeup(
  supabase: any,
  maxWaitTime: number = 60000 // 60 seconds
): Promise<boolean> {
  console.log('⏳ Waiting for Supabase to wake up...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const { error } = await supabase
        .from('designs')
        .select('id')
        .limit(1);
      
      if (!error) {
        console.log('✅ Supabase is awake!\n');
        return true;
      }
    } catch (err) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    process.stdout.write('.');
  }
  
  console.log('\n❌ Supabase did not wake up in time.\n');
  return false;
}

