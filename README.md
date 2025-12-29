<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1kuKHXFmROMIG9W_Bl4NjEJ2JqOVjEVDj

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) If you wire Gemini later, set `GEMINI_API_KEY` in `.env.local`
3. Run the app:
   `npm run dev`

## Standalone (Build + Run Backend)

Single command for local or deployment-style run:
`npm run build && python Run.py`

## Google AI Studio App Data

Set these keys in AI Studio App Data (or environment variables) so the deployed app can load config at runtime:

- `DJI_API_URL` (defaults to `https://es-flight-api-us.djigate.com/openapi/v0.1/workflow`)
- `DJI_USER_TOKEN` (X-User-Token for workflow calls)
- `DJI_PROJECT_UUID`
- `DJI_WORKFLOW_UUID`
- `DJI_CREATOR_ID`
- `MAPBOX_PUBLIC_TOKEN`
- `DJI_BASE_URL` (optional, for live telemetry backend)
- `DJI_ORG_KEY` (optional, for live telemetry backend)
