const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID,
  appId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID,
  messagingSenderId:
    import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID?.split(":")[1] ?? "",
};

const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

export async function enablePush(): Promise<PushRegistrationResult> {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId || !firebaseConfig.messagingSenderId || !vapidKey) {
    return { status: "not-configured" };
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) return { status: "unsupported" };
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams(firebaseConfig).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  return token ? { status: "registered", token } : { status: "denied" };
}