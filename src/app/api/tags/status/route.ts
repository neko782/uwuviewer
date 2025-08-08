import { NextRequest, NextResponse } from 'next/server';
import { tagCacheManager } from '@/lib/tagCache';

export async function GET(request: NextRequest) {
  try {
    const site = request.nextUrl.searchParams.get('site');
    if (!site || (site !== 'yande.re' && site !== 'konachan.com' && site !== 'rule34.xxx' && site !== 'e621.net')) {
      return NextResponse.json({ error: 'Invalid or unsupported site' }, { status: 400 });
    }

    const wantsStream = (request.headers.get('accept') || '').includes('text/event-stream') || request.nextUrl.searchParams.get('stream') === '1';

    if (!wantsStream) {
      const stats = await tagCacheManager.getCacheStats(site);
      const downloadedBytes = tagCacheManager.getDownloadedBytes(site);
      return NextResponse.json({ ...stats, downloadedBytes });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, data: any) => {
          const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        // Send initial status snapshot
        tagCacheManager.getCacheStats(site).then(stats => {
          const downloadedBytes = tagCacheManager.getDownloadedBytes(site);
          send('status', { ...stats, downloadedBytes });
        }).catch(() => {});

        // Subscribe to live progress
        const unsubscribe = tagCacheManager.subscribeProgress(site, (ev) => {
          send('progress', { site: ev.site, downloadedBytes: ev.bytes, inProgress: ev.inProgress, phase: ev.phase });
        });

        // Keep-alive pings
        const pingId = setInterval(() => {
          try { controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`)); } catch {}
        }, 15000);

        // Cleanup on cancel/close
        (controller as any)._cleanup = () => {
          try { clearInterval(pingId); } catch {}
          try { unsubscribe(); } catch {}
        };
      },
      cancel() {
        const anyThis: any = this as any;
        try { anyThis._cleanup?.(); } catch {}
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (e) {
    console.error('status tags failed', e);
    return NextResponse.json({ error: 'Failed to get tag status' }, { status: 500 });
  }
}
