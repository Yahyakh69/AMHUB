<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your FlightHub console

This is now a Next.js (App Router) app designed for Vercel deployments with server-side route handlers.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. (Recommended) Create `.env.local` with the server-side credentials:
   - `DJI_WORKFLOW_URL`
   - `DJI_USER_TOKEN` or `DJI_ORG_KEY`
   - `DJI_PROJECT_UUID` (optional default)
   - `DJI_BASE_URL` (optional, defaults to `https://es-flight-api-us.djigate.com`)
   - `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN` (optional)
3. Run the app:
   `npm run dev`
