// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://70dca710f304ae557f050c47cb4b69b7@o4510310717784064.ingest.de.sentry.io/4510310720077904",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  // Enable session replay
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,

  // Filter out errors that are not relevant
  beforeSend(event, hint) {
    // Filter out browser extension errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message);
        // Filter out common browser extension errors
        if (
          errorMessage.includes('chrome-extension://') ||
          errorMessage.includes('moz-extension://') ||
          errorMessage.includes('safari-extension://') ||
          errorMessage.includes('Extension context invalidated')
        ) {
          return null;
        }
      }
    }

    // Add fingerprint to help group similar errors
    // This helps prevent duplicate errors from being grouped incorrectly
    if (event.exception && event.exception.values && event.exception.values.length > 0) {
      const exception = event.exception.values[0];
      if (exception && exception.type && exception.value) {
        // Create a fingerprint based on error type and message
        // This helps Sentry group similar errors together
        event.fingerprint = [
          exception.type,
          exception.value.substring(0, 100), // Limit length
        ];
      }
    }

    // Add user context if available
    if (typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('current_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          // Validate user object before adding to event
          if (user && typeof user === 'object') {
            event.user = {
              id: user.id || undefined,
              email: user.email || undefined,
              username: user.name || user.username || undefined,
            };
            // Remove undefined fields
            if (!event.user.id) delete event.user.id;
            if (!event.user.email) delete event.user.email;
            if (!event.user.username) delete event.user.username;
          }
        }
      } catch (e) {
        // Ignore localStorage errors and JSON parsing errors
      }
    }

    return event;
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
});

