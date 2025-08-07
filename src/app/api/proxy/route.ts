import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 seconds timeout (less than maxDuration)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'uwuviewer/1.0 (by anonymous, https://github.com/uwuviewer)','Accept': 'application/json',
      },
      signal: controller.signal,
      // @ts-ignore - Next.js specific fetch options
      next: {
        revalidate: 300, // Cache for 5 minutes
      },
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
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    
    // Handle timeout errors
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - server took too long to respond' },
        { status: 504 }
      );
    }
    
    // Handle connection errors
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