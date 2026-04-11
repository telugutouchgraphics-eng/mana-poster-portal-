# Mana Poster Web Portal

Creator-first portal foundation using Next.js + Firebase.

## Implemented in this phase

- Manager/admin can create creator access with:
  - name
  - email
  - phone
- System generates secure unique creator ID:
  - `Mana-XXXXXX` (serial based, no duplicates)
- System returns:
  - direct creator login link
  - ready-made WhatsApp message text
- Creator activation via link:
  - sets password
  - activates account
  - logs in immediately
- Single-device policy for creators:
  - one creator account -> one active device
  - second device login is rejected
  - manager/admin can reset creator device lock
- Role guard skeleton:
  - manager dashboard
  - creator dashboard

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Firebase Auth
- Firestore
- Firebase Admin SDK (server routes)

## Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

`FIREBASE_PRIVATE_KEY` should use escaped new lines in env (`\n`).

## Firestore collections used

- `system/counters`
  - `creatorSerial: number`
- `creatorProfiles/{creatorPublicId}`
- `creatorInvites/{inviteId}`
- `users/{uid}`

## Local run

```bash
npm install
npm run dev
```

Open:
- `/login`
- `/manager/dashboard`
- `/creator/dashboard`

## Notes

- Invite links currently do not expire by business decision.
- Creator device lock reset is allowed for manager and admin roles.
- Role comes from Firebase custom claims first, then `users.role`.
