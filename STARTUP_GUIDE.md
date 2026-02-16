# WearAware Startup Guide

## Quick Start Scripts

### Full Stack with AI Summaries (Docker + Backend + Ollama + Expo Go)

**Windows:**
```bash
npm start
```

**Linux/Mac:**
```bash
npm run start:unix
```

This will automatically:
1. ✅ Start Docker containers (PostgreSQL + Redis + Backend + Ollama)
2. ✅ Wait for services to be healthy
3. ✅ Start Expo for Expo Go
4. ✅ Enable AI summaries via backend

**Use with Expo Go app on your phone** - scan QR code to open app.
- Good for UI testing and development

---

## First-Time Setup

### 1. Configure Environment

Edit `.env` file and set your database password:
```
DB_PASSWORD=your_secure_password_here
```

### 2. Build Development APK (One-time)

**Required for ML Kit offline OCR:**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android
eas build --profile development --platform android
```

Wait for build (15-20 minutes), then:
1. Download APK from EAS dashboard
2. Install on your Android device
3. Device is now ready for `npm run dev`

### 3. Start Development

```bash
npm run dev
```

Scan the QR code with your development build app!

---

## What Each Script Does

### `npm run dev` (Production Mode)
- Starts Docker: PostgreSQL + Redis + Backend
- Starts Expo: Development client mode
- Features: Full offline support, Redis caching, hybrid OCR
- Requires: Development build APK installed on device

### `npm start` (Expo Go Mode)
- Starts Expo: Standard mode
- Features: Vision API only (online), no caching
- Requires: Expo Go app from App Store

---

## Stopping the App

Press `Ctrl+C` in the terminal to stop everything:
- Expo dev server stops
- Docker containers shut down automatically
- Clean exit

---

## Service URLs (when using `npm run dev`)

- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## Troubleshooting

### Docker not starting?
- Make sure Docker Desktop is running
- Check `.env` has correct DB_PASSWORD

### "No development build installed"?
- Run `eas build --profile development --platform android`
- Install the APK on your device
- Open the installed app and scan QR code

### Services unhealthy?
Check logs:
```bash
docker-compose logs
```

Restart containers:
```bash
docker-compose down
docker-compose up -d
```

### Port conflicts?
Stop any existing Node/Postgres processes:
```bash
# Windows
Stop-Process -Name "node" -Force
Stop-Process -Name "postgres" -Force

# Linux/Mac
pkill node
pkill postgres
```
