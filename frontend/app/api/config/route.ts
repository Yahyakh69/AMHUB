import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    mapbox_public_token: process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN || '',
    app_settings: {
      projectUuid: process.env.NEXT_PUBLIC_PROJECT_UUID || process.env.DJI_PROJECT_UUID || '',
      workflowUuid: process.env.NEXT_PUBLIC_WORKFLOW_UUID || '',
      creatorId: process.env.NEXT_PUBLIC_CREATOR_ID || ''
    },
    live_http_base: process.env.NEXT_PUBLIC_LIVE_HTTP_BASE || '',
    live_ws_url: process.env.NEXT_PUBLIC_LIVE_WS_URL || ''
  });
}
