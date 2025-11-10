import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Handle pool errors gracefully
pool.on('error', (err: any, client) => {
  // Only log non-fatal errors (connection terminations are expected with Neon)
  // Error code 57P01 is "terminating connection due to administrator command"
  // This is normal for serverless databases and doesn't need to be logged as an error
  if (err?.code !== '57P01') {
    console.error('Unexpected PG Pool error:', err);
  }
  // The pool will automatically remove the client and create a new one
});

export const db = drizzle({ client: pool, schema });
