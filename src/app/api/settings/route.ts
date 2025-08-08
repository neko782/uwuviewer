import { NextRequest, NextResponse } from 'next/server';
import { getGlobalCreds, setGlobalCreds } from '@/lib/globalCreds';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const entry = await getGlobalCreds();
    const blocklist = (entry?.blocklistTags || '').trim();
    return NextResponse.json({ blocklist });
  } catch {
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let blocklist = String(body.blocklist ?? '');
    // normalize whitespace to single spaces
    blocklist = blocklist.replace(/\s+/g, ' ').trim();

    await setGlobalCreds({ blocklistTags: blocklist });
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
