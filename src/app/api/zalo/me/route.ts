import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Run this function in Singapore (closest to Vietnam)
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

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

    // Generate appsecret_proof: HMAC-SHA256 of access_token using secret_key
    const appsecretProof = crypto
      .createHmac('sha256', secretKey)
      .update(accessToken)
      .digest('hex');

    // Fetch user profile from Zalo Graph API — request all available fields
    const profileResponse = await fetch(
      'https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture',
      {
        headers: {
          'access_token': accessToken,
          'appsecret_proof': appsecretProof,
        },
      }
    );

    const profileText = await profileResponse.text();
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
