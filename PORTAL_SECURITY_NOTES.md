# Mana Poster Web Portal Security Notes

## Current Hardening Added
- Role-gated admin / manager / creator routes
- Single-device creator session logic
- Audit logging for key portal actions in `adminAuditLogs`
- Security response headers in `next.config.ts`
- Duplicate upload guard for creator posters

## Audit Logged Actions
- Creator invite generation
- Creator category assignment update
- Creator access status change
- Creator device reset
- Poster review status change
- Poster sale recording
- Creator payout marking

## Important Firebase Notes
- Portal uses Admin SDK on server routes
- Firestore/Storage client rules primarily protect app/client traffic
- Admin credentials must stay server-only

## Collections to Monitor
- `adminAuditLogs`
- `creatorProfiles`
- `creatorPosters`
- `creatorEarningLedger`
- `creatorPayouts`
- `competitions`

## Recommended Next Security Upgrades
- Add rate limiting on sensitive APIs
- Add IP / user-agent capture to audit logs
- Add admin action viewer screen
- Add server-side alerting for suspicious repeated actions
- Add backup/restore runbook
