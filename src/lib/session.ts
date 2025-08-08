import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'sid';

function makeCookieOptions() {
  return {
    httpOnly: true as const,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

export function getSessionIdFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value || null;
}

export function getOrCreateSession(req: NextRequest, res: NextResponse): string {
  const existing = getSessionIdFromRequest(req);
  if (existing) return existing;
  const sid = crypto.randomBytes(16).toString('hex');
  res.cookies.set(COOKIE_NAME, sid, makeCookieOptions());
  return sid;
}

export function ensureSessionCookieOnResponse(res: NextResponse, sid: string) {
  // Overwrite cookie on response to extend maxAge
  res.cookies.set(COOKIE_NAME, sid, makeCookieOptions());
}
