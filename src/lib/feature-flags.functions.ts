import { createServerFn } from "@tanstack/react-start";
import { readFeatureFlags } from "./feature-flags.ts";

/**
 * Estado dos recursos em liberação, lido no servidor. O navegador só recebe booleanos
 * (nenhum segredo). Usado para mostrar ou esconder os atalhos do perfil.
 */
export const getFeatureFlags = createServerFn({ method: "GET" }).handler(async () =>
  readFeatureFlags(process.env),
);
