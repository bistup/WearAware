Author: Caitriona McCann
Last Updated: 18/04/2026
WearAware — Sustainable Fashion Scanner

WearAware is a React Native mobile application that scans clothing care
labels to evaluate environmental impact. Users photograph a care label,
the app extracts fibre composition using OCR, calculates a sustainability
score and letter grade (A-F) based on water usage and CO2 emissions,
and generates an AI-powered sustainability summary. Registered users and
guests can use the app, however guest users do not have access to scan
history, social features, gamification, wardrobe management or the
marketplace.

TECHNOLOGIES REQUIRED:
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Python 3.10+ (for ML service)
- Ollama with llama3.2:1b model
- Expo Go app (on your phone)
- Google Cloud Vision API key
- Firebase project
- Google Cloud service account JSON (for Vertex AI Discovery Engine)
- eBay App ID and Cert ID (for second-hand search)

HOW IT WORKS:
1. User logs in via Firebase (or continues as guest)
2. User fills in pre-scan form: brand name, item type, gender
3. Camera scans clothing care label using Expo Camera
4. Google Cloud Vision API extracts text from the label image
5. Fibre composition is parsed from the extracted text
6. User optionally photographs the garment itself
7. App calculates sustainability score and grade (A-F) based on
   water usage and CO2 emissions per fibre type and garment weight
8. Backend saves scan to PostgreSQL and generates an AI summary via Ollama
9. If a garment photo was taken, the CLIP ML service classifies its visual
   attributes (colour, pattern, garment type) for use in alternative search
10. Results show grade, metrics, AI summary and care instructions
11. Users can browse sustainable alternatives via Vertex AI and
    second-hand options via eBay

KEY FEATURES:
- Care label scanning with OCR (Google Cloud Vision API)
- Manual fibre input as fallback (30+ fibre types supported)
- Sustainability scoring: water usage + CO2 per fibre type and garment weight
- Letter grade A-F with colour-coded indicator
- AI-generated sustainability summaries (Ollama / Llama 3.2 1B)
- CLIP machine learning microservice for garment image classification
- Sustainable product alternatives via Google Vertex AI Discovery Engine
- Second-hand alternatives via eBay Browse API
- Scan history with export (CSV/PDF/text)
- Care instructions display with visual symbols
- Community social feed with follows, likes and comments
- Gamification: achievements, weekly challenges, leaderboard with points system
- Wardrobe management with category organisation and wear logging
- Weekly outfit planning
- Community marketplace for free and trade listings
- Direct messaging between users
- Clothing trade system with charity shop dropbox allocation and PIN codes
- Nearby charity shops map using device location
- Sustainability insights: environmental impact trends and charts over time
- Data privacy and GDPR: view stored data, delete images or full account
- Redis caching throughout (graceful fallback when unavailable)
- WCAG 2.1 AA and EU Accessibility Act compliant across all screens

COMPONENT INTERACTION:
- AuthContext manages Firebase login state across all screens
- CameraScreen / ManualInputScreen send scan data to impactCalculator.js
- impactCalculator.js calculates score and grade based on fibre data
- imageUpload.js resizes and uploads garment photo to backend
- api.js sends calculated results to backend (POST /api/scans)
- Backend independently recalculates impact for data integrity
- ML service (Python Flask / CLIP) classifies garment image attributes
- aiService.js requests sustainability summary from Ollama
- ScanResultScreen displays grade, metrics, AI summary and care icons
- BreakdownScreen shows per-fibre impact details
- AlternativesScreen fetches Vertex AI and eBay results
- HistoryScreen fetches all user scans (GET /api/scans/history)
- FeedScreen manages community posts, follows, likes and comments
- WardrobeScreen manages personal clothing collection
- MarketplaceScreen shows community free and trade listings
- TradeScreen handles trade requests with charity shop dropbox allocation
- CharityShopsScreen shows nearby charity shops using device location
- SustainabilityScreen shows environmental impact trends and charts over time
- DataPrivacyScreen handles GDPR requests including image and account deletion
- cache.js manages Redis caching with purpose-specific TTLs

SETUP STEPS:

1. Database Setup:
   - Install PostgreSQL
   - Create database: CREATE DATABASE wearaware;
   - Run core schema: psql -U postgres -d wearaware -f backend/database/schema.sql
   - Run social schema: psql -U postgres -d wearaware -f backend/database/social_schema.sql
   - Run messaging schema: psql -U postgres -d wearaware -f backend/database/messaging_schema.sql

2. Redis Setup:
   - Install Redis and start the service
   - Default host: localhost, port: 6379

3. ML Service Setup:
   - Navigate to ml-service folder: cd ml-service
   - Install dependencies: pip install -r requirements.txt
   - Start service: python app.py
   - Verify at http://localhost:5000/health

4. Ollama Setup:
   - Install Ollama from ollama.ai
   - Pull model: ollama pull llama3.2:1b
   - Ollama runs on port 11434 by default

5. Backend Setup:
   - Navigate to backend folder: cd backend
   - Install dependencies: npm install
   - Create backend/.env file with the following:
     * DB_PASSWORD=your_postgresql_password
     * GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
     * GCP_PROJECT_ID=your_project_id
     * VERTEX_ENGINE_ID=your_engine_id
     * EBAY_APP_ID=your_ebay_app_id
     * EBAY_CERT_ID=your_ebay_cert_id
     * ML_SERVICE_URL=http://localhost:5000
     * OLLAMA_HOST=localhost
     * GOOGLE_PLACES_API_KEY=your_google_places_api_key
   - Start server: npm start
   - Verify at http://localhost:3000/api/health

6. Frontend Setup:
   - Return to root: cd ..
   - Install dependencies: npm install
   - Create a .env file in the root with:
     * GOOGLE_VISION_API_KEY=your_google_vision_api_key
     * GOOGLE_MAPS_API_KEY=your_google_maps_api_key
     * BACKEND_API_URL=http://YOUR_SERVER_IP:3000/api
     * Firebase project credentials (FIREBASE_API_KEY, etc.)

7. Run the App:
   - Start Expo: npx expo start
   - Install Expo Go app on your phone
   - Scan QR code to open app
   - Phone and computer must be on same WiFi network

REQUIRED CREDENTIALS:
- Google Cloud Vision API key (enable Vision API in Google Cloud Console)
- Firebase project config (create project at console.firebase.google.com)
- Google Cloud service account JSON with Discovery Engine permissions
- PostgreSQL password (set during PostgreSQL installation)
- eBay App ID and Cert ID (register at developer.ebay.com)
- Google Places API key (enable Places API in Google Cloud Console)
