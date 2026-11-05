import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/app/whatsapp-test")({ beforeLoad: () => { throw redirect({ to: "/app", statusCode: 301 }); } });
