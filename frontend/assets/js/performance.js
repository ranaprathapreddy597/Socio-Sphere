/* =========================================
  PERFORMANCE OPTIMIZATION MODULE
  - Frontend caching
  - Request debouncing
  - Lazy loading
  - Image optimization
  ========================================= */

// Advanced Frontend Cache with LRU eviction
class FrontendCache {
  constructor(maxSize = 100, defaultTTL = 300000) { // 5 minutes default
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    // LRU: Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
      accessed: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    item.accessed = Date.now();
    this.cache.set(key, item);
    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  clearPattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    let expired = 0;
    const now = Date.now();
    for (const item of this.cache.values()) {
      if (now > item.expires) expired++;
    }
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expired
    };
  }
}

// Global cache instance
const frontendCache = new FrontendCache(150, 300000); // 150 items, 5 min TTL

// Request debouncer - prevents rapid duplicate requests
class RequestDebouncer {
  constructor(delay = 300) {
    this.timers = new Map();
    this.delay = delay;
  }

  debounce(key, callback, customDelay = this.delay) {
    // Clear existing timer for this key
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, customDelay);

    this.timers.set(key, timer);
  }

  cancel(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  cancelAll() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

// Global debouncer
const requestDebouncer = new RequestDebouncer(300);

// Lazy load images with Intersection Observer
class LazyImageLoader {
  constructor() {
    this.observer = null;
    this.init();
  }

  init() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });
    }
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    img.src = src;
    img.removeAttribute('data-src');
    img.classList.add('loaded');
  }

  observe(img) {
    if (this.observer && img.dataset.src) {
      this.observer.observe(img);
    } else {
      // Fallback for browsers without IntersectionObserver
      this.loadImage(img);
    }
  }

  observeAll(selector = 'img[data-src]') {
    const images = document.querySelectorAll(selector);
    images.forEach(img => this.observe(img));
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Global lazy loader
const lazyImageLoader = new LazyImageLoader();

// Optimize images before upload
async function optimizeImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, file.type, quality);
    };

    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert blob to base64 for upload
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Batch multiple API requests
class RequestBatcher {
  constructor(batchDelay = 50) {
    this.queue = [];
    this.batchDelay = batchDelay;
    this.timer = null;
  }

  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      
      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(() => this.flush(), this.batchDelay);
    });
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    // Execute all requests in parallel
    const results = await Promise.allSettled(
      batch.map(item => item.request())
    );

    // Resolve/reject based on results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        batch[index].resolve(result.value);
      } else {
        batch[index].reject(result.reason);
      }
    });
  }
}

// Global request batcher
const requestBatcher = new RequestBatcher(50);

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0
    };
  }

  recordAPICall(responseTime) {
    this.metrics.apiCalls++;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.apiCalls - 1) + responseTime) / this.metrics.apiCalls;
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  getStats() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
    };
  }

  reset() {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0
    };
  }
}

// Global performance monitor
const perfMonitor = new PerformanceMonitor();

// Export for use in main app
if (typeof window !== 'undefined') {
  window.FrontendPerformance = {
    cache: frontendCache,
    debouncer: requestDebouncer,
    lazyLoader: lazyImageLoader,
    batcher: requestBatcher,
    monitor: perfMonitor,
    optimizeImage,
    blobToBase64
  };
}
