// Simple performance monitoring utility
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      slowQueries: []
    };
  }

  recordApiCall(url, duration) {
    this.metrics.apiCalls++;
    
    // Update average response time
    const total = this.metrics.averageResponseTime * (this.metrics.apiCalls - 1);
    this.metrics.averageResponseTime = (total + duration) / this.metrics.apiCalls;

    // Track slow queries (> 1 second)
    if (duration > 1000) {
      this.metrics.slowQueries.push({
        url,
        duration,
        timestamp: new Date()
      });

      // Keep only last 10 slow queries
      if (this.metrics.slowQueries.length > 10) {
        this.metrics.slowQueries.shift();
      }
    }
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  getCacheHitRate() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (total === 0) return 0;
    return ((this.metrics.cacheHits / total) * 100).toFixed(2);
  }

  getReport() {
    return {
      totalApiCalls: this.metrics.apiCalls,
      cacheHitRate: `${this.getCacheHitRate()}%`,
      averageResponseTime: `${this.metrics.averageResponseTime.toFixed(2)}ms`,
      slowQueries: this.metrics.slowQueries.length,
      slowQueriesList: this.metrics.slowQueries.map(q => ({
        url: q.url,
        duration: `${q.duration}ms`,
        time: q.timestamp.toLocaleTimeString()
      }))
    };
  }

  logReport() {
    console.log('📊 Performance Report:', this.getReport());
  }

  reset() {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      slowQueries: []
    };
  }
}

// Export for use in backend
module.exports = PerformanceMonitor;

// Usage example in routes:
/*
const PerformanceMonitor = require('../utils/performanceMonitor');
const monitor = new PerformanceMonitor();

// In your route:
const startTime = Date.now();
const result = await YourModel.find();
monitor.recordApiCall(req.path, Date.now() - startTime);

// View report:
monitor.logReport();
*/
