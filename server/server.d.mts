/** Tipos do servidor de salas (server.mjs), usados pelos testes. */
export function startServer(port?: number): Promise<{ port: number; close: () => Promise<void> }>;
