import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function db(env: Env) {
  return drizzle(env.DB, { schema });
}

export { schema };
