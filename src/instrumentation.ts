/**
 * Next.js Instrumentation
 * Runs on server startup - validates network configuration
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on server side (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid bundling issues
    const { logNetworkValidation } = await import('./lib/network-config');
    
    // Log network validation on startup
    logNetworkValidation();
    
    // Log startup info
    console.log('');
    console.log('───────────────────────────────────────────────────────────');
    console.log('🚀 AI Liquidity Manager Started');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   NODE_ENV:     ${process.env.NODE_ENV}`);
    console.log(`   NEXT_RUNTIME: ${process.env.NEXT_RUNTIME}`);
    console.log(`   TIMESTAMP:    ${new Date().toISOString()}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
  }
}
