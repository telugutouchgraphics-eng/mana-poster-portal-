# Mana Poster Web Portal Launch Checklist

## Environment
- Fill `.env.local` / production secrets for Firebase client + admin credentials
- Set `NEXT_PUBLIC_APP_URL` to production domain
- Verify Firebase project points to production project only

## Security
- Deploy latest app-side Firebase rules from:
  - `c:\Users\telug\mana_poster\firestore.rules`
  - `c:\Users\telug\mana_poster\storage.rules`
- Verify portal admin credentials are never exposed client-side
- Confirm permanent admin email list is intentional
- Review `adminAuditLogs` collection after key actions

## Auth and Roles
- Test admin login
- Test manager login
- Test creator login
- Test multi-role login switch buttons
- Test single-device creator restriction
- Test access removal and re-enable flow

## Creator Flow
- Invite creator
- Open creator access link
- Activate creator account
- Assign categories
- Upload poster
- Re-upload after rejection
- Verify duplicate upload protection

## Review Flow
- Manager approve poster
- Manager reject poster with comment
- Archive poster
- Delete poster
- Confirm review history is stored

## Earnings and Payouts
- Record manual sale
- Verify creator/platform split
- Mark payout
- Open payout reports
- Export CSV

## Competitions
- Create competition
- Verify manager can see live competition
- Verify creator sees rank and top leaders

## App Sync
- Approved posters visible in app
- Dynamic categories visible on correct dates
- Creator personalization visible in poster preview

## Final QA
- `npm run lint`
- `npm run build`
- Browser test on desktop
- Responsive test on tablet/mobile widths

## Recommended Before Public Launch
- Add error monitoring
- Add domain + HTTPS
- Add periodic Firestore export backup
- Add production Firebase indexes review
