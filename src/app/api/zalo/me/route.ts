import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

    const profile = await profileResponse.json();

    if (profile.error) {
      console.error('Profile fetch error:', profile);
      return NextResponse.json(
        { error: profile.error.message || 'Failed to fetch profile' },
        { status: 400 }
      );
    }

    // Return the entire Zalo response as-is
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
