<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mana Poster Web Portal Rules & Guidelines

## Firebase Project Routing (MANDATORY)
- This web portal normally uses Firebase project `mana-poster-ap`.
- Only the admin dashboard tabs `Editor Assets` and `Editor Fonts` are cross-project controls for the separate Mana Poster Editor app.
- Those two tabs must read/write the `mana-poster-editor` Firebase project via `editorAdminDb` / `editorAdminStorage`.
- Do not move editor asset/font collections into `mana-poster-ap`; the editor app reads `editorAssetCategories`, `editorAssets`, and `editorFonts` from `mana-poster-editor`.
- The Mana Poster AI app is a different app/repo (`mana poster gitchek`) related to this web portal; do not confuse it with the editor app asset/font backend.

## 1. Concise Communication (MANDATORY)
- Always keep responses to the user concise and strictly within a maximum of 5 lines, unless the user explicitly asks for detailed explanations or code snippets.
- Respond in natural, polite Telugu by default.
