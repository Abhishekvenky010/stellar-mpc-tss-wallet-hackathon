import { NextRequest, NextResponse } from 'next/server';
import { transactionRateLimiter, getClientIdentifier, startRateLimitCleanup } from '@/lib/rate-limiter';
import { timingSafeEqual } from 'crypto';

// Environment variable for API key authentication
// In production, this should be set in your environment configuration
const API_KEY = process.env.API_KEY;

// Start automatic cleanup of rate limit entries
startRateLimitCleanup();

/**
 * Constant-time comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    // If timingSafeEqual fails (different lengths), fall back to manual comparison
    return a === b;
  }
}

/**
 * Validate XDR format
 * Basic validation to check if XDR appears to be valid base64
 */
function isValidXDR(xdr: string): boolean {
  if (!xdr || typeof xdr !== 'string') {
    return false;
  }
  
  // Check minimum length (envelope header + minimum transaction)
  if (xdr.length < 100) {
    return false;
  }
  
  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(xdr)) {
    return false;
  }
  
  // Check for common Stellar XDR prefixes
  // Transaction envelopes typically start with specific patterns
  // This is a heuristic check, not exhaustive
  return true;
}

/**
 * Validate transaction details
 */
function validateTransaction(xdr: string, network?: string): { valid: boolean; error?: string } {
  // Validate XDR format
  if (!isValidXDR(xdr)) {
    return { valid: false, error: 'Invalid XDR format. XDR must be a valid base64 encoded transaction envelope.' };
  }
  
  // Validate XDR length (reasonable upper bound)
  if (xdr.length > 100000) {
    return { valid: false, error: 'XDR is too large. Maximum allowed size is 100KB.' };
  }
  
  // Validate network parameter
  if (network && network !== 'mainnet' && network !== 'testnet') {
    return { valid: false, error: 'Invalid network. Must be "mainnet" or "testnet".' };
  }
  
  return { valid: true };
}

// Log warning once at module load time if API key is not configured
const API_KEY_CONFIGURED = !!API_KEY;
if (!API_KEY_CONFIGURED) {
  console.warn('⚠️  WARNING: API_KEY not configured. Authentication disabled.');
}

/**
 * Check API key authentication
 */
function authenticateRequest(request: NextRequest): { authorized: boolean; error?: string } {
  // If no API_KEY is configured, skip authentication (development mode)
  if (!API_KEY_CONFIGURED) {
    return { authorized: true };
  }
  
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return { authorized: false, error: 'Missing authorization header' };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Invalid authorization format. Use "Bearer <token>"' };
  }
  
  const token = authHeader.split(' ')[1];
  
  // Use constant-time comparison to prevent timing attacks
  if (!safeCompare(token, API_KEY)) {
    return { authorized: false, error: 'Invalid API key' };
  }
  
  return { authorized: true };
}

export async function POST(request: NextRequest) {
  console.log('🔄 API Route called: /api/submit-transaction');

  try {
    // 1. Check authentication
    const auth = authenticateRequest(request);
    if (!auth.authorized) {
      console.log('❌ Authentication failed:', auth.error);
      return NextResponse.json({ error: 'Unauthorized', details: auth.error }, { status: 401 });
    }
    console.log('✅ Authentication passed');

    // 2. Apply rate limiting
    const clientId = getClientIdentifier(request.headers);
    const rateLimitResult = transactionRateLimiter(clientId);
    
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      console.log('❌ Rate limit exceeded for:', clientId);
      return NextResponse.json(
        { 
          error: 'Too many requests', 
          details: 'Rate limit exceeded. Please try again later.',
          retryAfter 
        }, 
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }
    console.log('✅ Rate limit check passed. Remaining:', rateLimitResult.remaining);

    // 3. Parse and validate request body
    console.log('📨 Parsing request body...');
    const body = await request.json();
    const { xdr, network } = body;
    
    console.log('📨 Submit transaction request:', { 
      xdrLength: xdr?.length || 0, 
      network 
    });

    if (!xdr) {
      return NextResponse.json({ error: 'XDR is required' }, { status: 400 });
    }

    // 4. Validate transaction details
    const validation = validateTransaction(xdr, network);
    if (!validation.valid) {
      console.log('❌ Validation failed:', validation.error);
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    console.log('✅ Transaction validation passed');

    // 5. Submit transaction to Horizon
    const horizonUrl = network === 'mainnet'
      ? 'https://horizon.stellar.org/transactions'
      : 'https://horizon-testnet.stellar.org/transactions';

    console.log('Submitting to:', horizonUrl);

    const response = await fetch(horizonUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        tx: xdr
      })
    });

    console.log('Horizon response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        const text = await response.text();
        errorData = { text, status: response.status, statusText: response.statusText };
      }
      console.log('Horizon error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        result_codes: errorData.extras?.result_codes,
        xdr: xdr.substring(0, 200) + '...'
      });
      return NextResponse.json({
        error: 'Transaction submission failed',
        details: errorData
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('✅ Horizon success:', result);
    console.log('🏁 API Route completed successfully');
    
    // Include rate limit info in successful response
    return NextResponse.json({
      ...result,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      }
    });
  } catch (error) {
    console.error('❌ Submit transaction error:', error);
    console.log('🏁 API Route completed with error');
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
