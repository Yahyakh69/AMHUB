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
  const projectUuid = searchParams.get('projectUuid') || process.env.DJI_PROJECT_UUID || '';
  const baseUrl = (process.env.DJI_BASE_URL || 'https://es-flight-api-us.djigate.com').replace(/\/$/, '');
  const headerToken = request.headers.get('x-user-token') || '';
  const userToken = process.env.DJI_USER_TOKEN || headerToken;
  const orgKey = process.env.DJI_ORG_KEY || '';

  if (!projectUuid) {
    return NextResponse.json({ error: 'Missing project UUID.' }, { status: 400 });
  }

  if (!userToken && !orgKey) {
    return NextResponse.json({ error: 'Server is missing DJI_USER_TOKEN or DJI_ORG_KEY.' }, { status: 500 });
  }

  const url = `${baseUrl}/manage/api/v1.0/projects/${encodeURIComponent(projectUuid)}/topologies`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (orgKey) {
    headers['X-Organization-Key'] = orgKey;
  } else if (userToken) {
    headers['X-User-Token'] = userToken;
    headers['x-project-uuid'] = projectUuid;
  }

  const upstream = await fetch(url, {
    headers,
    cache: 'no-store'
  });

  const data = await parseJson(upstream);
  if (!upstream.ok) {
    return NextResponse.json(data || { error: upstream.statusText }, { status: upstream.status });
  }

  return NextResponse.json(data ?? { ok: true });
}
