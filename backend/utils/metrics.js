const client = require('prom-client');

// Default metrics collection
client.collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
});

const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'Duration of database queries in ms',
  labelNames: ['collection', 'operation'],
  buckets: [0.1, 5, 10, 50, 100, 500, 1000],
});

const redisCacheHits = new client.Counter({
  name: 'redis_cache_hits_total',
  help: 'Total Redis cache hits',
  labelNames: ['key_pattern'],
});

const redisCacheMisses = new client.Counter({
  name: 'redis_cache_misses_total',
  help: 'Total Redis cache misses',
  labelNames: ['key_pattern'],
});

const activeWebsocketConnections = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
});

const jobsProcessed = new client.Counter({
  name: 'jobs_processed_total',
  help: 'Total jobs processed by Bull queues',
  labelNames: ['queue_name', 'status'],
});

const jobDuration = new client.Histogram({
  name: 'job_duration_ms',
  help: 'Duration of job execution in ms',
  labelNames: ['queue_name'],
  buckets: [100, 500, 1000, 5000, 10000, 30000],
});

const authAttempts = new client.Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'result'],
});

const errors = new client.Counter({
  name: 'errors_total',
  help: 'Total errors',
  labelNames: ['type', 'status_code'],
});

/**
 * Record HTTP request metrics
 */
function recordHttpMetric(method, route, statusCode, duration, requestSize, responseSize) {
  try {
    const statusCodeNum = Number(statusCode);
    const durationNum = Number(duration);
    const requestSizeNum = Number(requestSize);
    const responseSizeNum = Number(responseSize);

    httpRequestDuration.labels(method, route, String(statusCodeNum)).observe(durationNum);
    httpRequestTotal.labels(method, route, String(statusCodeNum)).inc();
    if (requestSizeNum > 0) httpRequestSize.labels(method, route).observe(requestSizeNum);
    if (responseSizeNum > 0) httpResponseSize.labels(method, route, String(statusCodeNum)).observe(responseSizeNum);
  } catch (error) {
    console.error('Error recording HTTP metric:', error.message);
  }
}

/**
 * Record database query metrics
 */
function recordDbMetric(collection, operation, duration) {
  dbQueryDuration.labels(collection, operation).observe(duration);
}

/**
 * Record cache hits/misses
 */
function recordCacheHit(keyPattern) {
  redisCacheHits.labels(keyPattern).inc();
}

function recordCacheMiss(keyPattern) {
  redisCacheMisses.labels(keyPattern).inc();
}

/**
 * Record WebSocket metrics
 */
function incrementWebSocketConnections() {
  activeWebsocketConnections.inc();
}

function decrementWebSocketConnections() {
  activeWebsocketConnections.dec();
}

/**
 * Record job metrics
 */
function recordJobProcessed(queueName, status) {
  jobsProcessed.labels(queueName, status).inc();
}

function recordJobDuration(queueName, duration) {
  jobDuration.labels(queueName).observe(duration);
}

/**
 * Record authentication metrics
 */
function recordAuthAttempt(type, result) {
  authAttempts.labels(type, result).inc();
}

/**
 * Record errors
 */
function recordError(type, statusCode) {
  errors.labels(type, statusCode).inc();
}

/**
 * Get metrics as string
 */
async function getMetrics() {
  return await client.register.metrics();
}

/**
 * Get metrics as JSON
 */
async function getMetricsJSON() {
  const metrics = await client.register.getMetricsAsJSON();
  return metrics;
}

module.exports = {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestSize,
  httpResponseSize,
  dbQueryDuration,
  redisCacheHits,
  redisCacheMisses,
  activeWebsocketConnections,
  jobsProcessed,
  jobDuration,
  authAttempts,
  errors,
  recordHttpMetric,
  recordDbMetric,
  recordCacheHit,
  recordCacheMiss,
  incrementWebSocketConnections,
  decrementWebSocketConnections,
  recordJobProcessed,
  recordJobDuration,
  recordAuthAttempt,
  recordError,
  getMetrics,
  getMetricsJSON,
};
