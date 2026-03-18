/**
 * Simple in-memory rate limiter for API routes
 * Note: In production, consider using Redis for distributed rate limiting
 */

import { createHash } from 'crypto';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
}

// In-memory store for rate limiting (resets on server restart)
// In production, consider using Redis with @upstash/ratelimit
const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic cleanup of expired rate limit entries
 * Should be called once at application startup
 */
export function startRateLimitCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) return; // Already running
  cleanupInterval = setInterval(cleanupRateLimitStore, intervalMs);
}

/**
 * Stop periodic cleanup (for testing or shutdown)
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Rate limiter middleware factory
 * @param config - Rate limit configuration
 * @returns Middleware function for rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests } = config;

  return (identifier: string): { success: boolean; remaining: number; resetTime: number } => {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);

    // If no entry exists or the window has expired, create a new entry
    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return {
        success: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs
      };
    }

    // Check if the request count exceeds the limit
    if (entry.count >= maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    // Increment the request count
    entry.count++;
    rateLimitStore.set(identifier, entry);

    return {
      success: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  };
}

/**
 * Get client identifier from request
 * Uses IP address and API key (if available) for more accurate rate limiting
 * Note: API key is hashed to avoid storing sensitive data in memory
 */
export function getClientIdentifier(request: Headers): string {
  // Try to get API key for more specific rate limiting
  const authHeader = request.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Hash the API key to avoid exposure in memory
    const token = authHeader.split(' ')[1];
    const hash = createHash('sha256').update(token).digest('hex');
    return `api:${hash.substring(0, 16)}`;
  }

  // Fall back to IP-based rate limiting
  const forwarded = request.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

/**
 * Clean up expired rate limit entries
 * Should be called periodically to prevent memory leaks
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Default rate limiter configuration for transaction submission
// 10 requests per minute - reasonable for transaction submission
export const transactionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10
});
