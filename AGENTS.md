# Project Architecture

- The public root route redirects authenticated users to `/app` and visitors to `/auth`, whose default view is account creation; this keeps the marketing homepage removed while preserving existing sign-in links.