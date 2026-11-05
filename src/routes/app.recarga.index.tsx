import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/app/recarga/")({ beforeLoad: () => { throw redirect({ to: "/app", statusCode: 301 }); } });
