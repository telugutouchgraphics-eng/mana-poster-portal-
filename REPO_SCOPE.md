# Mana Poster Web Portal Repo Scope

Repo name: `mana-poster-web-portal`

Use this repo only for:

- admin dashboard
- creator dashboard
- manager dashboard
- portal APIs
- portal UI customization screens
- portal deployment and portal documentation

Main folders:

- `src`
- `public`
- `docs`

Domains handled here:

- `admin.manaposter.in`
- `creator.manaposter.in`

Firebase routing:

- Default webportal Firebase project: `mana-poster-ap`.
- Exception: Admin Dashboard -> `Editor Assets` and `Editor Fonts` are for Mana Poster Editor app, not the Mana Poster AI app.
- Those two tabs must use `mana-poster-editor` through `editorAdminDb` / `editorAdminStorage`.
- Editor app collections: `editorAssetCategories`, `editorAssets`, `editorFonts`.
- App Hosting needs secrets `EDITOR_FIREBASE_CLIENT_EMAIL` and `EDITOR_FIREBASE_PRIVATE_KEY` granted to backend `mana-poster-web-portal`.

Do not put Flutter mobile app code here.

Related apps live in:

- Mana Poster Editor app: `C:\Users\telug\mana_poster_editor_app`
- Mana Poster AI app repo: `mana poster gitchek`
