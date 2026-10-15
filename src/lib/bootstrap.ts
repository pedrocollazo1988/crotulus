import "server-only";
import { loadConfig, getConfig, resetConfig } from "./config";
import { settingsApplyOverrides } from "./settings";

/**
 * ============================================================================
 *  ARRANQUE POR PETICION  (puerto de app/bootstrap.php)
 * ----------------------------------------------------------------------------
 *  En PHP, bootstrap.php se ejecutaba en cada peticion: cargaba la config y
 *  aplicaba los ajustes de la BD. En Next cada route handler / server action
 *  llama a bootstrap() al empezar.
 * ============================================================================
 */

let bootstrapped = false;

/**
 * Carga la configuracion y aplica los ajustes guardados en la base de datos.
 * Es idempotente dentro del proceso (los ajustes se cachean en memoria).
 */
export async function bootstrap(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  resetConfig();
  const config = loadConfig();
  await settingsApplyOverrides(config as unknown as Record<string, unknown>);
}

/** Reinicia el estado de arranque (util en pruebas y tras guardar ajustes). */
export function resetBootstrap(): void {
  bootstrapped = false;
  resetConfig();
}

export { getConfig };
