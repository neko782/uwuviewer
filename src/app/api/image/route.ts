import { NextRequest, NextResponse } from 'next/server';
import { Agent } from 'undici';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  try {
    // Validate URL
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': validatedUrl.origin,
      },
      // @ts-ignore - undici dispatcher option
      dispatcher: agent,
      // @ts-ignore - Next.js specific fetch options
      next: {
        revalidate: 3600, // Cache for 1 hour
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.statusText}` },
        { status: response.status }
      );
    }

    let contentType = response.headers.get('content-type') || '';

    // Infer content type from URL extension if missing
    if (!contentType) {
      const pathname = validatedUrl.pathname.toLowerCase();
      if (pathname.endsWith('.webm')) contentType = 'video/webm';
      else if (pathname.endsWith('.mp4') || pathname.endsWith('.m4v')) contentType = 'video/mp4';
      else if (pathname.endsWith('.mov')) contentType = 'video/quicktime';
      else if (pathname.endsWith('.png')) contentType = 'image/png';
      else if (pathname.endsWith('.gif')) contentType = 'image/gif';
      else if (pathname.endsWith('.webp')) contentType = 'image/webp';
      else contentType = 'image/jpeg';
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
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