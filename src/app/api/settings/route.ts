import { NextRequest, NextResponse } from 'next/server';
import { getGlobalCreds, setGlobalCreds } from '@/lib/globalCreds';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const entry = await getGlobalCreds();
    const blocklist = (entry?.blocklistTags || '').trim();
    const imageType = (entry?.imageType === 'sample' ? 'sample' : 'preview') as 'preview' | 'sample';
    const postsPerPage = typeof entry?.postsPerPage === 'number' && entry.postsPerPage > 0 ? Math.floor(entry.postsPerPage) : 100;
    return NextResponse.json({ blocklist, imageType, postsPerPage });
  } catch {
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const partial: any = {};

    if (body.blocklist !== undefined) {
      let blocklist = String(body.blocklist ?? '');
      blocklist = blocklist.replace(/\s+/g, ' ').trim();
      partial.blocklistTags = blocklist;
    }

    if (body.imageType !== undefined) {
      const it = String(body.imageType);
      if (it === 'preview' || it === 'sample') {
        partial.imageType = it;
      }
    }

    if (body.postsPerPage !== undefined) {
      let n = Number(body.postsPerPage);
      if (!Number.isFinite(n)) n = 100;
      n = Math.max(1, Math.floor(n));
      partial.postsPerPage = n;
    }

    if (Object.keys(partial).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid settings provided' }, { status: 400 });
    }

    await setGlobalCreds(partial);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    await setGlobalCreds({ blocklistTags: '' });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear settings' }, { status: 500 });
  }
}
