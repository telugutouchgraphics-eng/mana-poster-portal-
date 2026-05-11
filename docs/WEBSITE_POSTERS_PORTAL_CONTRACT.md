# Website Posters Portal Contract

Website landing page posters must come only from Firestore collection:

`websitePosters`

## Required fields

```json
{
  "category": "Ugadi",
  "imageUrl": "https://...",
  "active": true,
  "sortOrder": 1
}
```

## Notes

- `active == true` documents only are shown on website.
- Website reads `websitePosters` only.
- App `creatorPosters` are not used by website anymore.
- Direct client writes are blocked by Firestore rules.
- Portal/admin backend should create and update these documents.
