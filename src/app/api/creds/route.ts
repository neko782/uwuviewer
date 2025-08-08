import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
    // 30 days
    maxAge: 30 * 24 * 60 * 60,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = NextResponse.json({ ok: true });

    if (typeof body.gelbooruApi === 'string') {
      // Store raw query fragment e.g. &api_key=xxx&user_id=yyy
      res.cookies.set('gelbooru_api', body.gelbooruApi, cookieOptions());
    }
    if (typeof body.e621Login === 'string') {
      res.cookies.set('e621_login', body.e621Login, cookieOptions());
    }
    if (typeof body.e621ApiKey === 'string') {
      res.cookies.set('e621_api_key', body.e621ApiKey, cookieOptions());
    }

    return res;
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  // Return credential presence flags without exposing secrets
  const gelVal = request.cookies.get('gelbooru_api')?.value || '';
  const gel = !!gelVal;
  let gelUserId: string | undefined;
  if (gelVal) {
    try {
      const params = new URLSearchParams(gelVal.startsWith('&') ? gelVal.slice(1) : gelVal);
      const uid = params.get('user_id') || '';
      if (uid) gelUserId = uid;
    } catch {}
  }
  const e621LoginVal = request.cookies.get('e621_login')?.value || '';
  const e621KeyVal = request.cookies.get('e621_api_key')?.value || '';
  const e621 = !!e621LoginVal && !!e621KeyVal;
  return NextResponse.json({ gelbooru: gel, gelbooruUserId: gelUserId, e621, e621Login: e621LoginVal || undefined });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('gelbooru_api');
  res.cookies.delete('e621_login');
  res.cookies.delete('e621_api_key');
  return res;
}
