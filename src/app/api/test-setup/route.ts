import { NextResponse } from 'next/server';

/**
 * Test endpoint to check if all environment variables are configured
 * Visit: http://localhost:3000/api/test-setup
 */
export async function GET() {
  const checks = {
    // Clerk
    clerkPublishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkSecret: !!process.env.CLERK_SECRET_KEY,
    
    // Supabase
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
    supabaseBucket: process.env.SUPABASE_BUCKET_NAME || 'pdfs',
    
    // Neon Database
    databaseUrl: !!process.env.DATABASE_URL,
  };

  const allGood = checks.clerkPublishable && 
                  checks.clerkSecret && 
                  checks.supabaseUrl && 
                  checks.supabaseKey && 
                  checks.databaseUrl;

  return NextResponse.json({
    status: allGood ? '✅ ready' : '⚠️ incomplete',
    message: allGood 
      ? 'All environment variables are configured!' 
      : 'Some environment variables are missing. Check .env.local',
    checks: {
      '1. Clerk': {
        publishableKey: checks.clerkPublishable ? '✅' : '❌',
        secretKey: checks.clerkSecret ? '✅' : '❌',
      },
      '2. Supabase': {
        url: checks.supabaseUrl ? '✅' : '❌',
        serviceKey: checks.supabaseKey ? '✅' : '❌',
        bucket: `✅ ${checks.supabaseBucket}`,
      },
      '3. Neon Database': {
        connectionString: checks.databaseUrl ? '✅' : '❌',
      },
    },
    nextSteps: allGood 
      ? [
          '1. Go to /dashboard',
          '2. Click "Upload PDF"',
          '3. Select a PDF file',
          '4. Click "Upload & Analyze"',
          '5. Check browser console for logs',
        ]
      : [
          '1. Open .env.local file',
          '2. Replace placeholder values with real keys',
          '3. Restart dev server (npm run dev)',
          '4. Visit this URL again to verify',
        ],
  });
}
