import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/app/conectar-whatsapp")({ beforeLoad: () => { throw redirect({ to: "/app", statusCode: 301 }); } });
