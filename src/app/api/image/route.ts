import { NextRequest, NextResponse } from 'next/server';
import { Agent } from 'undici';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Basic in-memory rate limit per IP
const WINDOW_MS = 60_000;
const LIMIT = 300; // images per minute per IP
const rateMap = new Map<string, { count: number; ts: number }>();
function takeToken(key: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now - entry.ts > WINDOW_MS) {
    rateMap.set(key, { count: 1, ts: now });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(':')) return true;
  return false;
}
function isAllowedHost(host: string): boolean {
  const lowered = host.toLowerCase();
  if (lowered === 'localhost' || lowered.endsWith('.local')) return false;
  if (isIpLiteral(lowered)) return false;
  const allow = ['yande.re','konachan.com','e621.net','rule34.xxx','gelbooru.com'];
  return allow.some((d) => lowered === d || lowered.endsWith('.' + d));
}

// Create a custom agent with longer timeouts
const agent = new Agent({
  connectTimeout: 60000, // 60 seconds connection timeout
  bodyTimeout: 60000,    // 60 seconds body timeout
  headersTimeout: 60000, // 60 seconds headers timeout
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Rate limit
  const key = request.headers.get('x-forwarded-for') || 'global';
  if (!takeToken(key)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    // Validate URL
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (validatedUrl.protocol !== 'https:' && validatedUrl.protocol !== 'http:') {
      return NextResponse.json({ error: 'Protocol not allowed' }, { status: 403 });
    }
    if (!isAllowedHost(validatedUrl.hostname)) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
    }

    // Forward Range and conditional headers for seeking/caching
    const range = request.headers.get('range') || undefined;
    const ifModifiedSince = request.headers.get('if-modified-since') || undefined;
    const ifNoneMatch = request.headers.get('if-none-match') || undefined;

    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': validatedUrl.origin,
    };
    // Inject Authorization for e621 if present (server-side store)
    if ((/^(.+\.)?e621\.net$/i).test(validatedUrl.hostname)) {
      const { getGlobalCreds } = await import('@/lib/globalCreds');
      const creds = await getGlobalCreds();
      const login = creds.e621Login || '';
      const apiKey = creds.e621ApiKey || '';
      if (login && apiKey) {
        const b64 = Buffer.from(`${login}:${apiKey}`).toString('base64');
        (upstreamHeaders as any)['Authorization'] = `Basic ${b64}`;
      }
    }
    if (range) upstreamHeaders['Range'] = range;
    if (ifModifiedSince) upstreamHeaders['If-Modified-Since'] = ifModifiedSince;
    if (ifNoneMatch) upstreamHeaders['If-None-Match'] = ifNoneMatch;

    const response = await fetch(url, {
      headers: upstreamHeaders,
      // @ts-ignore - undici dispatcher option
      dispatcher: agent,
      // @ts-ignore - Next.js specific fetch options
      next: {
        revalidate: 3600, // Cache for 1 hour
      },
    });

    // Explicitly handle 304 Not Modified with an empty body
    if (response.status === 304) {
      const headers = new Headers(response.headers);
      // 304 responses must not include a message body; also strip hop-by-hop and body-related headers
      headers.delete('content-type');
      headers.delete('content-length');
      headers.delete('transfer-encoding');
      headers.delete('connection');
      headers.delete('keep-alive');
      headers.delete('proxy-authenticate');
      headers.delete('proxy-authorization');
      headers.delete('te');
      headers.delete('trailers');
      headers.delete('upgrade');
      return new NextResponse(null, { status: 304, headers });
    }

    if (!response.ok) {
      // Pass through upstream error status (non-2xx, non-304)
      return NextResponse.json(
        { error: `Failed to fetch media: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Prepare headers for downstream response
    const headers = new Headers(response.headers);

    // Ensure Content-Type exists; infer if missing
    if (!headers.get('content-type')) {
      const pathname = validatedUrl.pathname.toLowerCase();
      if (pathname.endsWith('.webm')) headers.set('content-type', 'video/webm');
      else if (pathname.endsWith('.mp4') || pathname.endsWith('.m4v')) headers.set('content-type', 'video/mp4');
      else if (pathname.endsWith('.mov')) headers.set('content-type', 'video/quicktime');
      else if (pathname.endsWith('.png')) headers.set('content-type', 'image/png');
      else if (pathname.endsWith('.gif')) headers.set('content-type', 'image/gif');
      else if (pathname.endsWith('.webp')) headers.set('content-type', 'image/webp');
      else headers.set('content-type', 'image/jpeg');
    }

    // Set caching downstream regardless of upstream (tweak as needed)
    headers.set('Cache-Control', 'public, max-age=86400');

    // Remove hop-by-hop headers if present
    headers.delete('transfer-encoding');
    headers.delete('connection');
    headers.delete('keep-alive');
    headers.delete('proxy-authenticate');
    headers.delete('proxy-authorization');
    headers.delete('te');
    headers.delete('trailers');
    headers.delete('upgrade');

    // Stream the upstream body to the client; preserve status (e.g., 206 for ranges)
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error: any) {
    console.error('Image proxy error:', error);
    
    // Handle connection errors
    if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return NextResponse.json(
        { error: 'Connection timeout - could not reach the server' },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch image' },
      { status: 500 }
    );
  }
}