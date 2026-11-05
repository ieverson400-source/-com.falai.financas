import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/app/agenda-mensagens")({ beforeLoad: () => { throw redirect({ to: "/app", statusCode: 301 }); } });
