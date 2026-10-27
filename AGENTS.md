# Project Architecture

- The root route is a public minimal landing page; authentication begins only after the user chooses `/auth`.
- The canonical public PWA manifest is `/manifest.json`; keep `/manifest.webmanifest` equivalent for previously installed clients and use `/` as its stable app identity and start URL.
- Browser push uses Firebase Cloud Messaging through the linked connector; device registration is user-scoped and broadcasts are admin-only server functions.
- The admin AdSense section uses a dedicated editor calling the existing admin-authorized settings functions; keep Shop offers independent of ad configuration failures.
- Shop offer approval uses the existing is_active publication flag and date-based RLS; categories are optional so legacy offers remain unchanged.
- Partner advertising uses the existing advertisers, advertisements and event tables independently of legacy Shop offers; admin functions authorize through user_roles and user-scoped event inserts retain session/day deduplication.