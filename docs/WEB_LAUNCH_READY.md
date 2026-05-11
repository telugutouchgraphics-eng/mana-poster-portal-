# Web Launch Ready

## Deploy command
```powershell
flutter build web --release --no-pub
firebase deploy --only hosting
```

## Firestore seed command
```powershell
npm --prefix functions run seed:website
```

Optional full replace for `websitePosters`:
```powershell
node tool/seed_website_content.js --replace-posters
```

## Firestore structure
- Collection: `websiteConfig`
- Document: `landingPage`
- Collection: `websitePosters`

Seed example:
- [docs/landing-page-firestore-seed.json](/C:/Users/telug/mana_poster/docs/landing-page-firestore-seed.json)

Notes:
- Seed file lo poster docs ki stable `id` ivvali.
- Script run cheyyadaniki Firebase Admin credentials / logged-in environment available undali.
- `--replace-posters` use chesthe seed file lo leni `websitePosters` docs delete avuthayi.
- Direct web admin uploader use cheyyali ante Functions environment lo `MANA_POSTER_WEBSITE_ADMIN_EMAILS` comma-separated admin emails set cheyyali.
- Web admin route: `/website-admin`

## Remaining external steps
1. Add or update Firestore document `websiteConfig/landingPage` with final download, demo, and social URLs when they are ready
2. Replace sample `websitePosters` seed entry with real poster image docs and run `npm --prefix functions run seed:website`
3. Run the deploy commands above
4. If needed, verify custom domain `manaposter.in` still points to Firebase Hosting
