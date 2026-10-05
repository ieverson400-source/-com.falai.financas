# Project Architecture

- The root route is a public minimal landing page; authentication begins only after the user chooses `/auth`.
- The canonical public PWA manifest is `/manifest.json`; keep `/manifest.webmanifest` equivalent for previously installed clients and use `/` as its stable app identity and start URL.
- Browser push uses Firebase Cloud Messaging through the linked connector; device registration is user-scoped and broadcasts are admin-only server functions.