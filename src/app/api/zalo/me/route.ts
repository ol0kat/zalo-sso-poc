import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ProxyAgent } from 'undici';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

// Free Vietnam proxies — rotate through them if one fails
const VN_PROXIES = [
  'http://123.30.154.171:7777',
  'http://14.229.156.117:8080',
  'http://171.229.223.92:10007',
  'http://117.0.193.252:10010',
  'http://1.54.180.239:10005',
  'http://42.116.166.55:10010',
];

async function fetchViaProxy(url: string, headers: Record<string, string>) {
  for (const proxy of VN_PROXIES) {
    try {
      const agent = new ProxyAgent(proxy);
      const response = await fetch(url, {
        headers,
        // @ts-expect-error undici dispatcher works with Node fetch
        dispatcher: agent,
        signal: AbortSignal.timeout(10000),
      });
      const text = await response.text();
      agent.close();
      return text;
    } catch {
      // Try next proxy
      continue;
    }
  }
  throw new Error('All Vietnam proxies failed');
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 401 }
      );
    }

    const secretKey = process.env.ZALO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const appsecretProof = crypto
      .createHmac('sha256', secretKey)
      .update(accessToken)
      .digest('hex');

    const profileText = await fetchViaProxy(
      'https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture',
      {
        'access_token': accessToken,
        'appsecret_proof': appsecretProof,
      }
    );

    let profile;
    try {
      profile = JSON.parse(profileText);
    } catch {
      return NextResponse.json(
        { error: `Zalo returned non-JSON: ${profileText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    if (profile.error) {
      return NextResponse.json(
        { error: `Zalo error ${profile.error}: ${profile.message || JSON.stringify(profile)}` },
        { status: 400 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
