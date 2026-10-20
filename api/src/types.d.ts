import type { AccountContext } from './db.js';

declare module 'fastify' {
  interface FastifyRequest { account: AccountContext }
}
