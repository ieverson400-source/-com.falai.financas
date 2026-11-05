import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/app/recarga/configuracoes")({ beforeLoad: () => { throw redirect({ to: "/app", statusCode: 301 }); } });
