# Project Architecture

- The root route redirects publicly to `/auth`; auth defaults to registration, remembers returning accounts on the device without personal data, and sends validated active sessions to `/app`.
- The canonical public PWA manifest is `/manifest.json`; keep `/manifest.webmanifest` equivalent for previously installed clients and use `/` as its stable app identity and start URL.
- Browser push uses Firebase Cloud Messaging through the linked connector; device registration is user-scoped and broadcasts are admin-only server functions.
- Retired bank, recharge and messaging page URLs redirect to the app; financial totals use expense records only, while push/n8n return delivery results without persisted notification history.
- The admin AdSense section uses a dedicated editor calling the existing admin-authorized settings functions; keep Shop offers independent of ad configuration failures.
- Shop offer approval uses the existing is_active publication flag and date-based RLS; categories are optional so legacy offers remain unchanged.
- Partner advertising uses the existing advertisers, advertisements and event tables independently of legacy Shop offers; admin functions authorize through user_roles and user-scoped event inserts retain session/day deduplication.