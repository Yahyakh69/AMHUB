import { NextResponse } from 'next/server';

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceSn = searchParams.get('deviceSn');
  const projectUuid = searchParams.get('projectUuid') || process.env.DJI_PROJECT_UUID || '';
  const baseUrl = (process.env.DJI_BASE_URL || 'https://es-flight-api-us.djigate.com').replace(/\/$/, '');
  const userToken = process.env.DJI_USER_TOKEN || '';

  if (!deviceSn) {
    return NextResponse.json({ error: 'Missing device SN.' }, { status: 400 });
  }

  if (!userToken) {
    return NextResponse.json({ error: 'Server is missing DJI_USER_TOKEN.' }, { status: 500 });
  }

  const url = `${baseUrl}/manage/api/v1.0/devices/${encodeURIComponent(deviceSn)}/osd`;

  const upstream = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Token': userToken,
      'x-project-uuid': projectUuid
    },
    cache: 'no-store'
  });

  const data = await parseJson(upstream);
  if (!upstream.ok) {
    return NextResponse.json(data || { error: upstream.statusText }, { status: upstream.status });
  }

  return NextResponse.json(data ?? { ok: true });
}
