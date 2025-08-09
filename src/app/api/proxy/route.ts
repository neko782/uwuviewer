import { NextRequest, NextResponse } from 'next/server';
import { getGlobalCreds } from '@/lib/globalCreds';
import { Agent } from 'undici';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Create a custom undici Agent with 60s timeouts (consistent with image proxy)
const agent = new Agent({
  connectTimeout: 60_000,
  bodyTimeout: 60_000,
  headersTimeout: 60_000,
});

// Basic in-memory rate limit per IP
const WINDOW_MS = 60_000; // 1 minute
const LIMIT = 120; // requests per window
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
  // IPv4
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6
  if (host.includes(':')) return true;
  return false;
}

function isAllowedHost(host: string): boolean {
  const lowered = host.toLowerCase();
  // Block local/loopback
  if (lowered === 'localhost' || lowered.endsWith('.local')) return false;
  if (isIpLiteral(lowered)) return false;
  const allow = [
    'yande.re',
    'konachan.com',
    'e621.net',
    'rule34.xxx',
    'gelbooru.com',
  ];
  return allow.some((d) => lowered === d || lowered.endsWith('.' + d));
}

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
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ error: 'Protocol not allowed' }, { status: 403 });
    }
    if (!isAllowedHost(parsed.hostname)) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
    }

    // Prepare headers and potential URL mutation
    const headers: Record<string, string> = {
      'User-Agent': 'uwuviewer/1.0 (by neko782, https://github.com/neko782/uwuviewer/)',
      'Accept': 'application/json',
    };

    const isGelbooru = /(^|\.)gelbooru\.com$/i.test(parsed.hostname);
    const isE621 = /(^|\.)e621\.net$/i.test(parsed.hostname);

    // Inject secrets from the global server-side store
    const creds = await getGlobalCreds();

    if (isGelbooru) {
      headers['fringeBenefits'] = 'yup';
      const g = creds?.gelbooruApiFragment || '';
      if (g) {
        // Append only if not already present, using URLSearchParams for safety
        const params = new URLSearchParams((g.startsWith('&') ? g.slice(1) : g));
        const keys = Array.from(params.keys());
        let mutated = false;
        for (const k of keys) {
          if (!parsed.searchParams.has(k)) {
            parsed.searchParams.set(k, params.get(k) || '');
            mutated = true;
          }
        }
        if (mutated) {
          parsed.search = '?' + parsed.searchParams.toString();
        }
      }
    }

    if (isE621) {
      const login = creds?.e621Login || '';
      const apiKey = creds?.e621ApiKey || '';
      if (login && apiKey) {
        const b64 = Buffer.from(`${login}:${apiKey}`).toString('base64');
        headers['Authorization'] = `Basic ${b64}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(parsed.toString(), {
      headers,
      signal: controller.signal,
      next: { revalidate: 300 },
      // @ts-ignore - undici dispatcher option
      dispatcher: agent,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - server took too long to respond' },
        { status: 504 }
      );
    }
    if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return NextResponse.json(
        { error: 'Connection timeout - could not reach the server' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
