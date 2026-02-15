const Sentry = require('@sentry/node');
const logger = require('./logger');

/**
 * Initialize Sentry for error tracking
 */
function initSentry() {
  if (!process.env.SENTRY_DSN) {
    logger.warn('Sentry DSN not configured, error tracking disabled');
    return false;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    maxBreadcrumbs: 50,
    beforeSend(event, hint) {
      // Don't send 4xx errors to Sentry (too noisy)
      if (event.exception) {
        const error = hint.originalException;
        if (error.statusCode && error.statusCode < 500) {
          return null;
        }
      }
      return event;
    },
  });

  logger.info('Sentry error tracking initialized');
  return true;
}

/**
 * Capture exception with additional context
 */
function captureException(error, context = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureException(error);
  });
}

/**
 * Capture message
 */
function captureMessage(message, level = 'info', context = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureMessage(message, level);
  });
}

/**
 * Add breadcrumb for debugging
 */
function addBreadcrumb(message, data = {}, category = 'default', level = 'info') {
  Sentry.addBreadcrumb({
    message,
    data,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context
 */
function setUserContext(user) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user._id || user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Set transaction context
 */
function setTransaction(name) {
  const transaction = Sentry.getCurrentHub().getTransaction();
  if (transaction) {
    transaction.setName(name);
  }
}

/**
 * Express middleware for Sentry
 */
function errorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Express middleware to capture requests
 */
function requestHandler() {
  return Sentry.Handlers.requestHandler();
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUserContext,
  setTransaction,
  errorHandler,
  requestHandler,
};
