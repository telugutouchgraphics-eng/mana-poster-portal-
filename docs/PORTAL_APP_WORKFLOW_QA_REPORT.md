# Mana Poster Portal + App Workflow QA Report

## Purpose
- Portal lo creators upload chesina posters, managers approve chesina content, admins manage chesina banners app lo correct ga reflect avuthunnayo verify cheyyadaniki ee report use avuthundi.
- Launch mundu most critical cross-system flow ni one place lo track cheyyadaniki idi final QA guide.

## Current Code Verification Status
- Flutter `flutter analyze --no-pub`: PASS
- Portal `npm run lint`: PASS
- Portal `npm run build`: PASS
- App repo GitHub push: PASS
- Portal repo GitHub push: PASS
- Portal production deploy: PASS
- Firebase rules/indexes deploy: PASS

## End-to-End Workflows

### 1. Admin Content Control Flow
- Admin login avvali
- `App Banners` page open avvali
- New banner create/upload cheyyali
- Banner active ga mark cheyyali
- Banner sort order save avvali
- App home lo categories kinda banner kanipinchali
- Banner order portal lo set chesinattu app lo same ga undali

### 2. Manager Creator Access Flow
- Manager login avvali
- Creator invite/create cheyyali
- Categories assign cheyyali
- Creator access active status correct ga undali
- Creator reset device action error lekunda work avvali
- Creator dashboard access link valid ga undali

### 3. Creator Upload Flow
- Creator login avvali
- Assigned category visible ga undali
- Poster upload cheyyali
- Upload preview correct ga undali
- Dummy/sample text critical upload flow lo undakudadhu
- Upload success taruvatha poster `pending` state lo manager review list lo kanipinchali

### 4. Manager Review Flow
- Manager review list lo uploaded poster kanipinchali
- Approve action work avvali
- Reject action work avvali
- Review comment save avvali
- Archive/delete actions history tho stable ga undali
- Duplicate upload guard trigger avvali if same poster/category repeat ayithe

### 5. App Approved Poster Flow
- Manager approve chesina poster app home `Free` tab lo kanipinchali
- Pull-to-refresh taruvatha immediate ga fetch avvali
- Latest poster latest-first order lo undali
- Poster category chip select chesthe correct filtered ga kanipinchali
- `All` lo kuda visible ga undali

### 6. Poster Personalization Flow
- App user profile name save cheyyali
- App user WhatsApp number save cheyyali
- App user photo upload cheyyali
- Poster meedha user photo background-remove result tho render avvali
- Name strip / WhatsApp strip template logic prakaram render avvali
- Wrong crop, white halo, sample text undakudadhu

### 7. Share/Download Flow
- Download button tap chesthe final poster save avvali
- Share button tap chesthe WhatsApp share intent open avvali
- Exported poster lo creator id, user name, user photo final ga visible ga undali
- UI-only checkerboard or editor overlays export lo undakudadhu

### 8. Dynamic Category Flow
- Fixed-date events event ki 2 days mundu app lo chip ga kanipinchali
- Dashboard assign panel lo same event 7 days mundu visible ga undali
- Last 2 days lo highlight/blink only dashboard lo kanipinchali
- Duplicate event chips undakudadhu

## Manual Sign-off Table

| Flow | Owner | Status | Notes |
| --- | --- | --- | --- |
| Admin content control | Pending | Pending | |
| Manager creator access | Pending | Pending | |
| Creator upload | Pending | Pending | |
| Manager review | Pending | Pending | |
| App approved poster sync | Pending | Pending | |
| Poster personalization | Pending | Pending | |
| Share/download | Pending | Pending | |
| Dynamic categories | Pending | Pending | |

## Launch Decision
- All rows `Pass` ayyaka system ni launch-ready ga consider cheyyachu.
- Ekkadaina `Fail` or `Blocked` unte exact issue note chesi next fix batch start cheyyali.
