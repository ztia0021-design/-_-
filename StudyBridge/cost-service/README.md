# StudyBridge Cost Service

Independent Task 12 service, outside the A2 repository.

## Run locally

```sh
npm install
npm start
```

Default URL: http://localhost:8084. Cloud Run supplies PORT automatically.

## Deploy from source

Run from this folder after signing in to Google Cloud and selecting your project:

```sh
gcloud run deploy studybridge-cost --source . --allow-unauthenticated --project YOUR_PROJECT_ID --region YOUR_REGION
```

Replace both placeholders with your project and region. No Dockerfile is needed.
Set `costServiceUrl` in both A3 environment files to the returned Cloud Run URL
(without a trailing slash). Add the deployed URL to the routing table PDF.

## Request

`POST /calculate-cost` with JSON `{ "agreedRate": 50, "durationMinutes": 90 }`
returns `{ "subtotal": 75, "platformFee": 7.5, "total": 82.5 }`.
The route is stateless and uses no database. CORS allows the Angular browser client.
