Author: Caitriona McCann
Date: 26/11/2025
WearAware the Sustainable Fashion Scanner

WearAware is a React Native mobile app that scans clothing labels to evaluate environmental impact. Registered users and guests can use the app.
However, guest users do not have access to their history of scans.

TECHNOLOGIES REQUIRED:
- Node.js 18+
- PostgreSQL 14+
- Expo Go app (on your phone)
- Google Cloud Vision API key
- Firebase project

HOW IT WORKS:
1. User logs in via Firebase (or continues as guest)
2. Camera scans clothing label using Expo Camera
3. Google Vision API extracts text from image
4. App calculates environmental score based on fiber composition
5. Backend saves scan to PostgreSQL database
6. Results show water usage, CO2 emissions, and sustainability grade (A-F)

COMPONENT INTERACTION:
- AuthContext manages Firebase login state across all screens
- CameraScreen/ManualInputScreen send scan data to impactCalculator.js
- impactCalculator.js calculates score/grade based on fiber water + carbon data
- api.js sends calculated results to backend (POST /api/scans)
- Backend stores in PostgreSQL and returns scan with ID
- ScanResultScreen displays grade, metrics, and navigation to BreakdownScreen
- BreakdownScreen shows per-fiber impact details
- HistoryScreen fetches all user scans from backend (GET /api/scans/history)
- Guest users can view scan results but cannot save scan history

SETUP STEPS:

1. Database Setup:
   - Install PostgreSQL
   - Create database: CREATE DATABASE wearaware;
   - Run schema: psql -U postgres -d wearaware -f backend/database/schema.sql

2. Backend Setup:
   - Navigate to backend folder: cd backend
   - Install dependencies: npm install
   - Configure backend/.env file with your credentials:
     * DB_PASSWORD=YOUR_DATABASE_PASSWORD
   - Start server: npm start
   - Verify at http://localhost:3000/api/health

3. Frontend Setup:
   - Return to root: cd ..
   - Install dependencies: npm install
   - Configure .env file in root directory with your API keys:
     * FIREBASE_API_KEY=your_firebase_api_key
     * FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
     * FIREBASE_PROJECT_ID=your_project_id
     * FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
     * FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     * FIREBASE_APP_ID=your_app_id
     * GOOGLE_VISION_API_KEY=your_google_vision_api_key
   - Configure src/config/firebase.js:
     * Replace all "YOUR_FIREBASE_*" placeholders with your Firebase credentials
   - Configure src/services/visionApi.js:
     * Replace "YOUR_GOOGLE_VISION_API_KEY" (line 7) with your Google Vision API key
   - Configure src/services/api.js:
     * Update IP address to your computer's local IP (line 10)

4. Run the App:
   - Start Expo: npx expo start
   - Install Expo Go app on your phone
   - Scan QR code to open app
   - Phone and computer must be on same WiFi network

REQUIRED CREDENTIALS:
- Google Cloud Vision API key (enable Vision API in Google Cloud Console)
  → Add to: .env (GOOGLE_VISION_API_KEY) and src/services/visionApi.js (line 7)
- PostgreSQL password (set during PostgreSQL installation)
  → Add to: backend/.env (DB_PASSWORD)
- Firebase config (create project at console.firebase.google.com, enable Email/Password & Anonymous auth)
  → Add to: .env (all FIREBASE_* variables) and src/config/firebase.js (replace all placeholders)



