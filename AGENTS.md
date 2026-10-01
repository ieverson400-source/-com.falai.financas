# Project Architecture

- The public root route redirects authenticated users to `/app` and visitors to `/auth`, whose default view is account creation; this keeps the marketing homepage removed while preserving existing sign-in links.
- The canonical public PWA manifest is `/manifest.json`; keep `/manifest.webmanifest` equivalent for previously installed clients and use `/` as its stable app identity and start URL.