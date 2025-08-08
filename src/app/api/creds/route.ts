import { NextRequest, NextResponse } from 'next/server';
import { getGlobalCreds, setGlobalCreds, clearGlobalCreds } from '@/lib/globalCreds';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const toStore: any = {};
    if (typeof body.gelbooruApi === 'string') toStore.gelbooruApiFragment = body.gelbooruApi;
    if (typeof body.e621Login === 'string') toStore.e621Login = body.e621Login;
    if (typeof body.e621ApiKey === 'string') toStore.e621ApiKey = body.e621ApiKey;

    if (Object.keys(toStore).length) {
      await setGlobalCreds(toStore);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  const creds = await getGlobalCreds();
  const gelbooru = !!creds.gelbooruApiFragment;
  const e621 = !!(creds.e621Login && creds.e621ApiKey);
  return NextResponse.json({ gelbooru, e621 });
}

export async function DELETE() {
  await clearGlobalCreds();
  return NextResponse.json({ ok: true });
}
