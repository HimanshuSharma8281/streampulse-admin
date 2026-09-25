# 🎙️ StreamPulse Admin Studio (`streampulse-admin`)

The private administrator and broadcaster studio application for the StreamPulse live streaming platform.

---

## 🌟 Features

- **Screen & Audio Broadcasting**: Native `getDisplayMedia()` screen capture with system audio and optional microphone mixing.
- **Broadcast Controls**: Start/stop stream, stream title, description, category tags, and real-time metadata updates.
- **Live Stream Telemetry**: Current Viewers, Peak Viewers, Stream Duration Uptime Timer, Total Unique Viewers, and Chat Rate.
- **Live Chat Moderation**: Instant message deletion, user timeouts (60s), user bans, and full chat wipe.
- **Strict Server-Side Authentication**: Protected by `ADMIN_PASSWORD` (environment variable or salted PBKDF2 hash) with cryptographic session tokens.

---

## 🚀 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local`:
```env
PORT=3001
NODE_ENV=development

# Server-Side Admin Secret Password
ADMIN_PASSWORD=your-secure-password

# Optional: Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Run Development Server
```bash
npm run dev
```

Open `http://localhost:3001` to access the Streamer Studio.

---

## 🚀 GitHub & Vercel Deployment Instructions

### 1. Create and Push to GitHub
```bash
cd streampulse-admin
git init
git add .
git commit -m "feat: initial streampulse-admin streamer studio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/streampulse-admin.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Import the `streampulse-admin` repository.
3. Framework Preset: **Next.js**.
4. In **Environment Variables**, add:
   - `ADMIN_PASSWORD` = `your-private-password`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional)
   - `NEXT_PUBLIC_SUPABASE_URL` (optional)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)
5. Click **Deploy**.
