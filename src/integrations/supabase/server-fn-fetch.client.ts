// Client-only: patches global fetch so that any TanStack Start server function
// call (`/_serverFn/...`) automatically carries the current Supabase session's
// Authorization header. Without this, server fns guarded by
// `requireSupabaseAuth` always 401 — the middleware throws a Response which
// surfaces as the opaque "Error: [object Response]" runtime error.
import { supabase } from "./client";

if (typeof window !== "undefined" && !(window as unknown as { __serverFnFetchPatched?: boolean }).__serverFnFetchPatched) {
  (window as unknown as { __serverFnFetchPatched?: boolean }).__serverFnFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/_serverFn/")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      }
    } catch {
      // fall through to plain fetch on any unexpected error
    }
    return originalFetch(input, init);
  };
}

export {};
