import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './worker/db/schema.ts',
  out: './worker/db/migrations',
  dialect: 'sqlite',
});
