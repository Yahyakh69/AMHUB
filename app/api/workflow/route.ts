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

export async function POST(request: Request) {
  let body: { projectUuid?: string; payload?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const payload = body?.payload;
  const projectUuid = body?.projectUuid || process.env.DJI_PROJECT_UUID || '';
  const workflowUrl = process.env.DJI_WORKFLOW_URL || '';
  const userToken = process.env.DJI_USER_TOKEN || '';

  if (!payload) {
    return NextResponse.json({ error: 'Missing workflow payload.' }, { status: 400 });
  }

  if (!workflowUrl || !userToken) {
    return NextResponse.json(
      { error: 'Server is missing DJI_WORKFLOW_URL or DJI_USER_TOKEN.' },
      { status: 500 }
    );
  }

  const upstream = await fetch(workflowUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Token': userToken,
      'x-project-uuid': projectUuid
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  const data = await parseJson(upstream);
  if (!upstream.ok) {
    return NextResponse.json(data || { error: upstream.statusText }, { status: upstream.status });
  }

  return NextResponse.json(data ?? { ok: true });
}
