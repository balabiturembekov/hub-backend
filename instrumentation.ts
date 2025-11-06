export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
  
  // Client-side initialization is handled automatically by Next.js
  // when sentry.client.config.ts is in the root directory
}

