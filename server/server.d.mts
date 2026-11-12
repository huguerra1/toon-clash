/** Tipos do servidor de salas (server.mjs), usados pelos testes. */
export function startServer(
  port?: number,
  options?: { allowedOrigins?: string[] },
): Promise<{ port: number; close: () => Promise<void> }>;
export function parseOrigins(value: string | undefined): string[];
export function originAllowed(origin: string | undefined, allowed: string[]): boolean;
