/**
 * POST /api/keeper/trigger
 * Server-side proxy → AI engine POST /keeper/trigger
 * 
 * SECURITY:
 * - Requires authentication via x-admin-secret header or admin session
 * - Rate limited to prevent abuse
 * - Full audit logging of all trigger attempts
 */
import { NextRequest, NextResponse } from 'next/server';

const AI_URL = process.env.AI_ENGINE_URL ?? '';
const ADMIN_SECRET = process.env.KEEPER_TRIGGER_SECRET;

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting (in-memory, for production use Redis)
// ─────────────────────────────────────────────────────────────────────────────

interface TriggerLogEntry {
  timestamp: number;
  ip: string;
  success: boolean;
}

const triggerLog: TriggerLogEntry[] = [];
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_TRIGGERS = 3;

/**
 * Clean old entries from trigger log
 */
function cleanOldEntries(): void {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (triggerLog.length > 0 && triggerLog[0].timestamp < cutoff) {
    triggerLog.shift();
  }
}

/**
 * Check if IP is rate limited
 */
function isRateLimited(ip: string): { limited: boolean; remaining: number } {
  cleanOldEntries();
  
  const now = Date.now();
  const recentTriggers = triggerLog.filter(
    entry => entry.ip === ip && now - entry.timestamp < RATE_LIMIT_WINDOW_MS
  );
  
  return {
    limited: recentTriggers.length >= RATE_LIMIT_MAX_TRIGGERS,
    remaining: Math.max(0, RATE_LIMIT_MAX_TRIGGERS - recentTriggers.length),
  };
}

/**
 * Log a trigger attempt
 */
function logTriggerAttempt(ip: string, success: boolean): void {
  triggerLog.push({
    timestamp: Date.now(),
    ip,
    success,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate admin secret from request
 */
function validateAuth(req: NextRequest): { valid: boolean; method: string } {
  // No secret configured - deny all access
  if (!ADMIN_SECRET) {
    console.warn('[KEEPER] KEEPER_TRIGGER_SECRET not configured - all requests denied');
    return { valid: false, method: 'none' };
  }
  
  // Check header: x-admin-secret
  const headerSecret = req.headers.get('x-admin-secret');
  if (headerSecret && secureCompare(headerSecret, ADMIN_SECRET)) {
    return { valid: true, method: 'header' };
  }
  
  // Check cookie: admin_session (for web UI)
  const cookieSession = req.cookies.get('admin_session')?.value;
  if (cookieSession) {
    // Cookie should contain: timestamp:hash(timestamp:secret)
    // For simplicity, we check if it matches the secret directly
    // In production, use proper session management
    try {
      const decoded = Buffer.from(cookieSession, 'base64').toString('utf-8');
      if (decoded.includes(ADMIN_SECRET)) {
        return { valid: true, method: 'cookie' };
      }
    } catch {
      // Invalid cookie format
    }
  }
  
  return { valid: false, method: 'none' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  // Get client IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor?.split(',')[0]?.trim() ?? 'unknown';
  
  // ─── Check AI Engine URL ──────────────────────────────────────────────────
  
  if (!AI_URL) {
    console.error('[KEEPER] AI_ENGINE_URL not configured');
    return NextResponse.json(
      { error: 'AI_ENGINE_URL not configured' },
      { status: 503 }
    );
  }
  
  // ─── Authentication Check ─────────────────────────────────────────────────
  
  const auth = validateAuth(req);
  
  if (!auth.valid) {
    // Log unauthorized attempt
    console.warn('[KEEPER] Unauthorized trigger attempt', {
      ip: clientIp,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent')?.slice(0, 100),
    });
    
    return NextResponse.json(
      { 
        error: 'Unauthorized',
        message: 'Valid x-admin-secret header or admin_session cookie required',
      },
      { status: 401 }
    );
  }
  
  // ─── Rate Limiting Check ──────────────────────────────────────────────────
  
  const rateLimit = isRateLimited(clientIp);
  
  if (rateLimit.limited) {
    console.warn('[KEEPER] Rate limit exceeded', {
      ip: clientIp,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        message: `Maximum ${RATE_LIMIT_MAX_TRIGGERS} triggers per minute. Try again later.`,
        retryAfter: 60,
      },
      { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_TRIGGERS),
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }
  
  // ─── Execute Keeper Trigger ───────────────────────────────────────────────
  
  try {
    const response = await fetch(`${AI_URL}/keeper/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    // Log successful trigger
    logTriggerAttempt(clientIp, response.ok);
    
    console.log('[KEEPER] Manual trigger executed', {
      ip: clientIp,
      authMethod: auth.method,
      status: response.status,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
    
    // Return response with rate limit headers
    const newRateLimit = isRateLimited(clientIp);
    
    return NextResponse.json(data, {
      status: response.ok ? 200 : response.status,
      headers: {
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX_TRIGGERS),
        'X-RateLimit-Remaining': String(newRateLimit.remaining),
        'X-Response-Time': `${duration}ms`,
      }
    });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    
    // Log failed trigger
    logTriggerAttempt(clientIp, false);
    
    console.error('[KEEPER] Trigger failed', {
      ip: clientIp,
      error: err instanceof Error ? err.message : 'Unknown error',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { 
        error: 'AI engine unreachable',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 502 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET endpoint for status
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor?.split(',')[0]?.trim() ?? 'unknown';
  
  // Auth check for status endpoint too
  const auth = validateAuth(req);
  
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const rateLimit = isRateLimited(clientIp);
  
  return NextResponse.json({
    status: 'operational',
    rateLimit: {
      limit: RATE_LIMIT_MAX_TRIGGERS,
      remaining: rateLimit.remaining,
      windowMs: RATE_LIMIT_WINDOW_MS,
    },
    aiEngineUrl: AI_URL ? 'configured' : 'not configured',
    authRequired: !!ADMIN_SECRET,
  });
}
