# Mana Poster Landing CMS

## Folder Structure

- `src/app/page.tsx` - public landing page rendered from CMS data.
- `src/app/admin/dashboard/landing-page/page.tsx` - admin CMS entry page.
- `src/components/admin/landing-page/landing-page-inline-editor.tsx` - Wix-like inline editor.
- `src/components/admin/landing-page/landing-page-preview.tsx` - dynamic public landing renderer.
- `src/app/api/content/route.ts` - `GET /api/content`, `POST /api/content`.
- `src/app/api/categories/route.ts` - `GET /api/categories`, `POST /api/categories`.
- `src/app/api/categories/[id]/route.ts` - `PUT /api/categories/:id`, `DELETE /api/categories/:id`.
- `src/app/api/categories/[id]/posters/route.ts` - `GET /api/categories/:id/posters`, `POST /api/categories/:id/posters`.
- `src/app/api/posters/[id]/route.ts` - `PUT /api/posters/:id`, `DELETE /api/posters/:id`.
- `src/app/api/upload/route.ts` - `POST /api/upload`.
- `src/lib/server/landing-page-management.ts` - CMS defaults, validation, Firestore save/load.
- `src/lib/server/content-management.ts` - poster load and Firebase Storage upload helpers.

## Storage And Database

This repo already uses Firebase, so the production implementation maps the requested CMS tables to Firestore collections and Firebase Storage.

### `websiteConfig/landingPage`

Single document that stores all editable landing sections:

- `navbar`: logo, app name, button, menu items.
- `hero`: title, subtitle, description, buttons, preview images, promo banners.
- `appPreview`: app screenshots and text.
- `features`: editable feature cards with title, description, icon.
- `categories`: category names, descriptions, images, ordering.
- `dynamicEvents`: "how it works" / event-style steps.
- `plans`: free and premium plan content.
- `testimonials`: editable user quotes.
- `faq`: questions and answers.
- `finalCta`: final app download section.
- `footer`: email, links, social links, logo, copyright-style text.

### `websitePosters`

Poster uploads shown under categories:

```ts
{
  id: string;
  category: string;
  imageUrl: string;
  imagePath: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}
```

### Firebase Storage

Images are stored under:

- `landing/assets/...`
- `landing/posters/...`
- `landing/uploads/...`

## Example Data

```json
{
  "navbar": {
    "appName": "Mana Poster",
    "buttonText": "Download App",
    "items": [
      { "id": "features", "label": "Features", "href": "#features", "sortOrder": 10, "visible": true, "published": true }
    ]
  },
  "features": {
    "title": "Create posters faster",
    "items": [
      { "id": "feature-1", "title": "Telugu Templates", "description": "Ready designs for daily posts.", "icon": "+", "sortOrder": 10, "visible": true, "published": true }
    ]
  },
  "websitePosters": [
    { "category": "Festivals", "imageUrl": "https://...", "imagePath": "landing/posters/festivals.png", "active": true, "sortOrder": 10 }
  ]
}
```
