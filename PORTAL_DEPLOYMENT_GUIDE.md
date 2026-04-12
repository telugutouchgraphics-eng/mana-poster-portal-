# Mana Poster Web Portal Deployment Guide

## 1. Production prerequisites
- Firebase production project ready
- Firestore + Storage enabled
- Admin SDK service credentials prepared
- Production domain ready

## 2. Required environment variables
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_APP_URL`

## 3. Firebase setup
- Deploy app-side rules from `c:\\Users\\telug\\mana_poster`
- Verify Firestore indexes required by current queries
- Verify signed URL storage usage is acceptable for production

## 4. Portal deploy steps
- `npm install`
- `npm run lint`
- `npm run build`
- Deploy to your hosting target
- Set all production env vars
- Verify admin login after deploy

## 5. Post-deploy checks
- Admin dashboard opens
- Manager dashboard opens
- Creator access link opens
- Invite flow works
- Upload flow works
- Review flow works
- Approved posters flow to app
- Payout reports export works
- Audit log screen shows actions

## 6. Recommended operational setup
- Daily Firestore backup/export
- Error monitoring
- Uptime monitoring
- Audit log review process
- Release checklist before every update
