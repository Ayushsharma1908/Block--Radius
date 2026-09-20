# Deployment Guide: BlastRadius on Vercel & Render

This guide explains how to deploy **BlastRadius**:
- **Frontend (Vite + React SPA)** on **Vercel**
- **Backend (Express + tRPC + Neo4j + Gemini)** on **Render**

---

## Architecture Overview

```
[User Browser]
      │
      ├── (Page requests, assets, routing) ───────> [ Vercel ]
      │                                            Frontend SPA
      │
      └── (tRPC API requests: /api/trpc) ─────────> [ Render ]
                                                   Backend Web Service
                                                         │
                                           ┌─────────────┴─────────────┐
                                           ▼                           ▼
                                      [ Neo4j ]                   [ Gemini ]
                                    (Graph DB)                    (Google AI)
```

---

## Step 1: Deploy Backend to Render

### Option A: 1-Click with Blueprint (Recommended)
1. Push your repository to GitHub.
2. Go to your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect [`render.yaml`](./render.yaml).
6. Fill in the required environment variables:
   - `NEO4J_URI`: Your Neo4j connection URI (e.g. `neo4j+s://xxxx.databases.neo4j.io`)
   - `NEO4J_USER`: Your Neo4j username
   - `NEO4J_PASSWORD`: Your Neo4j password
   - `GEMINI_API_KEY`: Your Gemini API key from Google AI Studio
   - `CLIENT_URL`: Your Vercel domain (e.g. `https://blastradius.vercel.app` - you can fill this in after deploying Vercel)
7. Click **Apply**.

### Option B: Manual Web Service Setup
1. On [Render Dashboard](https://dashboard.render.com/), click **New +** → **Web Service**.
2. Select your repository.
3. Configure the settings:
   - **Name**: `blastradius-backend`
   - **Region**: Nearest to your users or database
   - **Branch**: `main`
   - **Root Directory**: (Leave blank)
   - **Runtime**: `Node`
   - **Build Command**: `pnpm install && pnpm run build:server`
   - **Start Command**: `pnpm run start:server`
   - **Plan**: Free (or Starter)
4. Under **Advanced** → **Health Check Path**, enter: `/health`
5. In **Environment Variables**, add:
   ```
   NODE_ENV=production
   PORT=10000
   NEO4J_URI=neo4j+s://<your-instance>.databases.neo4j.io
   NEO4J_USER=<your-user>
   NEO4J_PASSWORD=<your-password>
   GEMINI_API_KEY=<your-gemini-key>
   CLIENT_URL=https://<your-app>.vercel.app
   ```
6. Click **Deploy Web Service**.
7. Once deployed, copy your Render service URL (e.g. `https://blastradius-backend.onrender.com`).
   - Test it by visiting `https://blastradius-backend.onrender.com/health` in your browser. It should return `{"status":"ok",...}`.

---

## Step 2: Deploy Frontend to Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository.
4. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `pnpm run build:client` (or toggle override if needed; [`vercel.json`](./vercel.json) specifies this automatically)
   - **Output Directory**: `dist/public`
5. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://<your-render-backend-url>.onrender.com` *(Do not include a trailing slash)*
6. Click **Deploy**.
7. Once deployment finishes, Vercel gives you your production URL (e.g. `https://blastradius.vercel.app`).

---

## Step 3: Connect the Two

1. Return to your **Render** dashboard for `blastradius-backend`.
2. Go to **Environment** settings.
3. Update `CLIENT_URL` with your final Vercel URL:
   ```
   CLIENT_URL=https://blastradius.vercel.app
   ```
4. Click **Save Changes** (Render will automatically re-deploy with updated CORS headers).

---

## Features Configured

- **CORS Handling**: Native Express middleware automatically permits requests from `localhost`, `*.vercel.app`, and your custom `CLIENT_URL`.
- **SPA Routing**: [`vercel.json`](./vercel.json) rewrites all client paths (`/`, `/app`, `/some-route`) to `/index.html` so refreshing or direct navigation never triggers 404s.
- **Render Health Check**: `/health` endpoint configured to prevent deployment timeouts and maintain uptime tracking.
- **Graceful Backend API Mode**: If the backend is accessed directly at `/`, it returns an informative JSON status message instead of erroring on missing static HTML files.
- **Reverse Proxy Header Support**: Express is configured with `app.set("trust proxy", 1)` for accurate HTTPS protocol and IP identification behind Vercel/Render proxies.
