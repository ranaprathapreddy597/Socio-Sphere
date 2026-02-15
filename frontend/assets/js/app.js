/* =========================================
  SocioSphere "God Level" Logic
  ========================================= */
// Build/version stamp to help cache-busting verification in the browser console

/* Phase 2: Theme Persistence (Apply Immediately on Page Load) */
(function() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();

// Utility: Theme Manager
const themeManager = {
  current: localStorage.getItem('theme') || 'dark',
  
  toggle: function() {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    this.apply();
    return this.current;
  },
  
  set: function(theme) {
    if (['dark', 'light'].includes(theme)) {
      this.current = theme;
      this.apply();
    }
  },
  
  apply: function() {
    document.documentElement.setAttribute('data-theme', this.current);
    localStorage.setItem('theme', this.current);
  }
};

// Local fallback GIFs (public domain / stable hosts) used when Giphy is blocked or offline
const FALLBACK_GIFS = [
  'https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif',
  'https://upload.wikimedia.org/wikipedia/commons/8/87/Pluto_animation.gif',
  'https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.gif',
  'https://upload.wikimedia.org/wikipedia/commons/1/12/Spinning_animated_gif_of_a_smiley_face.gif',
  'https://upload.wikimedia.org/wikipedia/commons/4/47/Animated_PNG_example_bouncing_beach_ball.png'
];

// Utility: Relative Time Formatter
function getRelativeTime(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return past.toLocaleDateString();
}

// Utility: Get notification icon based on content
function getNotificationIcon(content) {
  const lower = content.toLowerCase();
  if (lower.includes('liked your post') || lower.includes('liked')) return { icon: 'fa-heart', color: '#f43f5e' };
  if (lower.includes('commented')) return { icon: 'fa-comment', color: '#6366f1' };
  if (lower.includes('joined') || lower.includes('requested to join')) return { icon: 'fa-user-plus', color: '#10b981' };
  if (lower.includes('followed')) return { icon: 'fa-user-check', color: '#8b5cf6' };
  if (lower.includes('mentioned')) return { icon: 'fa-at', color: '#f59e0b' };
  if (lower.includes('shared')) return { icon: 'fa-share', color: '#06b6d4' };
  return { icon: 'fa-bell', color: 'var(--text-muted)' };
}

// Utility: Generate skeleton post loader
function generateSkeletonPost() {
  return `
    <div class="skeleton-post">
      <div class="skeleton-post-header">
        <div class="skeleton-post-avatar"></div>
        <div class="skeleton-post-author">
          <div class="skeleton-post-name"></div>
          <div class="skeleton-post-time"></div>
        </div>
      </div>
      <div class="skeleton-post-content">
        <div class="skeleton-post-line"></div>
        <div class="skeleton-post-line"></div>
        <div class="skeleton-post-line short"></div>
      </div>
      <div class="skeleton-post-image"></div>
    </div>
  `;
}

// Utility: Generate multiple skeleton posts
function generateSkeletonFeed(count = 3) {
  return Array(count).fill(null).map(() => generateSkeletonPost()).join('');
}

/* ============ COMMAND PALETTE ============ */

const commandPalette = {
  isOpen: false,
  selectedIndex: 0,
  filteredCommands: [],
  recentCommands: JSON.parse(localStorage.getItem('recentCommands') || '[]'),
  lastKeyPress: null,
  lastKeyTime: 0,
  
  commands: [
    // Navigation
    { category: 'Navigation', title: 'Go to Home', description: 'View your home feed', icon: 'home', action: () => navigate('home'), shortcut: 'G then H', keys: ['g', 'h'], keywords: ['home', 'feed', 'timeline'] },
    { category: 'Navigation', title: 'Go to Explore', description: 'Discover trending content', icon: 'compass', action: () => navigate('explore'), shortcut: 'G then E', keys: ['g', 'e'], keywords: ['explore', 'discover', 'trending', 'search'] },
    { category: 'Navigation', title: 'Go to Trips', description: 'View travel plans', icon: 'plane', action: () => navigate('trips'), shortcut: 'G then T', keys: ['g', 't'], keywords: ['trips', 'travel', 'journey', 'plans'] },
    { category: 'Navigation', title: 'Go to Messages', description: 'View conversations', icon: 'message-circle', action: () => navigate('messages'), shortcut: 'G then M', keys: ['g', 'm'], keywords: ['messages', 'chat', 'conversations', 'dm'] },
    
    // Actions
    { category: 'Actions', title: 'Create Post', description: 'Compose a new post', icon: 'edit', action: () => { setTimeout(() => document.getElementById('postInput')?.focus(), 100); }, shortcut: 'C then P', keys: ['c', 'p'], keywords: ['post', 'create', 'compose', 'write'] },
    { category: 'Actions', title: 'Create Story', description: 'Share a new story', icon: 'camera', action: () => { setTimeout(() => document.getElementById('btnNewStory')?.click(), 100); }, shortcut: 'C then S', keys: ['c', 's'], keywords: ['story', 'share', 'photo'] },
    { category: 'Actions', title: 'Start Trip', description: 'Plan a new trip', icon: 'map', action: () => { navigate('trips'); setTimeout(() => document.getElementById('btnNewTrip')?.click(), 200); }, shortcut: 'C then T', keys: ['c', 't'], keywords: ['trip', 'plan', 'travel', 'journey'] },
    
    // Theme
    { category: 'Theme', title: 'Toggle Theme', description: `Switch to ${themeManager.current === 'dark' ? 'light' : 'dark'} mode`, icon: 'moon', action: () => themeManager.toggle(), shortcut: 'Alt+T', keys: null, keywords: ['theme', 'dark', 'light', 'mode'] },
    
    // Help
    { category: 'Help', title: 'Show Keyboard Shortcuts', description: 'View all available shortcuts', icon: 'keyboard', action: () => showKeyboardShortcuts(), shortcut: '?', keys: null, keywords: ['shortcuts', 'keyboard', 'help', 'keys'] },
    { category: 'Help', title: 'Open Feedback', description: 'Send us your thoughts', icon: 'message-square', action: () => alert('Thank you for using SocioSphere!'), shortcut: 'Alt+F', keys: null, keywords: ['feedback', 'support', 'help', 'contact'] }
  ],
  
  init: function() {
    this.createUI();
    this.bindEvents();
  },
  
  createUI: function() {
    if (document.getElementById('commandPaletteOverlay')) return; // Already exists
    
    const overlay = document.createElement('div');
    overlay.id = 'commandPaletteOverlay';
    overlay.className = 'command-palette-overlay';
    overlay.innerHTML = `
      <div class="command-palette">
        <div class="command-palette-header">
          <input 
            type="text" 
            class="command-palette-input" 
            id="commandPaletteInput" 
            placeholder="Search commands... (type to filter)" 
            autocomplete="off"
          />
        </div>
        <div class="command-palette-results" id="commandPaletteResults"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  },
  
  bindEvents: function() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts if user is typing in input/textarea
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      
      // Ctrl+K or Cmd+K to open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
        return;
      }
      
      // Alt+T for theme toggle
      if (e.altKey && e.key === 't' && !this.isOpen && !isTyping) {
        e.preventDefault();
        themeManager.toggle();
        return;
      }
      
      // Alt+F for feedback
      if (e.altKey && e.key === 'f' && !this.isOpen && !isTyping) {
        e.preventDefault();
        alert('Thank you for using SocioSphere!');
        return;
      }
      
      // ? to show help
      if (e.key === '?' && !this.isOpen && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault();
        showKeyboardShortcuts();
        return;
      }
      
      // Two-key shortcuts (G then H, C then P, etc.) - only when not in input
      if (!this.isOpen && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        const now = Date.now();
        
        // Reset if more than 1 second has passed
        if (now - this.lastKeyTime > 1000) {
          this.lastKeyPress = null;
        }
        
        // Check for two-key sequence
        this.commands.forEach(cmd => {
          if (cmd.keys && cmd.keys.length === 2) {
            // First key pressed
            if (key === cmd.keys[0] && !this.lastKeyPress) {
              e.preventDefault();
              this.lastKeyPress = key;
              this.lastKeyTime = now;
            }
            // Second key pressed after first key
            else if (key === cmd.keys[1] && this.lastKeyPress === cmd.keys[0]) {
              e.preventDefault();
              this.lastKeyPress = null;
              cmd.action();
            }
          }
        });
      }
      
      // Navigation within palette
      if (this.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectNext();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectPrev();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.execute();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        }
      }
    });
    
    const input = document.getElementById('commandPaletteInput');
    if (input) {
      input.addEventListener('input', (e) => this.filter(e.target.value));
    }
    
    const overlay = document.getElementById('commandPaletteOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }
  },
  
  toggle: function() {
    this.isOpen ? this.close() : this.open();
  },
  
  open: function() {
    this.isOpen = true;
    const overlay = document.getElementById('commandPaletteOverlay');
    if (overlay) {
      overlay.classList.add('active');
      this.render();
      const input = document.getElementById('commandPaletteInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      this.selectedIndex = 0;
      this.filteredCommands = [...this.commands];
      this.render();
    }
  },
  
  close: function() {
    this.isOpen = false;
    const overlay = document.getElementById('commandPaletteOverlay');
    if (overlay) overlay.classList.remove('active');
  },
  
  filter: function(query) {
    if (!query.trim()) {
      // Show recent + all when empty
      this.filteredCommands = this.getRecentAndAll();
      this.selectedIndex = 0;
      this.render();
      return;
    }
    
    const lower = query.toLowerCase();
    
    // Fuzzy match implementation
    const fuzzyMatch = (text, search) => {
      let searchIndex = 0;
      let textIndex = 0;
      let score = 0;
      const textLower = text.toLowerCase();
      
      while (searchIndex < search.length && textIndex < textLower.length) {
        if (textLower[textIndex] === search[searchIndex]) {
          score += (textIndex === searchIndex) ? 2 : 1; // Bonus for sequential match
          searchIndex++;
        }
        textIndex++;
      }
      
      return searchIndex === search.length ? score : 0;
    };
    
    // Score and filter commands
    const scored = this.commands.map(cmd => {
      const titleScore = fuzzyMatch(cmd.title, lower);
      const descScore = fuzzyMatch(cmd.description, lower) * 0.8;
      const keywordScore = (cmd.keywords || []).reduce((max, kw) => 
        Math.max(max, fuzzyMatch(kw, lower) * 0.6), 0);
      
      return {
        cmd,
        score: titleScore + descScore + keywordScore
      };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.cmd);
    
    this.filteredCommands = scored;
    this.selectedIndex = 0;
    this.render(query);
  },
  
  getRecentAndAll: function() {
    const recent = this.recentCommands
      .map(title => this.commands.find(cmd => cmd.title === title))
      .filter(Boolean)
      .slice(0, 3);
    
    return [...recent, ...this.commands];
  },
  
  highlightMatch: function(text, query) {
    if (!query) return text;
    
    const lower = text.toLowerCase();
    const searchLower = query.toLowerCase();
    let result = '';
    let lastIndex = 0;
    let searchIndex = 0;
    
    for (let i = 0; i < text.length && searchIndex < searchLower.length; i++) {
      if (lower[i] === searchLower[searchIndex]) {
        if (i > lastIndex) {
          result += text.substring(lastIndex, i);
        }
        result += `<mark class="highlight-match">${text[i]}</mark>`;
        lastIndex = i + 1;
        searchIndex++;
      }
    }
    
    result += text.substring(lastIndex);
    return result;
  },
  
  getIconSVG: function(iconName) {
    const icons = {
      'home': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      'compass': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
      'plane': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
      'message-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      'camera': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
      'map': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" x2="8" y1="2" y2="18"/><line x1="16" x2="16" y1="6" y2="22"/></svg>',
      'moon': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
      'keyboard': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" ry="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/></svg>',
      'message-square': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    };
    return icons[iconName] || icons['home'];
  },
  
  render: function(query = '') {
    const resultsEl = document.getElementById('commandPaletteResults');
    if (!resultsEl) return;
    
    if (this.filteredCommands.length === 0) {
      resultsEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No commands found</div>';
      return;
    }
    
    let currentCategory = '';
    let html = '';
    let recentShown = false;
    
    this.filteredCommands.forEach((cmd, idx) => {
      // Show "Recent" category for first 3 items if no search
      if (!query && idx < this.recentCommands.length && !recentShown && this.recentCommands.includes(cmd.title)) {
        if (idx === 0) {
          html += `<div class="command-category">Recent</div>`;
          recentShown = true;
        }
      } else if (cmd.category !== currentCategory && (query || idx >= this.recentCommands.length || !this.recentCommands.includes(cmd.title))) {
        currentCategory = cmd.category;
        html += `<div class="command-category">${currentCategory}</div>`;
      }
      
      const isSelected = idx === this.selectedIndex;
      const titleHTML = query ? this.highlightMatch(cmd.title, query) : cmd.title;
      const descHTML = query ? this.highlightMatch(cmd.description, query) : cmd.description;
      
      html += `
        <div class="command-item ${isSelected ? 'selected' : ''}" data-index="${idx}">
          <div class="command-icon">${this.getIconSVG(cmd.icon)}</div>
          <div class="command-content">
            <div class="command-title">${titleHTML}</div>
            <div class="command-description">${descHTML}</div>
          </div>
          <div class="command-shortcut">${cmd.shortcut}</div>
        </div>
      `;
    });
    
    resultsEl.innerHTML = html;
    
    // Add click handlers
    resultsEl.querySelectorAll('.command-item').forEach((item, idx) => {
      item.addEventListener('click', () => {
        this.selectedIndex = idx;
        this.execute();
      });
    });
    
    // Auto-scroll selected item into view
    this.scrollToSelected();
  },
  
  selectNext: function() {
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
    this.render();
    this.scrollToSelected();
  },
  
  selectPrev: function() {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.render();
    this.scrollToSelected();
  },
  
  scrollToSelected: function() {
    const resultsEl = document.getElementById('commandPaletteResults');
    if (!resultsEl) return;
    
    const selected = resultsEl.querySelector('.command-item.selected');
    if (selected) {
      selected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },
  
  execute: function() {
    if (this.filteredCommands[this.selectedIndex]) {
      const cmd = this.filteredCommands[this.selectedIndex];
      
      // Track recent command
      this.recentCommands = this.recentCommands.filter(t => t !== cmd.title);
      this.recentCommands.unshift(cmd.title);
      this.recentCommands = this.recentCommands.slice(0, 5); // Keep last 5
      localStorage.setItem('recentCommands', JSON.stringify(this.recentCommands));
      
      // Execute action
      cmd.action();
      this.close();
    }
  }
};

function showKeyboardShortcuts() {
  const shortcuts = [
    { key: 'Ctrl+K', desc: 'Open Command Palette' },
    { key: 'G then H', desc: 'Go to Home' },
    { key: 'G then E', desc: 'Go to Explore' },
    { key: 'G then T', desc: 'Go to Trips' },
    { key: 'G then M', desc: 'Go to Messages' },
    { key: 'C then P', desc: 'Create Post' },
    { key: 'C then S', desc: 'Create Story' },
    { key: 'C then T', desc: 'Start Trip' },
    { key: 'Alt+T', desc: 'Toggle Theme' },
    { key: 'Alt+F', desc: 'Open Feedback' },
    { key: '?', desc: 'Show This Help' },
    { key: 'Esc', desc: 'Close Modals' }
  ];
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'keyboard-shortcuts-overlay';
  overlay.innerHTML = `
    <div class="keyboard-shortcuts-modal">
      <div class="keyboard-shortcuts-header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <button class="keyboard-shortcuts-close" onclick="this.closest('.keyboard-shortcuts-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="keyboard-shortcuts-body">
        ${shortcuts.map(s => `
          <div class="keyboard-shortcut-item">
            <kbd class="keyboard-shortcut-key">${s.key}</kbd>
            <span class="keyboard-shortcut-desc">${s.desc}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}
const DEV_FRONTEND_PORTS = new Set(['3000', '4173', '5173', '5500', '8000', '8080']);
function inferDefaultApi() {
  try {
    const { protocol, hostname, port, origin } = window.location;
    const saved = localStorage.getItem('api_base');
    if (saved) return saved;
    if (!hostname) {
      return 'http://localhost:5001/api';
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:5001/api`;
    }
    if (DEV_FRONTEND_PORTS.has(port)) {
      return `${protocol}//${hostname}:5001/api`;
    }
    return `${origin}/api`;
  } catch (err) {
    console.warn('API inference failed, falling back to localhost:', err);
    return 'http://localhost:5001/api';
  }
}

const DEFAULT_API = inferDefaultApi();
let API_URL = DEFAULT_API;
// Scope tokens per API base to avoid cross-server invalidation
function getTokenKey(base) {
  try {
    const u = new URL(base);
    return `authToken::${u.protocol}//${u.host}`;
  } catch (_) {
    return `authToken::${base}`;
  }
}
function loadTokenForBase(base) {
  try { return localStorage.getItem(getTokenKey(base)) || null; } catch (_) { return null; }
}
function saveTokenForBase(base, token) {
  try { localStorage.setItem(getTokenKey(base), token); } catch (_) { }
}
function clearTokenForBase(base) {
  try { localStorage.removeItem(getTokenKey(base)); } catch (_) { }
}
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Toggle to remove media upload options across the UI
// Set to false to enable composer/story uploads by default
const DISABLE_MEDIA = false;
const DISABLE_AI = false;
const DISABLE_POST_AI = true;
// TURN configuration (set after starting your TURN server)
// Replace these values with your actual TURN host and credentials
const TURN_ENABLED = true;
let TURN_URLS = [
  'turn:global.turn.twilio.com:3478?transport=udp',
  'turn:global.turn.twilio.com:3478?transport=tcp',
  'turn:global.turn.twilio.com:443?transport=tcp',
  // Free public TURN server as fallback
  'turn:openrelay.metered.ca:80',
  'turn:openrelay.metered.ca:443'
];
let TURN_USERNAME = '0e8d2607792ca518bbe51177d8601aca618f1d98128cf956cb1bf486a9838269';
let TURN_CREDENTIAL = 'FpXaMjdvTOrki++vzLJcE4i0AvX6UOC0iK+JyLRJVAU=';
// Free TURN credentials (openrelay.metered.ca uses 'openrelayproject')
const FREE_TURN_USERNAME = 'openrelayproject';
const FREE_TURN_CREDENTIAL = 'openrelayproject';
// Don't force TURN - try direct connection first, fallback to TURN if needed
let FORCE_TURN = false;
let DYNAMIC_ICE_SERVERS = null;

async function loadDynamicIceServers() {
  if (DYNAMIC_ICE_SERVERS) return DYNAMIC_ICE_SERVERS;
  try {
    const resp = await fetch('/api/system/ice', { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
      console.warn('⚠️ Failed to fetch dynamic ICE servers from API, using fallback');
      return null;
    }
    const data = await resp.json();
    const servers = Array.isArray(data.iceServers) ? data.iceServers : [];
    if (servers.length > 0) {
      DYNAMIC_ICE_SERVERS = servers;
      console.log('✅ Loaded', servers.length, 'dynamic ICE servers from Twilio API');
      // Don't force TURN - let WebRTC try direct connection first
      // FORCE_TURN = false; // Keep this as user configured
    } else {
      console.warn('⚠️ No ICE servers returned from API');
    }
    return DYNAMIC_ICE_SERVERS;
  } catch (err) {
    console.error('❌ Error loading dynamic ICE servers:', err.message);
    return null;
  }
}

const state = {
  token: loadTokenForBase(API_URL) || localStorage.getItem('authToken') || null,
  user: null,
  theme: localStorage.getItem('theme') || 'dark',
  view: 'home',
  activeChatId: null,
  socket: null,
  profileId: null,
  homeFilter: 'all',
  searchQuery: '',
  feedCache: [],
  stories: [],
  storySession: null,
  tickerInterval: null,
  tripCount: 0,
  inlineMedia: null,
  composerMedia: null,
  storyMedia: null,
  tripMedia: null,
  profileDraft: null,
  profileAvatarData: null,
  systemStatus: null,
  chats: [],
  shareDraft: null,
  aiChatHistory: [],
  aiChatMode: 'text',
  aiIsSending: false,
  aiTransferTarget: 'post',
  lastAiAssistantId: null,
  activeCommentInput: null,
  activeCommentPostId: null
};

function rememberCurrentUserId(id) {
  const safe = (id || '').toString();
  if (safe) {
    try {
      localStorage.setItem('currentUserId', safe);
    } catch (_) { }
  }
}

function getCurrentUserId() {
  const fromState = state.user?._id?.toString();
  if (fromState) {
    rememberCurrentUserId(fromState);
    return fromState;
  }
  try {
    return localStorage.getItem('currentUserId') || '';
  } catch (_) {
    return '';
  }
}

const AVATAR_COLORS = ['#7c5dff', '#ff7d97', '#33e1ad', '#f97316', '#38bdf8', '#fbbf24', '#f472b6', '#22d3ee'];
const callState = {
  peer: null,
  localStream: null,
  remoteStream: null,
  targetUserId: null,
  isCaller: false,
  timerInterval: null,
  callStartedAt: null,
  pendingOffer: null,
  pendingAnswer: null,
  isMuted: false,
  partner: null,
  wantVideo: false,
  cameraOn: true
};

function escapeHtml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkify(text = '') {
  try {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      const safe = url.replace(/"/g, '');
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
    });
  } catch (_) { return text; }
}

function extractSharedPostId(text = '') {
  try {
    const urls = (text.match(/https?:\/\/[^\s]+/g) || []);
    for (const raw of urls) {
      try {
        const u = new URL(raw);
        const qp = u.searchParams.get('post');
        if (qp && /^[a-f0-9]{24}$/i.test(qp)) return qp;
        const m = (u.pathname || '').match(/\/posts\/([a-f0-9]{24})/i);
        if (m && m[1]) return m[1];
      } catch (_) { /* ignore */ }
    }
    const inline = text.match(/post=([a-f0-9]{24})/i);
    if (inline && inline[1]) return inline[1];
  } catch (_) { }
  return '';
}

async function openPostPreview(postId) {
  try {
    const existing = document.getElementById('postPreviewModal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'postPreviewModal';
    overlay.className = 'modal-shell';
    const post = await apiRequest(`/posts/${postId}`, 'GET');
    const date = formatTimeAgo(post.createdAt);
    const author = post.author || {};
    overlay.innerHTML = `
      <div class="modal-card" style="max-width:560px;">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Post Preview</p>
            <h3>${escapeHtml(author.fullName || author.username || 'User')}</h3>
          </div>
          <button class="ghost-icon" id="postPreviewClose"><i class="fas fa-times"></i></button>
        </div>
        <div class="card" style="padding:16px; margin-top:12px;">
          <div class="post-header" style="display:flex; align-items:center; gap:12px;">
            ${renderAvatar(author, 44)}
            <div class="post-meta"><strong>${escapeHtml(author.fullName || author.username || 'User')}</strong><br><small style="color:var(--text-muted)">${date}</small></div>
          </div>
          <div class="post-content" style="margin-top:12px;">${escapeHtml(post.content || '')}</div>
          ${renderMedia(post.mediaUrl || post.image)}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const btn = overlay.querySelector('#postPreviewClose');
    if (btn) btn.addEventListener('click', close);
  } catch (e) {
    toast('Unable to open post', 'error');
  }
}

function getAvatarSeed(user = {}) {
  return (user.fullName || user.username || user.email || user._id || 'U').toString().toUpperCase();
}

window.openTripDetail = async function(tripId) {
  try {
    const trip = await apiRequest(`/trips/${tripId}`, 'GET');
    if (!trip) {
      toast('Trip not found', 'error');
      return;
    }
    
    const myId = state?.user?._id?.toString();

  // Lightweight story view placeholder for live trips
  window.openTripStory = function(tripId) {
    try {
      const overlay = document.createElement('div');
      overlay.className = 'post-preview-overlay';
      overlay.innerHTML = `
        <div class="post-preview-container" role="dialog" aria-label="Live trip story">
          <button class="modal-close" id="tripStoryClose"><i class="fas fa-times"></i></button>
          <div style="display:flex;flex-direction:column;gap:12px;padding:6px 2px 0 2px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="live-pill" style="margin:0;">LIVE</div>
              <strong style="color:var(--text-main);">Trip Stories</strong>
            </div>
            <p style="color:var(--text-secondary);margin:0;">Live stories for this trip will appear here. For now, you can view trip details.</p>
            <button class="btn primary" onclick="window.openTripDetail('${tripId}')">View trip details</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const close = () => overlay.remove();
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelector('#tripStoryClose')?.addEventListener('click', close);
    } catch (e) {
      console.warn('openTripStory fallback error', e);
      window.openTripDetail(tripId);
    }
  };
    const isHost = myId && (trip.host?._id?.toString() === myId || trip.host?.toString() === myId);
    const isParticipant = Array.isArray(trip.participants) && trip.participants.some(p => {
      const userId = (p?.user?._id || p?.user)?.toString();
      return myId && userId === myId && ['host', 'confirmed'].includes(p.status);
    });
    
    const participantsCount = trip.participants?.length || 0;
    const maxParticipants = trip.maxParticipants || 8;
    const startDate = trip.startDate ? new Date(trip.startDate).toLocaleDateString() : 'TBD';
    const endDate = trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'TBD';
    const costStr = trip.estimatedCost ? `₹${trip.estimatedCost.toLocaleString()}` : 'Price TBD';
    const destination = trip.destination?.city || trip.destination || trip.title || 'Destination';
    
    const overlay = document.createElement('div');
    overlay.classList.add('post-preview-overlay');
    overlay.innerHTML = `
      <div class="post-preview-container" style="max-width: 700px;">
        <button class="modal-close" onclick="this.closest('.post-preview-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
        <div style="padding: 24px;">
          ${trip.coverImage ? `<img src="${trip.coverImage}" style="width:100%; height:300px; object-fit:cover; border-radius:16px; margin-bottom:20px;" alt="${destination}" onerror="this.style.display='none';">` : ''}
          <h2 style="margin-bottom:12px;">${escapeHtml(trip.title || 'Untitled Trip')}</h2>
          <h3 style="color:var(--primary); margin-bottom:16px;">${escapeHtml(destination)}${trip.destination?.country ? ', ' + escapeHtml(trip.destination.country) : ''}</h3>
          <p style="margin-bottom:20px; line-height:1.6;">${escapeHtml(trip.description || 'No description available.')}</p>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
            <div style="padding:16px; background:var(--glass); border-radius:12px;">
              <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:4px;">📅 Duration</div>
              <div style="font-weight:600;">${startDate} - ${endDate}</div>
            </div>
            <div style="padding:16px; background:var(--glass); border-radius:12px;">
              <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:4px;">👥 Participants</div>
              <div style="font-weight:600;">${participantsCount}/${maxParticipants}</div>
            </div>
            <div style="padding:16px; background:var(--glass); border-radius:12px;">
              <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:4px;">💰 Estimated Cost</div>
              <div style="font-weight:600;">${costStr}</div>
            </div>
            <div style="padding:16px; background:var(--glass); border-radius:12px;">
              <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:4px;">📍 Location</div>
              <div style="font-weight:600;">${escapeHtml(destination)}</div>
            </div>
          </div>
          
          ${trip.contactPhone ? `<p style="margin-bottom:16px;"><i class="fas fa-phone" style="color:var(--primary); margin-right:8px;"></i>${escapeHtml(trip.contactPhone)}</p>` : ''}
          
          <div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">
            ${isHost ? `
              <button class="btn secondary" onclick="window.openTripDashboard('${trip._id}')"><i class="fas fa-columns"></i> Dashboard</button>
              <button class="btn secondary" onclick="window.openTripMap('${trip._id}')"><i class="fas fa-map"></i> Map</button>
              <button class="btn danger" onclick="if(confirm('Delete this trip?')) { window.deleteTrip('${trip._id}'); document.querySelector('.post-preview-overlay').remove(); }"><i class="fas fa-trash"></i> Delete</button>
            ` : isParticipant ? `
              <button class="btn secondary" onclick="window.openTripDashboard('${trip._id}')"><i class="fas fa-columns"></i> Dashboard</button>
              <button class="btn secondary" onclick="window.openTripMap('${trip._id}')"><i class="fas fa-map"></i> Map</button>
              <button class="btn danger" onclick="if(confirm('Leave this trip?')) { window.leaveTrip('${trip._id}'); document.querySelector('.post-preview-overlay').remove(); }"><i class="fas fa-sign-out-alt"></i> Leave</button>
            ` : participantsCount >= maxParticipants ? `
              <button class="btn secondary" disabled><i class="fas fa-hourglass-half"></i> Trip Full</button>
            ` : `
              <button class="btn primary" onclick="window.joinTrip('${trip._id}'); document.querySelector('.post-preview-overlay').remove();"><i class="fas fa-plus"></i> Join Trip</button>
            `}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  } catch (e) {
    console.error('Trip detail error:', e);
    toast('Failed to load trip details', 'error');
  }
};

function getAvatarColor(seed = 'U') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function renderAvatar(user = {}, size = 44) {
  const seed = getAvatarSeed(user);
  const initials = getInitials(user);
  const src = (user.profilePicture || '').toString();
  const hasImg = src && !/placeholder\.com/i.test(src);
  if (hasImg) {
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(user.username || 'User')}" class="avatar-img" loading="lazy" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover;">`;
  }
  const fontSize = Math.max(12, Math.floor(size * 0.42));
  return `<div style="width:${size}px; height:${size}px; border-radius:50%; background:${getAvatarColor(seed)}; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:${fontSize}px;">${initials}</div>`;
}

function setAvatarElement(el, user) {
  if (!el) return;
  const src = (user?.profilePicture || '').toString();
  const hasImg = src && !/placeholder\.com/i.test(src);
  if (hasImg) {
    el.style.backgroundImage = `url('${src}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.color = 'transparent';
    el.textContent = '';
  } else {
    // For single-element avatars (header/composer), use solid background + initials
    el.style.backgroundImage = 'none';
    const seed = getAvatarSeed(user);
    const initials = getInitials(user);
    el.style.backgroundColor = getAvatarColor(seed);
    el.style.color = '#fff';
    el.style.borderRadius = '50%';
    el.textContent = initials;
  }
}

function getInitials(user = {}) {
  const name = (user.fullName || user.username || '').trim();
  if (!name) return getAvatarSeed(user).charAt(0);
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || '';
  const second = (parts.length > 1 ? parts[1].charAt(0) : (user.username || '').charAt(1)) || '';
  return (first + second).toUpperCase() || (name.charAt(0).toUpperCase());
}

function refreshPrimaryAvatars() {
  const headerAvatar = document.getElementById('headerAvatar');
  const composerAvatar = document.getElementById('composerAvatar');
  setAvatarElement(headerAvatar, state.user);
  setAvatarElement(composerAvatar, state.user);
}

function isFollowingUser(targetId) {
  if (!state.user?.following || !targetId) return false;
  const target = targetId.toString();
  return state.user.following.some(followId => {
    if (!followId) return false;
    const followIdStr = typeof followId === 'object'
      ? (followId._id?.toString() || followId.toString())
      : followId.toString();
    return followIdStr === target;
  });
}

/* ====== SEARCH UTILITIES ====== */
function highlightMatch(text, query) {
  if (!query || query.length < 2) return escapeHtml(text);
  const regex = new RegExp(`(${query})`, 'gi');
  return escapeHtml(text).replace(regex, '<strong style="color: var(--primary); font-weight: 700;">$1</strong>');
}
function createSkeletonLoader(type = 'card', count = 3) {
  let html = '<div class="feed-loading">';
  for (let i = 0; i < count; i++) {
    if (type === 'card') {
      html += `
        <div class="card skeleton-loading">
          <div class="skeleton skeleton-card" style="height: 160px; margin-bottom: 12px;"></div>
          <div style="padding: 12px;">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text" style="width: 80%;"></div>
            <div class="skeleton skeleton-text" style="width: 60%; margin-top: 8px;"></div>
          </div>
        </div>
      `;
    } else if (type === 'post') {
      html += `
        <div class="card skeleton-loading">
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px;">
            <div class="skeleton skeleton-avatar"></div>
            <div style="flex: 1;">
              <div class="skeleton skeleton-title" style="width: 120px;"></div>
              <div class="skeleton skeleton-text" style="width: 80px; margin-top: 4px;"></div>
            </div>
          </div>
          <div style="padding: 12px;">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 90%;"></div>
            <div class="skeleton skeleton-card" style="height: 200px; margin-top: 12px;"></div>
          </div>
        </div>
      `;
    } else if (type === 'message') {
      html += `
        <div class="msg skeleton-loading" style="margin-bottom: 12px;">
          <div class="skeleton" style="height: 24px; width: 200px; border-radius: 12px;"></div>
        </div>
      `;
    }
  }
  html += '</div>';
  return html;
}

function registerConnectivityListeners() {
  window.addEventListener('offline', () => toast('Connection lost. Some actions may fail.', 'error'));
  window.addEventListener('online', () => toast('Back online. Syncing…'));
}

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  registerConnectivityListeners();
  initAuthTabs();
  initPasswordToggles();
  setupEvents();

  if (state.token) {
    try {
      await fetchUser();
      initApp();
    } catch (e) {
      console.warn('Session restore failed:', e.message || e);
      // Clear invalid token and show auth immediately
      logout();
    }
  } else {
    showAuth();
  }
});

// --- Theme Management ---
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.body.setAttribute('data-theme', state.theme);
  const btnIcon = document.querySelector('#btnThemeToggle i');
  if (btnIcon) {
    // Show moon icon for dark, sun for light
    btnIcon.className = state.theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', state.theme);
  themeManager.current = state.theme;
  themeManager.apply();
  applyTheme();
}

function initAuthTabs() {
  const tabs = document.querySelectorAll('[data-auth-tab]');
  const forms = {
    signin: document.getElementById('formSignin'),
    signup: document.getElementById('formSignup'),
    otp: document.getElementById('formOtp')
  };
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(btn => btn.classList.remove('active'));
      tab.classList.add('active');
      Object.values(forms).forEach(form => form?.classList.add('hidden'));
      const form = forms[tab.dataset.authTab];
      if (form) {
        form.classList.remove('hidden');
        // Clear OTP inputs when switching to OTP tab
        if (tab.dataset.authTab === 'otp') {
          document.querySelectorAll('.otp-inputs input').forEach(input => input.value = '');
        }
      }
    });
  });
}

function initPasswordToggles() {
  const toggles = document.querySelectorAll('.password-toggle');
  toggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      if (!targetId) return;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPlain = input.type === 'text';
      input.type = isPlain ? 'password' : 'text';
      btn.setAttribute('aria-pressed', String(!isPlain));
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPlain ? 'fas fa-eye' : 'fas fa-eye-slash';
      }
    });
  });
}

// --- Core Navigation ---
function navigate(target) {
  state.view = target;

  // 0. Trigger page transition animation
  const container = document.querySelector('.content-view');
  if (container) {
    container.style.animation = 'none';
    // Trigger reflow to restart animation
    void container.offsetWidth;
    container.style.animation = 'fadeUpIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  // 1. Update Sidebar Active State
  document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-link[data-target="${target}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // 2. Switch View Containers
  document.querySelectorAll('.content-view > section').forEach(el => el.classList.add('hidden'));
  const targetView = document.getElementById(`view-${target}`);
  if (targetView) targetView.classList.remove('hidden');

  // 3. Update Header Title
  const titles = {
    home: 'Home',
    explore: 'Explore',
    trips: 'Trips',
    leaderboard: 'Leaderboard',
    messages: 'Messages',
    notifications: 'Activity',
    profile: 'Profile',
    admin: 'Command Center'
  };
  const subtitles = {
    home: 'Curated for you',
    explore: 'Discover new creators + destinations',
    trips: 'Join or create your next adventure',
    leaderboard: 'Top creators based on post likes',
    messages: 'Stay synced with squads',
    notifications: 'Realtime signals',
    profile: 'Your public persona'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[target] || 'SocioSphere';
  const subEl = document.getElementById('pageSubtitle');
  if (subEl) subEl.textContent = subtitles[target] || 'Socio OS';

  // 4. Trigger Data Loads (parallel where possible)
  if (target === 'home') {
    Promise.allSettled([
      loadFeed(),
      loadStories(),
      refreshUnreadNotifications()
    ]);
  }
  if (target === 'explore') loadExplore();
  if (target === 'trips') loadTrips();
  if (target === 'leaderboard') loadLeaderboard();
  if (target === 'messages') loadChats();
  if (target === 'notifications') loadNotifications();
  if (target === 'profile') {
    // Only load current user's profile if no specific profileId is set
    if (!state.user) {
      toast('Please log in first', 'error');
      navigate('home');
      return;
    }
    const profileToLoad = state.profileId || state.user._id;
    loadProfile(profileToLoad);
  }
  syncMobileNavActive(target);
  adjustFabForView(target);
}

function initApp() {
  document.getElementById('authShell').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav) mobileNav.classList.remove('hidden');
  const fab = document.getElementById('composeFab');
  if (fab) fab.classList.remove('hidden');
  setLiveStatus(false);

  // Set Avatar in Header
  refreshPrimaryAvatars();

  // Initialize Command Palette
  commandPalette.init();

  // Initialize infinite scroll
  initInfiniteScroll();

  // Connect Realtime
  connectSocket();

  // Load initial data
  checkSystemStatus();
  // Start at Home with parallel fetches for faster ready state
  navigate('home');
  Promise.allSettled([
    loadStories(),
    refreshUnreadNotifications()
  ]);
  setTimeout(resolveDeeplinkPost, 300);
  initMobileMenu();
  if (!DISABLE_AI) {
    initAiFab();
    setTimeout(() => {
      try {
        hydrateAiCompanion(document.getElementById('postInput')?.value || '');
      } catch (_) { /* ignore companion warmup errors */ }
    }, 800);
  }
}

// --- Event Listeners ---
function setupEvents() {
  // Global Clicks (Delegation)
  document.body.addEventListener('click', handleGlobalClicks);
  const modalFeed = document.getElementById('profileModalFeed');
  if (modalFeed) modalFeed.addEventListener('click', handleGlobalClicks);

  // Global Keydowns (Delegation)
  document.body.addEventListener('keydown', handleGlobalKeydowns);

  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    const debouncedSearch = debounce((event) => updateSearch(event.target.value), 300);
    searchInput.addEventListener('input', debouncedSearch);
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.length >= 2) {
        const resultsEl = document.getElementById('searchResults');
        if (resultsEl) resultsEl.classList.remove('hidden');
      }
    });
  }
  const clearBtn = document.getElementById('btnClearSearch');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      updateSearch('');
      const resultsEl = document.getElementById('searchResults');
      if (resultsEl) resultsEl.classList.add('hidden');
    });
  }

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    const searchContainer = document.getElementById('searchBarContainer');
    const resultsEl = document.getElementById('searchResults');
    if (searchContainer && resultsEl && !searchContainer.contains(e.target)) {
      resultsEl.classList.add('hidden');
    }
  });

  document.addEventListener('focusin', (e) => {
    if (e.target?.classList?.contains('comment-input')) {
      state.activeCommentInput = e.target;
      state.activeCommentPostId = e.target.dataset.id || null;
    }
  });

  // Static Buttons
  const themeToggle = document.getElementById('btnThemeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  const translatorBtn = document.getElementById('btnTranslator');
  if (translatorBtn) translatorBtn.addEventListener('click', openTranslator);
  const keyboardHelpBtn = document.getElementById('btnKeyboardHelp');
  if (keyboardHelpBtn) keyboardHelpBtn.addEventListener('click', () => commandPalette.toggle());

  const composerAiBar = document.getElementById('composerAiBar');
  const aiIdeaStrip = document.getElementById('aiIdeaStrip');
  const aiCompanionCard = document.getElementById('aiCompanionCard');
  [composerAiBar, aiIdeaStrip, aiCompanionCard].forEach(el => el && el.classList.add('hidden'));
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const notifBtn = document.getElementById('btnNotifications');
  if (notifBtn) notifBtn.addEventListener('click', () => navigate('notifications'));
  const headerAvatar = document.getElementById('headerAvatar');
  if (headerAvatar) headerAvatar.addEventListener('click', () => navigate('profile'));
  const prefsBtn = document.getElementById('btnPreferences');
  if (prefsBtn) prefsBtn.addEventListener('click', configureApiEndpoint);
  const aiFab = document.getElementById('aiFab');
  if (aiFab) aiFab.addEventListener('click', openAiModal);

  // Sidebar Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => navigate(link.dataset.target));
  });

  // Auth Forms
  const signinForm = document.getElementById('formSignin');
  if (signinForm) signinForm.addEventListener('submit', (e) => handleAuth(e, '/auth/login'));
  const signupForm = document.getElementById('formSignup');
  if (signupForm) signupForm.addEventListener('submit', (e) => handleAuth(e, '/auth/register'));

  // Post Creation
  const postBtn = document.getElementById('btnPost');
  if (postBtn) postBtn.addEventListener('click', createPost);

  // Send Message
  const messageForm = document.getElementById('formSendMsg');
  if (messageForm) messageForm.addEventListener('submit', sendMessage);

  // AI Generation
  const aiBtn = document.getElementById('btnAiGen');
  if (!DISABLE_AI && aiBtn) aiBtn.addEventListener('click', generateAiPost);

  const inlineUploadBtn = document.getElementById('btnInlineUpload');
  const inlineInput = document.getElementById('inlineMediaInput');
  if (inlineUploadBtn && inlineInput) {
    inlineUploadBtn.addEventListener('click', () => inlineInput.click());
    inlineInput.addEventListener('change', (e) => handleMediaSelection(e.target.files, 'inline'));
  }
  // Optionally hide media options across the UI, but keep chat media/GIF functional
  if (DISABLE_MEDIA) {
    try {
      inlineUploadBtn?.classList?.add('hidden');
      inlineInput?.removeEventListener && inlineInput.removeEventListener('change', (e) => handleMediaSelection(e.target.files, 'inline'));
      const composerDrop = document.getElementById('composerDropzone');
      const storyDrop = document.getElementById('storyDropzone');
      const composerFileInput = document.getElementById('composerFileInput');
      const storyFileInput = document.getElementById('storyFileInput');
      // Keep chat file & gif controls available even when global media is disabled
      const gifPickerBtn = document.getElementById('btnGifPicker');
      const chatFileInput = document.getElementById('chatFileInput');
      composerDrop?.classList?.add('hidden');
      storyDrop?.classList?.add('hidden');
      composerFileInput && (composerFileInput.disabled = true);
      storyFileInput && (storyFileInput.disabled = true);
      // intentionally do NOT hide or disable chat file/GIF controls so users can share in chat
      gifPickerBtn?.classList?.add('hidden');
    } catch (e) { console.warn('Failed to hide media controls', e); }
  }
  const gifBtn = document.getElementById('btnGifPicker');
  if (gifBtn) gifBtn.addEventListener('click', () => openGifPicker());
  const inlineRemove = document.getElementById('inlineMediaRemove');
  if (inlineRemove) inlineRemove.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearMediaPreview('inline'); });

  const aiPolishBtn = document.getElementById('btnAiPolish');
  if (!DISABLE_AI && aiPolishBtn) aiPolishBtn.addEventListener('click', () => improveComposerDraft());
  const aiImproveBtn = document.getElementById('btnAiImproveText');
  if (!DISABLE_AI && aiImproveBtn) aiImproveBtn.addEventListener('click', () => improveComposerDraft());
  const aiRefreshBtn = document.getElementById('btnAiCompanionRefresh');
  if (!DISABLE_AI && aiRefreshBtn) aiRefreshBtn.addEventListener('click', () => hydrateAiCompanion(document.getElementById('postInput')?.value || ''));
  const aiIdeaRefresh = document.getElementById('btnRefreshAiIdeas');
  if (!DISABLE_AI && aiIdeaRefresh) aiIdeaRefresh.addEventListener('click', () => hydrateAiCompanion(document.getElementById('postInput')?.value || ''));
  const aiOpenSheet = document.getElementById('btnAiOpenSheet');
  if (!DISABLE_AI && !DISABLE_POST_AI && aiOpenSheet) aiOpenSheet.addEventListener('click', generateAiPost);
  const composerSparkBtn = document.getElementById('btnComposerSpark');
  if (!DISABLE_AI && !DISABLE_POST_AI && composerSparkBtn) composerSparkBtn.addEventListener('click', generateAiPost);
  const composerPolishBtn = document.getElementById('btnComposerPolish');
  if (!DISABLE_AI && !DISABLE_POST_AI && composerPolishBtn) composerPolishBtn.addEventListener('click', () => improveComposerDraft());
  const composerChatBtn = document.getElementById('btnComposerChat');
  if (!DISABLE_AI && composerChatBtn) composerChatBtn.addEventListener('click', () => {
    setAiTransferTarget('post');
    openAiModal();
  });

  if (DISABLE_AI || DISABLE_POST_AI) {
    document.body.classList.add('ai-disabled');
    document.getElementById('aiIdeaStrip')?.classList.add('hidden');
    document.getElementById('aiCompanionCard')?.classList.add('hidden');
    aiBtn?.classList.add('hidden');
    aiPolishBtn?.classList.add('hidden');
    aiImproveBtn?.classList.add('hidden');
    aiRefreshBtn?.classList.add('hidden');
    aiIdeaRefresh?.classList.add('hidden');
    aiOpenSheet?.classList.add('hidden');
    document.getElementById('composerAiBar')?.classList.add('hidden');
  } else {
    document.body.classList.remove('ai-disabled');
  }

  // Input Validation for Post Button
  const postInput = document.getElementById('postInput');
  const postButton = document.getElementById('btnPost');
  if (postInput && postButton) {
    const validatePostInput = () => {
      const content = postInput.value.trim();
      const hasMedia = Boolean(state.inlineMedia?.data);
      const isValid = content.length > 0 || hasMedia;
      postButton.disabled = !isValid;
    };
    postInput.addEventListener('input', validatePostInput);
    validatePostInput(); // Initial check
  }

  // Input Validation for AI Send Button
  const aiChatInput = document.getElementById('aiChatInput');
  const aiSendBtn = document.getElementById('aiSendBtn');
  if (aiChatInput && aiSendBtn) {
    const validateAiInput = () => {
      const content = aiChatInput.value.trim();
      aiSendBtn.disabled = content.length === 0;
    };
    aiChatInput.addEventListener('input', validateAiInput);
    validateAiInput(); // Initial check
  }

  initMobileNav();
  initCallUi();
  initDeleteUI();

  const composerInput = document.getElementById('composerFileInput');
  if (composerInput) {
    composerInput.addEventListener('change', (e) => handleMediaSelection(e.target.files, 'composer'));
  }
  const composerDropzone = document.getElementById('composerDropzone');
  if (composerDropzone) {
    composerDropzone.addEventListener('click', () => composerInput?.click());
    ['dragover', 'dragleave', 'drop'].forEach(evt => {
      composerDropzone.addEventListener(evt, (e) => handleDropEvent(e, composerDropzone));
    });
  }
  const composerRemove = document.getElementById('composerMediaRemove');
  if (composerRemove) composerRemove.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearMediaPreview('composer'); });

  const storyInput = document.getElementById('storyFileInput');
  if (storyInput) {
    storyInput.addEventListener('change', (e) => handleMediaSelection(e.target.files, 'story'));
  }
  const storyDropzone = document.getElementById('storyDropzone');
  if (storyDropzone) {
    storyDropzone.addEventListener('click', () => storyInput?.click());
    ['dragover', 'dragleave', 'drop'].forEach(evt => {
      storyDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        if (e.type === 'dragover') {
          storyDropzone.classList.add('dragover');
        } else if (e.type === 'dragleave') {
          storyDropzone.classList.remove('dragover');
        } else if (e.type === 'drop') {
          storyDropzone.classList.remove('dragover');
          handleMediaSelection(e.dataTransfer.files, 'story');
        }
      });
    });
  }
  const storyRemove = document.getElementById('storyMediaRemove');
  if (storyRemove) storyRemove.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearMediaPreview('story'); });

  const tripInput = document.getElementById('tripFileInput');
  if (tripInput) {
    tripInput.addEventListener('change', (e) => handleMediaSelection(e.target.files, 'trip'));
  }
  const tripDropzone = document.getElementById('tripDropzone');
  if (tripDropzone) {
    tripDropzone.addEventListener('click', () => tripInput?.click());
    ['dragover', 'dragleave', 'drop'].forEach(evt => {
      tripDropzone.addEventListener(evt, (e) => handleDropEvent(e, tripDropzone));
    });
  }
  const tripRemove = document.getElementById('tripMediaRemove');
  if (tripRemove) tripRemove.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearMediaPreview('trip'); });

  const chatToolbar = document.getElementById('chatToolbar');
  if (chatToolbar) chatToolbar.addEventListener('click', handleChatToolbarClick);

  const chatFileBtn = document.getElementById('btnChatFile');
  const chatFileInput = document.getElementById('chatFileInput');
  if (chatFileBtn && chatFileInput) {
    chatFileBtn.addEventListener('click', () => chatFileInput.click());
    chatFileInput.addEventListener('change', handleChatFileUpload);
  }
  const chatGifBtn = document.getElementById('btnChatGif');
  if (chatGifBtn) chatGifBtn.addEventListener('click', () => openGifPicker());

  const filters = document.getElementById('homeFilters');
  if (filters) {
    filters.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (chip) changeHomeFilter(chip.dataset.filter);
    });
  }

  const openComposerButtons = ['btnOpenComposer', 'composeFab'];
  openComposerButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => openComposer('post'));
  });

  const composerClose = document.getElementById('composerClose');
  if (composerClose) composerClose.addEventListener('click', closeComposer);

  const composerTabs = document.getElementById('composerTabs');
  if (composerTabs) {
    composerTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.composer-tab');
      if (tab) setComposerMode(tab.dataset.mode);
    });
  }

  const composerForm = document.getElementById('composerForm');
  if (composerForm) composerForm.addEventListener('submit', submitComposer);

  const requestOtpBtn = document.getElementById('btnRequestOtp');
  if (requestOtpBtn) requestOtpBtn.addEventListener('click', requestOtpCode);
  const otpForm = document.getElementById('formOtp');
  if (otpForm) otpForm.addEventListener('submit', handleOtpLogin);

  const forgotPasswordBtn = document.getElementById('btnForgotPassword');
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', () => {
      // Switch to OTP tab and trigger OTP request
      const otpTab = document.querySelector('[data-auth-tab="otp"]');
      if (otpTab) {
        otpTab.click();
        const emailInput = document.querySelector('#formSignin [name="email"]');
        const otpEmailInput = document.querySelector('#formOtp [name="email"]');
        if (emailInput && otpEmailInput) {
          otpEmailInput.value = emailInput.value;
        }
        setTimeout(() => {
          if (otpEmailInput && otpEmailInput.value) {
            requestOtpCode();
          }
        }, 300);
      }
    });
  }

  // Auto-focus next OTP input
  const otpInputs = document.querySelectorAll('.otp-inputs input');
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (e.target.value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });

  const editProfileClose = document.getElementById('editProfileClose');
  if (editProfileClose) editProfileClose.addEventListener('click', closeEditProfile);
  const editForm = document.getElementById('editProfileForm');
  if (editForm) editForm.addEventListener('submit', submitProfileEdit);
  const editAvatarInput = document.getElementById('editAvatarInput');
  if (editAvatarInput) editAvatarInput.addEventListener('change', handleEditAvatar);

  const storyViewer = document.getElementById('storyViewer');
  if (storyViewer) {
    storyViewer.addEventListener('click', (e) => {
      if (e.target === storyViewer) closeStoryViewer();
    });
  }
  const storyClose = document.getElementById('storyViewerClose');
  if (storyClose) storyClose.addEventListener('click', closeStoryViewer);
  const storyPrev = document.getElementById('storyPrev');
  if (storyPrev) storyPrev.addEventListener('click', () => cycleStory(-1));
  const storyNext = document.getElementById('storyNext');
  if (storyNext) storyNext.addEventListener('click', () => cycleStory(1));

  const followDrawerClose = document.getElementById('followDrawerClose');
  if (followDrawerClose) followDrawerClose.addEventListener('click', closeFollowDrawer);
  const followDrawer = document.getElementById('followDrawer');
  if (followDrawer) {
    followDrawer.addEventListener('click', (e) => {
      if (e.target === followDrawer) closeFollowDrawer();
    });
  }
}

function initAiFab() {
  if (DISABLE_AI) {
    document.getElementById('aiFab')?.classList.add('hidden');
    return;
  }
  const fab = document.getElementById('aiFab');
  if (fab) {
    fab.classList.remove('hidden');
    fab.addEventListener('click', openAiModal);
  }
  const closeBtn = document.getElementById('hfAiClose');
  if (closeBtn) closeBtn.addEventListener('click', closeAiModal);
  const modalShell = document.getElementById('hfAiModal');
  if (modalShell) {
    modalShell.addEventListener('click', (e) => {
      if (e.target === modalShell) closeAiModal();
    });
  }
  ensureAiWelcomeMessage();
  renderAiChatHistory();
  setAiMode(state.aiChatMode || 'text');
  setAiTransferTarget(state.aiTransferTarget || 'post');
  updateAiTransferUi();

  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.addEventListener('click', submitAiChat);
  const chatInput = document.getElementById('aiChatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitAiChat();
      }
    });
  }

  document.querySelectorAll('[data-ai-mode]').forEach(btn => {
    btn.addEventListener('click', () => setAiMode(btn.dataset.aiMode));
  });
  document.querySelectorAll('[data-ai-target]').forEach(btn => {
    btn.addEventListener('click', () => setAiTransferTarget(btn.dataset.aiTarget));
  });
  const transferBtn = document.getElementById('aiTransferBtn');
  if (transferBtn) transferBtn.addEventListener('click', applyAiResponseToTarget);
  initAiThreadDelegation();
}

function initAiThreadDelegation() {
  const thread = document.getElementById('aiChatThread');
  if (!thread || thread.dataset.aiDelegated) return;
  thread.dataset.aiDelegated = 'true';
  thread.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-ai-transfer]');
    if (!btn) return;
    const bubble = btn.closest('.ai-bubble');
    if (!bubble) return;
    handleAiBubbleTransfer(bubble.dataset.aiId, btn.dataset.aiTransfer);
  });
}

function createAiMessageId() {
  return `ai-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function ensureAiWelcomeMessage() {
  if (state.aiChatHistory.length) return;
  state.aiChatHistory.push({
    id: createAiMessageId(),
    role: 'assistant',
    mode: 'text',
    content: 'Hey! I can craft hooks, polish captions, suggest comments or paint mood-board style visuals. Ask me anything ✨',
    isIntro: true
  });
}

function renderAiChatHistory() {
  const thread = document.getElementById('aiChatThread');
  if (!thread) return;
  thread.innerHTML = '';
  if (!state.aiChatHistory.length) {
    thread.innerHTML = `
      <div class="ai-chat-placeholder">
        <i class="fas fa-robot"></i>
        <p>“Need a hook, carousel outline or a mood board? I’m on standby.”</p>
      </div>
    `;
    return;
  }
  state.aiChatHistory.forEach(entry => appendAiChatMessage(entry, thread));
  thread.scrollTop = thread.scrollHeight;
  initAiThreadDelegation();
}

function appendAiChatMessage(entry, containerEl) {
  const thread = containerEl || document.getElementById('aiChatThread');
  if (!thread) return;
  const bubble = document.createElement('div');
  bubble.className = `ai-bubble ${entry.role}${entry.isError ? ' error' : ''}`;
  bubble.dataset.aiId = entry.id;
  bubble.innerHTML = renderAiBubbleInner(entry);
  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
}

function renderAiBubbleInner(entry) {
  if (entry.loading) {
    const label = entry.mode === 'image' ? 'Rendering image…' : 'Thinking…';
    return `<div class="ai-bubble-loading"><i class="fas fa-circle-notch fa-spin"></i>${label}</div>`;
  }
  let body = '';
  if (entry.mode === 'image') {
    const caption = entry.prompt ? escapeHtml(entry.prompt) : 'Attach this visual straight into your composer.';
    body = `
      <div class="ai-image-response">
        <img src="${entry.content}" alt="AI generated image">
        <small>${caption}</small>
      </div>
    `;
  } else {
    body = `<div class="ai-text-response">${formatAiText(entry.content)}</div>`;
  }
  if (entry.role === 'assistant' && !entry.isError && !entry.isIntro) {
    const actions = [
      `<button type="button" class="ai-bubble-action" data-ai-transfer="post"><i class="fas fa-arrow-up-right-from-square"></i><span>Add to post</span></button>`
    ];
    body += `<div class="ai-bubble-actions">${actions.join('')}</div>`;
  }
  return body;
}

function formatAiText(text = '') {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function openAiModal() {
  if (DISABLE_AI) return;
  // Require active session for AI assistant
  if (!state.token) {
    toast('Please log in to use the AI assistant', 'error');
    return;
  }
  const modal = document.getElementById('hfAiModal');
  if (!modal) return;
  ensureAiWelcomeMessage();
  renderAiChatHistory();
  setAiMode(state.aiChatMode || 'text');
  updateAiTransferUi();
  setAiStatus(false);
  modal.classList.remove('hidden');
  const thread = document.getElementById('aiChatThread');
  const input = document.getElementById('aiChatInput');
  if (thread) thread.scrollTop = thread.scrollHeight;
  setTimeout(() => input?.focus(), 50);
}

function closeAiModal() {
  const modal = document.getElementById('hfAiModal');
  if (modal) modal.classList.add('hidden');
}

function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function setAiMode(mode = 'text') {
  const nextMode = mode === 'image' ? 'image' : 'text';
  state.aiChatMode = nextMode;
  document.querySelectorAll('[data-ai-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.aiMode === nextMode);
  });
  const input = document.getElementById('aiChatInput');
  if (input) {
    input.placeholder = nextMode === 'image'
      ? 'Describe the scene, lighting, vibe or frame you want rendered...'
      : 'Ask for hooks, outlines, captions or replies...';
  }
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) {
    sendBtn.innerHTML = nextMode === 'image'
      ? '<span>Render</span><i class="fas fa-wand-magic-sparkles"></i>'
      : '<span>Send</span><i class="fas fa-paper-plane"></i>';
  }
}

function setAiStatus(isActive, message = 'Thinking…') {
  const statusEl = document.getElementById('aiChatStatus');
  const banner = document.getElementById('aiStatusBanner');
  const bannerText = document.getElementById('aiStatusBannerText');
  if (!isActive) {
    if (statusEl) statusEl.classList.add('hidden');
    if (banner) banner.classList.add('hidden');
    return;
  }
  if (statusEl) {
    statusEl.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${escapeHtml(message)}`;
    statusEl.classList.remove('hidden');
  }
  if (banner && bannerText) {
    bannerText.textContent = message;
    banner.classList.remove('hidden');
  }
}

function buildAiPrompt(latestUserMessage) {
  const history = state.aiChatHistory
    .filter(entry => entry.role && entry.role !== 'system' && entry.mode === 'text' && !entry.isError && !entry.loading && !entry.isIntro)
    .slice(-6)
    .map(entry => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
    .join('\n');
  const intro = 'You are SocioSphere’s creative AI. Keep answers actionable, magnetic and under 120 words unless asked otherwise.';
  return `${intro}\n${history ? `${history}\n` : ''}User: ${latestUserMessage}\nAssistant:`;
}

async function submitAiChat() {
  if (DISABLE_AI || state.aiIsSending) return;
  const input = document.getElementById('aiChatInput');
  if (!input) return;
  const rawPrompt = input.value.trim();
  if (!rawPrompt) return;

  const payloadPrompt = state.aiChatMode === 'image' ? rawPrompt : buildAiPrompt(rawPrompt);
  const currentMode = state.aiChatMode || 'text';

  const userEntry = { id: createAiMessageId(), role: 'user', content: rawPrompt, timestamp: Date.now(), loading: false, mode: currentMode };
  state.aiChatHistory.push(userEntry);
  const assistantEntry = { id: createAiMessageId(), role: 'assistant', content: '', timestamp: Date.now(), loading: true, mode: currentMode, prompt: rawPrompt };
  state.aiChatHistory.push(assistantEntry);
  
  renderAiChatHistory();
  input.value = '';
  state.aiIsSending = true;
  setAiStatus(true, currentMode === 'image' ? 'Generating image…' : 'Thinking…');

  try {
    const endpoint = currentMode === 'image' ? '/hf/image' : '/hf/text';
    const body = currentMode === 'image' 
      ? { prompt: payloadPrompt, size: '1024x680', quality: 'hd' }
      : { prompt: payloadPrompt, maxTokens: 600, temperature: 0.7 };
    
    const response = await apiRequest(endpoint, 'POST', body);
    
    if (currentMode === 'image') {
      const imageUrl = response.image || response.url;
      if (imageUrl) {
        resolveAiMessage(assistantEntry.id, imageUrl, { isImage: true, prompt: rawPrompt });
        toast('Image generated!');
      } else {
        throw new Error('No image URL in response');
      }
    } else {
      const text = (response.text || '').trim();
      if (!text) throw new Error('Empty response from AI');
      resolveAiMessage(assistantEntry.id, text);
      hydrateAiCompanion(rawPrompt).catch(() => { });
      toast('AI reply added');
    }
  } catch (err) {
    resolveAiMessage(assistantEntry.id, err.message || 'Unable to complete request', { isError: true });
    toast(err.message || 'AI request failed', 'error');
  } finally {
    state.aiIsSending = false;
    setAiStatus(false);
  }
}

function resolveAiMessage(id, content, options = {}) {
  const entry = state.aiChatHistory.find(msg => msg.id === id);
  if (!entry) return;
  entry.content = content;
  entry.loading = false;
  entry.isError = Boolean(options.isError);
  if (options.prompt) entry.prompt = options.prompt;
  updateAiMessageDom(entry);
  if (entry.role === 'assistant' && !entry.isError) {
    state.lastAiAssistantId = entry.id;
    updateAiTransferUi();
  }
}

function updateAiMessageDom(entry) {
  const bubble = document.querySelector(`[data-ai-id="${entry.id}"]`);
  if (!bubble) return;
  bubble.classList.toggle('error', !!entry.isError);
  bubble.innerHTML = renderAiBubbleInner(entry);
  const thread = document.getElementById('aiChatThread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function getLastAssistantEntry() {
  for (let i = state.aiChatHistory.length - 1; i >= 0; i -= 1) {
    const entry = state.aiChatHistory[i];
    if (entry.role === 'assistant' && !entry.loading && !entry.isError && !entry.isIntro) {
      return entry;
    }
  }
  return null;
}

function updateAiTransferUi() {
  const button = document.getElementById('aiTransferBtn');
  const label = document.getElementById('aiTransferLabel');
  if (!button || !label) return;
  const target = state.aiTransferTarget === 'comment' ? 'comment' : 'post';
  label.textContent = target === 'comment' ? 'Add to comment' : 'Add to post';
  const lastEntry = getLastAssistantEntry();
  const disableForCommentImage = target === 'comment' && lastEntry?.mode === 'image';
  button.disabled = !lastEntry || disableForCommentImage;
}

function setAiTransferTarget(target = 'post') {
  const normalized = target === 'comment' ? 'comment' : 'post';
  state.aiTransferTarget = normalized;
  document.querySelectorAll('[data-ai-target]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.aiTarget === normalized);
  });
  updateAiTransferUi();
}

function applyAiResponseToTarget() {
  const entry = getLastAssistantEntry();
  if (!entry) {
    toast('Ask Gemini something first', 'error');
    return;
  }
  if (state.aiTransferTarget === 'post') {
    if (entry.mode === 'image') {
      applyAiImageToComposer(entry.content);
      toast('Image attached to composer');
    } else {
      applyAiTextToComposer(entry.content);
      toast('Draft dropped into composer');
    }
    return;
  }
  if (entry.mode === 'image') {
    toast('Switch target to Post to attach images', 'error');
    return;
  }
  const activeInput = (state.activeCommentInput && document.body.contains(state.activeCommentInput))
    ? state.activeCommentInput
    : (state.activeCommentPostId ? document.querySelector(`.comment-input[data-id="${state.activeCommentPostId}"]`) : null);
  if (!activeInput) {
    toast('Click into a comment box first', 'error');
    return;
  }
  activeInput.value = entry.content.trim();
  activeInput.focus();
  toast('Comment drafted with AI');
}

function handleAiBubbleTransfer(entryId, target = 'post') {
  const entry = state.aiChatHistory.find(msg => msg.id === entryId);
  if (!entry || entry.loading || entry.isError) {
    toast('Still waiting on that response. Try again in a sec.', 'error');
    return;
  }
  const normalized = target === 'comment' ? 'comment' : 'post';
  if (normalized === 'post') {
    if (entry.mode === 'image') {
      applyAiImageToComposer(entry.content);
      toast('Image attached to composer');
    } else {
      applyAiTextToComposer(entry.content);
      toast('Draft dropped into composer');
    }
    return;
  }
  if (entry.mode !== 'text') {
    toast('Only text can be added to a comment.', 'error');
    return;
  }
  const activeInput = (state.activeCommentInput && document.body.contains(state.activeCommentInput))
    ? state.activeCommentInput
    : (state.activeCommentPostId ? document.querySelector(`.comment-input[data-id="${state.activeCommentPostId}"]`) : null);
  if (!activeInput) {
    toast('Click into a comment box first', 'error');
    return;
  }
  activeInput.value = entry.content.trim();
  activeInput.focus();
  toast('Comment drafted with AI');
}

function applyAiTextToComposer(text = '') {
  const composer = document.getElementById('postInput');
  if (!composer) return;
  composer.value = text.trim();
  composer.focus();
}

function applyAiImageToComposer(dataUri = '') {
  if (!dataUri) return;
  const { type, name } = prepareInlineMediaFromData(dataUri);
  state.inlineMedia = { data: dataUri, name, type };
  updateMediaPreview('inline');
}

function prepareInlineMediaFromData(dataUri) {
  const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
  const type = mimeMatch ? mimeMatch[1] : 'image/png';
  const extension = type.split('/')[1] || 'png';
  return {
    type,
    name: `ai-${Date.now()}.${extension}`
  };
}

function adjustFabForView(target) {
  const composeFab = document.getElementById('composeFab');
  const aiFab = document.getElementById('aiFab');
  if (!composeFab) return;
  const isMobile = window.innerWidth <= 920;
  if (isMobile) {
    composeFab.style.left = '';
    composeFab.style.right = '20px';
    composeFab.style.bottom = '140px';
    if (aiFab) { aiFab.style.left = ''; aiFab.style.right = '20px'; aiFab.style.bottom = '200px'; }
  } else {
    composeFab.style.left = '';
    composeFab.style.right = '30px';
    composeFab.style.bottom = '30px';
    if (aiFab) { aiFab.style.left = ''; aiFab.style.right = '30px'; aiFab.style.bottom = '100px'; }
  }
}

function initMobileMenu() {
  const menuBtn = document.getElementById('btnMobileMenu');
  const overlay = document.getElementById('mobileMenuOverlay');
  if (!menuBtn || !overlay) return;
  menuBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
  const mmProfile = document.getElementById('mmProfile');
  const mmTrips = document.getElementById('mmTrips');
  const mmLeaderboard = document.getElementById('mmLeaderboard');
  const mmAi = document.getElementById('mmAi');
  const mmLogout = document.getElementById('mmLogout');
  if (mmProfile) mmProfile.addEventListener('click', () => { overlay.classList.add('hidden'); navigate('profile'); });
  if (mmTrips) mmTrips.addEventListener('click', () => { overlay.classList.add('hidden'); navigate('trips'); });
  if (mmLeaderboard) mmLeaderboard.addEventListener('click', () => { overlay.classList.add('hidden'); navigate('leaderboard'); });
  if (mmAi) mmAi.addEventListener('click', () => { overlay.classList.add('hidden'); openAiModal(); });
  if (mmLogout) mmLogout.addEventListener('click', () => { overlay.classList.add('hidden'); logout(); });
}

// --- Event Handlers (Logic) ---

async function handleGlobalClicks(e) {
  const target = e.target;

  const viewTrigger = target.closest('.mobile-nav-btn[data-target], .nav-link[data-target]');
  if (viewTrigger && viewTrigger.dataset.target) {
    navigate(viewTrigger.dataset.target);
  }

  const storyTrigger = target.closest('.story-pill, .story-circle');
  if (storyTrigger) {
    if (storyTrigger.dataset.create === 'true') {
      openComposer('story');
    } else {
      openStoryViewer(storyTrigger.dataset.user);
    }
    return;
  }

  const postAction = target.closest('[data-action]');
  if (postAction) {
    e.preventDefault();
    e.stopPropagation();
    let postId = postAction.dataset.id;
    // Fallback: some rendered post buttons may not have data-id (modal/explore variants)
    if (!postId) {
      const postCardEl = postAction.closest('.post-card');
      postId = postCardEl?.dataset.postId || postCardEl?.getAttribute('data-post-id') || postId;
    }
    if (!postId) return;
    if (postAction.dataset.action === 'like') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Prevent multiple clicks
      if (postAction.dataset.processing === 'true') return;
      postAction.dataset.processing = 'true';

      const postCard = postAction.closest('.post-card');
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;

      // Optimistically update UI
      const likeIcon = postAction.querySelector('i');
      const likeCount = postAction.querySelector('span');
      const isCurrentlyLiked = postAction.classList.contains('liked');

      if (isCurrentlyLiked) {
        postAction.classList.remove('liked');
        if (likeIcon) likeIcon.className = 'far fa-heart';
        if (likeCount) likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) || 0) - 1;
      } else {
        postAction.classList.add('liked');
        if (likeIcon) likeIcon.className = 'fas fa-heart';
        if (likeCount) likeCount.textContent = (parseInt(likeCount.textContent) || 0) + 1;
      }

      postAction.classList.add('heartbeat');
      setTimeout(() => postAction.classList.remove('heartbeat'), 400);

      try {
        const updated = await apiRequest(`/posts/${postId}/like`, 'POST');

        // Update local cache with server response to keep UI consistent
        try {
          if (Array.isArray(state.feedCache) && state.feedCache.length) {
            const idx = state.feedCache.findIndex(p => p._id === postId || p._id?.toString() === postId.toString());
            if (idx > -1) state.feedCache[idx] = updated;
          }
        } catch (inner) { /* ignore cache update errors */ }

        // Refresh just the feed/profile view instead of forcing full reloads
        if (state.view === 'home') {
          refreshFeedView();
        } else if (state.view === 'profile') {
          loadProfile(state.profileId);
        } else if (state.view === 'explore') {
          loadExplore();
        }

        // Also update modal if open
        const modal = document.getElementById('profileModal');
        if (modal && !modal.classList.contains('hidden')) {
          const modalProfileId = modal.dataset.userId;
          if (modalProfileId) loadProfileModal(modalProfileId);
        }
        // Update any rendered post DOM for the updated post
        try { updateSinglePostInDOM(updated); } catch (e) { /* ignore */ }
      } catch (err) {
        // Revert optimistic update on error
        if (isCurrentlyLiked) {
          postAction.classList.add('liked');
          if (likeIcon) likeIcon.className = 'fas fa-heart';
          if (likeCount) likeCount.textContent = (parseInt(likeCount.textContent) || 0) + 1;
        } else {
          postAction.classList.remove('liked');
          if (likeIcon) likeIcon.className = 'far fa-heart';
          if (likeCount) likeCount.textContent = Math.max(0, (parseInt(likeCount.textContent) || 0) - 1);
        }
        toast(err.message || 'Failed to like post', 'error');
      } finally {
        postAction.dataset.processing = 'false';
      }
      return false;
    }
    if (postAction.dataset.action === 'comment') {
      const commentSection = document.getElementById(`comments-${postId}`);
      if (commentSection) commentSection.classList.toggle('hidden');
    }
    if (postAction.dataset.action === 'share') {
      e.preventDefault();
      e.stopPropagation();
      const postCard = postAction.closest('.post-card');
      const postContent = postCard?.querySelector('.post-content')?.textContent || 'Check out this post';
      const u = new URL(window.location.href);
      u.searchParams.set('post', postId);
      const shareUrl = u.toString();
      let mediaUrl = '';
      let messageType = 'text';
      try {
        const postObj = (state.feedCache || []).find(p => (p._id?.toString() || p._id) === postId.toString());
        const murl = postObj?.mediaUrl || postObj?.image || '';
        if (murl && typeof murl === 'string' && murl.trim()) {
          mediaUrl = murl.trim();
          const ext = mediaUrl.split('.').pop()?.toLowerCase() || '';
          const isVideo = mediaUrl.startsWith('data:video') || ['mp4', 'webm', 'ogg'].includes(ext);
          messageType = isVideo ? 'video' : 'image';
        }
      } catch (_) { }
      state.shareDraft = {
        postId,
        url: shareUrl,
        text: postContent.substring(0, 140),
        mediaUrl,
        messageType
      };
      navigate('messages');
      openShareDrawer();
    }
    return;
  }

  // 3. Select Chat
  const chatItem = target.closest('.chat-item');
  if (chatItem) {
    loadMessages(chatItem.dataset.id, chatItem.dataset.username);
    return;
  }

  const profileTab = target.closest('.profile-tab');
  if (profileTab) {
    document.querySelectorAll('.profile-tab').forEach(tab => tab.classList.remove('active'));
    profileTab.classList.add('active');
    // Show corresponding profile section container (profileFeed / profileTrips)
    const tabName = profileTab.dataset.tab;
    const mapping = {
      posts: 'profileFeed',
      trips: 'profileTrips'
    };
    Object.values(mapping).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const showId = mapping[tabName] || 'profileFeed';
    const showEl = document.getElementById(showId);
    if (showEl) showEl.classList.remove('hidden');
  }
}

async function handleGlobalKeydowns(e) {
  // Enter key in comment input
  if (e.key === 'Enter' && e.target.classList.contains('comment-input')) {
    e.preventDefault();
    const postId = e.target.dataset.id;
    let text = e.target.value.trim();
    if (!text) return;

    // Handle GIF markdown format
    const gifMatch = text.match(/!\[GIF\]\((.*?)\)/);
    if (gifMatch) {
      text = text.replace(/!\[GIF\]\(.*?\)/, gifMatch[1]); // Replace with URL
    }

    // Save scroll positions before clearing
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const commentSection = document.getElementById(`comments-${postId}`);
    const commentSectionScroll = commentSection ? commentSection.scrollTop : 0;

    // INSTANT: Clear input and add comment to DOM immediately
    const tempId = `temp-${Date.now()}`;
    e.target.value = '';
    const commentsList = commentSection?.querySelector('.comments-list');
    
    if (commentsList && state.user) {
      const optimisticComment = document.createElement('div');
      optimisticComment.className = 'comment-item';
      optimisticComment.dataset.tempId = tempId;
      optimisticComment.style.opacity = '0.7';
      optimisticComment.innerHTML = `
        <img src="${state.user.profilePicture || '/assets/images/default-avatar.png'}" alt="${state.user.username || 'You'}" class="comment-avatar" />
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">${state.user.username || 'You'}</span>
            <span class="comment-time">Just now</span>
          </div>
          <div class="comment-text">${text}</div>
        </div>
      `;
      commentsList.appendChild(optimisticComment);
      
      // Update comment count instantly
      const countBtn = document.querySelector(`[data-action="comment"][data-id="${postId}"] span`);
      if (countBtn) {
        countBtn.textContent = (parseInt(countBtn.textContent) || 0) + 1;
      }
    }

    toast('Comment added');

    // Send request in background
    try {
      await apiRequest(`/posts/${postId}/comment`, 'POST', { text });
      
      // Remove temporary comment and reload to show real one
      const tempComment = document.querySelector(`[data-temp-id="${tempId}"]`);
      if (tempComment) tempComment.remove();
      
      // Refresh to show server comment
      if (state.view === 'home') {
        await loadFeed();
      } else if (state.view === 'profile') {
        await loadProfile(state.profileId);
      } else if (state.view === 'explore') {
        await loadExplore();
      }

      // Also refresh modal if open
      const modal = document.getElementById('profileModal');
      if (modal && !modal.classList.contains('hidden')) {
        const modalProfileId = modal.dataset.userId;
        if (modalProfileId) await loadProfileModal(modalProfileId);
      }

      // Restore scroll positions
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
        if (commentSection) {
          commentSection.scrollTop = commentSectionScroll;
        }
      }, 100);
    } catch (err) {
      toast(err.message || 'Failed to add comment', 'error');
    }
  }
}

async function createPost() {
  const input = document.getElementById('postInput');
  const postBtn = document.getElementById('postBtn');
  
  // Prevent multiple clicks
  if (postBtn && postBtn.disabled) return;
  
  const content = input.value.trim();
  const hasMedia = Boolean(state.inlineMedia?.data);
  
  /* Phase 2: Input Validation */
  if (!content && !hasMedia) {
    return toast('Share a thought or add media', 'error');
  }
  
  if (content.length < 2 && content.length > 0) {
    return toast('Post must be at least 2 characters', 'error');
  }

  const payload = {};
  if (content) payload.content = content;
  if (hasMedia) payload.image = state.inlineMedia.data;

  // INSTANT: Clear UI and disable button
  if (postBtn) {
    postBtn.disabled = true;
    postBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
  }
  
  const originalContent = content;
  const originalMedia = state.inlineMedia;
  input.value = '';
  clearMediaPreview('inline');
  toast('✨ Your post is live!', 'success');

  try {
    await apiRequest('/posts', 'POST', payload);
    loadFeed();
  } catch (err) {
    // Restore on error
    input.value = originalContent;
    state.inlineMedia = originalMedia;
    if (originalMedia?.data) {
      const preview = document.getElementById('inlineMediaPreview');
      if (preview) preview.classList.remove('hidden');
    }
    toast(err.message || 'Failed to create post', 'error');
  } finally {
    if (postBtn) {
      postBtn.disabled = false;
      postBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
    }
  }
}

async function sendMessage(e) {
  e.preventDefault();
  const input = e.target.content || e.target.querySelector('input[name="content"]');
  if (!input) return;

  const content = input.value.trim();

  if (!state.activeChatId) {
    toast('Select a chat first', 'error');
    return;
  }
  if (!content) return;

  // INSTANT: Clear input and add to UI immediately
  input.value = '';
  const tempId = `temp-${Date.now()}`;
  
  // Add message to UI immediately for instant feedback
  const area = document.getElementById('msgArea');
  let msgEl;
  if (area) {
    msgEl = document.createElement('div');
    msgEl.className = 'msg mine';
    msgEl.dataset.tempId = tempId;
    msgEl.style.opacity = '0.8';
    msgEl.innerHTML = `
      <div class="msg-content">${escapeHtml(content)}</div>
      <small class="msg-time">sending...</small>
    `;
    area.appendChild(msgEl);
    area.scrollTop = area.scrollHeight;
  }

  // Update chat list immediately
  const list = document.getElementById('chatList');
  if (list && state.activeChatId) {
    const item = list.querySelector(`.chat-item[data-id="${state.activeChatId}"]`);
    if (item) {
      const snippetEl = item.querySelector('div:nth-child(2) > div:nth-child(2)');
      const timeEl = item.querySelector('div:nth-child(2) > div:nth-child(1) small');
      if (snippetEl) snippetEl.textContent = content;
      if (timeEl) timeEl.textContent = 'just now';
      list.prepend(item);
    }
  }

  try {
    const msg = await apiRequest('/messages', 'POST', {
      receiverId: state.activeChatId,
      content: content
    });

    // Update temp message with real data
    if (msgEl) {
      msgEl.style.opacity = '1';
      const timeEl = msgEl.querySelector('.msg-time');
      if (timeEl) timeEl.textContent = 'just now';
      msgEl.removeAttribute('data-temp-id');
    }
  } catch (err) {
    // Remove failed message
    if (msgEl) msgEl.remove();
    
    // Restore input
    input.value = content;
    
    toast(err.message || 'Failed to send message', 'error');
  }
}

async function fetchAiPostIdeas(seed = '') {
  if (typeof DISABLE_POST_AI !== 'undefined' && DISABLE_POST_AI) return [];
  const response = await apiRequest('/ai/suggest-posts', 'POST', {
    seed,
    vibe: 'bold, positive and slightly playful'
  });
  return Array.isArray(response.suggestions) ? response.suggestions : [];
}

function renderAiIdeaChips(ideas = []) {
  if (typeof DISABLE_POST_AI !== 'undefined' && DISABLE_POST_AI) return;
  const strip = document.getElementById('aiIdeaStrip');
  const chips = document.getElementById('aiIdeaChips');
  if (!strip || !chips) return;
  if (!ideas.length) {
    strip.classList.add('hidden');
    chips.innerHTML = '';
    return;
  }
  strip.classList.remove('hidden');
  chips.innerHTML = ideas.map((idea, idx) => `
    <button class="ai-idea-chip" type="button" data-idea="${escapeHtml(idea)}" aria-label="Apply idea ${idx + 1}">
      ${escapeHtml(idea)}
    </button>
  `).join('');
  chips.querySelectorAll('[data-idea]').forEach(btn => {
    btn.addEventListener('click', () => insertIdeaIntoComposer(btn.dataset.idea));
  });
}

function insertIdeaIntoComposer(text) {
  const input = document.getElementById('postInput');
  if (input) {
    input.value = text;
    input.focus();
    toast('Idea inserted ✨');
  }
}

async function hydrateAiCompanion(seed = '') {
  if (typeof DISABLE_POST_AI !== 'undefined' && DISABLE_POST_AI) return;
  const card = document.getElementById('aiCompanionCard');
  const list = document.getElementById('aiCompanionList');
  if (!card || !list) return;
  card.classList.remove('hidden');
  list.innerHTML = '<p style="color:var(--text-muted);">Brewing fresh prompts…</p>';
  try {
    const ideas = await fetchAiPostIdeas(seed);
    renderAiIdeaChips(ideas.slice(0, 3));
    if (!ideas.length) {
      list.innerHTML = '<p style="color:var(--text-muted);">No AI inspiration right now.</p>';
      return;
    }
    list.innerHTML = ideas.map((idea, idx) => `
      <button class="btn secondary" type="button" data-companion-idea="${escapeHtml(idea)}">
        <span style="min-width:24px; font-weight:600;">${idx + 1}.</span>
        <span style="text-align:left;">${escapeHtml(idea)}</span>
      </button>
    `).join('');
    list.querySelectorAll('[data-companion-idea]').forEach(btn => {
      btn.addEventListener('click', () => insertIdeaIntoComposer(btn.dataset.companionIdea));
    });
  } catch (err) {
    console.error('Gemini companion error', err);
    list.innerHTML = '<p style="color:var(--danger);">Gemini is taking a break.</p>';
  }
}

async function generateAiPost() {
  if (typeof DISABLE_POST_AI !== 'undefined' && DISABLE_POST_AI) return toast('Post AI disabled', 'error');
  const seed = document.getElementById('postInput')?.value?.trim() || '';
  toast('Gemini is crafting ideas…');
  try {
    const suggestions = await fetchAiPostIdeas(seed);
    if (suggestions.length === 0) {
      toast('AI could not generate ideas.', 'error');
      return;
    }
    hydrateAiCompanion(seed);
    if (suggestions.length === 1) {
      insertIdeaIntoComposer(suggestions[0]);
    } else {
      showAiSuggestionsModal(suggestions, (choice) => insertIdeaIntoComposer(choice));
      toast('Pick an AI-crafted idea');
    }
  } catch (err) {
    toast(err.message || 'AI Service Unavailable', 'error');
  }
}

async function improveComposerDraft(goal = 'bold, clear and scroll-stopping') {
  if (typeof DISABLE_POST_AI !== 'undefined' && DISABLE_POST_AI) return toast('Post AI disabled', 'error');
  const input = document.getElementById('postInput');
  if (!input) return;
  const draft = input.value.trim();
  if (!draft) {
    toast('Type something first so Gemini can polish it.', 'error');
    return;
  }
  toast('Polishing your words…');
  try {
    const res = await apiRequest('/ai/improve-text', 'POST', { draft, goal });
    if (res.improvedText) {
      input.value = res.improvedText.trim();
      input.focus();
      toast('Draft upgraded ✨');
    } else {
      toast('Gemini returned an empty response', 'error');
    }
  } catch (err) {
    toast(err.message || 'AI Service Unavailable', 'error');
  }
}

// Show AI suggestions modal when multiple suggestions are returned
function showAiSuggestionsModal(suggestions, applyCallback) {
  // remove existing modal
  const existing = document.querySelector('.ai-suggestions-overlay');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'ai-suggestions-overlay';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:12000;';
  modal.innerHTML = `
    <div style="background:var(--bg-card); padding:14px; border-radius:12px; width:420px; max-height:70vh; overflow:auto; border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0; font-size:1rem;">AI Suggestions</h3>
        <button class="ghost-icon" onclick="this.closest('.ai-suggestions-overlay').remove()"><i class="fas fa-times"></i></button>
      </div>
      <div id="aiSuggestionsList" style="display:flex; flex-direction:column; gap:8px;">
        ${suggestions.map(s => `<div class=\"ai-suggestion\" style=\"padding:10px; border-radius:8px; background:var(--bg-panel); cursor:pointer;\">${escapeHtml(s)}</div>`).join('')}
      </div>
      <div style="display:flex; gap:8px; margin-top:12px; justify-content:flex-end;">
        <button class="btn secondary" onclick="document.querySelector('.ai-suggestions-overlay')?.remove()">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // click handler for suggestions
  modal.querySelectorAll('.ai-suggestion').forEach((el, idx) => {
    el.addEventListener('click', () => {
      if (applyCallback && typeof applyCallback === 'function') applyCallback(suggestions[idx]);
      modal.remove();
    });
  });

  // close on Escape
  const esc = (e) => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

window.generateAiComment = async function (postId) {
  const input = document.querySelector(`.comment-input[data-id="${postId}"]`);
  if (!input) return;
  const postCard = input.closest('.post-card');
  const postText = postCard?.querySelector('.post-content')?.textContent || '';
  const author = postCard?.querySelector('.post-meta h4')?.textContent || '';

  toast('Generating comment...');
  try {
    const prompt = `Write a concise, friendly reply to this post. Keep it under 140 characters. Avoid emojis unless they help.

Author: ${author}
Post: ${postText}`;
    const res = await apiRequest('/hf/text', 'POST', { prompt });
    let out = (res?.text || '').trim();
    out = out.replace(/\s+/g, ' ').replace(/[\r\n]+/g, ' ').trim();
    if (out.length > 140) out = out.slice(0, 140).trim();
    if (out) {
      input.value = out;
      input.focus();
      toast('Suggestion added');
    } else {
      toast('No suggestion returned', 'error');
    }
  } catch (err) {
    toast(err.message || 'Text generation failed', 'error');
  }
};

function openGifPicker() {
  const modal = document.getElementById('gifPickerModal');
  if (!modal) return;

  modal.classList.remove('hidden');
  loadTrendingGifs();

  const searchInput = document.getElementById('gifSearchInput');
  if (searchInput) {
    // Clear value and attach a single handler (use oninput to avoid duplicate listeners)
    searchInput.value = '';
    const debouncedSearch = debounce((e) => {
      const query = (e.target?.value || '').trim();
      if (query.length > 0) {
        searchGifs(query);
      } else {
        loadTrendingGifs();
      }
    }, 500);
    searchInput.oninput = debouncedSearch;
  }
}

/* =========================================
   REPLACE THESE FUNCTIONS IN YOUR APP.JS
   ========================================= */

/* ============================================================
   REPLACE: loadTrendingGifs (Fixes invisible GIF grid)
   ============================================================ */
async function loadTrendingGifs() {
  const grid = document.getElementById('gifGrid');
  if (!grid) return;

  // Clear grid and show loading text
  grid.innerHTML = '<div style="width:100%; text-align:center; padding:20px; color:var(--text-muted); grid-column: 1 / -1;">Loading GIFs...</div>';

  // Fallback generator
  const renderFallbacks = () => {
    grid.innerHTML = FALLBACK_GIFS.map(u => `
      <div style="
        cursor:pointer; 
        border-radius:8px; 
        overflow:hidden; 
        height:140px; 
        background:#333; 
        position:relative;
        border:1px solid var(--border);" 
        onclick="selectGif('${u}')">
          <img src="${u}" style="width:100%; height:100%; object-fit:cover; display:block;" decoding="async">
      </div>
    `).join('');
  };

  try {
    // Try to fetch from your backend
    const res = await apiRequest('/gifs/trending', 'GET');

    if (res && Array.isArray(res.data) && res.data.length > 0) {
      grid.innerHTML = res.data.map(gif => {
        const url = gif?.images?.fixed_height?.url || gif?.images?.original?.url;
        // Use a fixed height and background color so the box is visible immediately
        return `
          <div style="
            cursor:pointer; 
            border-radius:8px; 
            overflow:hidden; 
            height:140px; 
            background:#2A2A2A; 
            position:relative;" 
            onclick="selectGif('${url}')">
              <img src="${url}" 
                   style="width:100%; height:100%; object-fit:cover; display:block;" 
                   decoding="async"
                   onerror="this.parentElement.style.display='none'"> 
          </div>
        `;
      }).join('');
    } else {
      renderFallbacks();
    }
  } catch (err) {
    console.error('GIF Load Error:', err);
    renderFallbacks();
  }
}

async function searchGifs(query) {
  const grid = document.getElementById('gifGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Searching...</div>';

  // Helper for fallbacks
  const renderFallbacks = () => {
    // Simple local filter for fallbacks
    const matches = FALLBACK_GIFS.filter(u => u.toLowerCase().includes(query.toLowerCase()));
    const toShow = matches.length ? matches : FALLBACK_GIFS;

    grid.innerHTML = toShow.map(u => `
      <div style="cursor:pointer; border-radius:8px; overflow:hidden; aspect-ratio:1; background:var(--bg-panel); transition:transform 0.2s;" onclick="selectGif('${u}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'>
        <img src="${u}" alt="gif" style="width:100%; height:100%; object-fit:cover;" decoding="async">
      </div>
    `).join('');
  };

  if (!query) {
    loadTrendingGifs();
    return;
  }

  try {
    const res = await apiRequest(`/gifs/search?q=${encodeURIComponent(query)}`, 'GET');

    if (res && Array.isArray(res.data) && res.data.length > 0) {
      grid.innerHTML = res.data.map(gif => {
        const url = gif?.images?.fixed_height?.url || gif?.images?.original?.url;
        const thumb = gif?.images?.fixed_height_small?.url || url;
        if (!url) return '';

        return `
          <div style="cursor:pointer; border-radius:8px; overflow:hidden; aspect-ratio:1; background:var(--bg-panel); transition:transform 0.2s;" onclick="selectGif('${url}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'>
            <img src="${thumb}" alt="gif" style="width:100%; height:100%; object-fit:cover;" decoding="async">
          </div>
        `;
      }).join('');
    } else {
      renderFallbacks();
    }
  } catch (err) {
    console.error('GIF Search unavailable:', err);
    renderFallbacks();
  }
}

/* ============================================================
   REPLACE: selectGif (Fixes "Link instead of Image" issue)
   ============================================================ */
window.selectGif = function (gifUrl) {
  const modal = document.getElementById('gifPickerModal');
  if (modal) modal.classList.add('hidden');

  // 1. If in a Chat, send immediately
  if (state.activeChatId) {
    (async () => {
      try {
        await apiRequest('/messages', 'POST', {
          receiverId: state.activeChatId,
          content: 'GIF',
          messageType: 'image',
          mediaUrl: gifUrl
        });
        toast('GIF sent');
        loadMessages(state.activeChatId);
      } catch (e) {
        toast('Failed to send GIF (Server Error)', 'error');
      }
    })();
    return;
  }

  // 2. If modal composer is open, inject there
  const composerModal = document.getElementById('composerModal');
  if (composerModal && !composerModal.classList.contains('hidden')) {
    const composerForm = document.getElementById('composerForm');
    const mode = composerForm?.dataset.mode || 'post';
    const gifPayload = { data: gifUrl, name: 'GIF', type: 'image/gif' };
    if (mode === 'story') {
      state.storyMedia = gifPayload;
      updateMediaPreview('story');
    } else {
      state.composerMedia = gifPayload;
      updateMediaPreview('composer');
    }
    toast('GIF attached');
    return;
  }

  // 3. If in Main Post Composer -> Show Preview
  const postInput = document.getElementById('postInput');
  const activeElement = document.activeElement;
  const chatForm = document.getElementById('formSendMsg');
  const chatFocused = chatForm ? chatForm.contains(activeElement) : false;

  // Check if we are in the main post composer
  if (postInput && !chatFocused) {
    // Manually set the media state
    state.inlineMedia = {
      data: gifUrl,
      name: 'GIF',
      type: 'image/gif'
    };
    // Force the preview to show
    updateMediaPreview('inline');
    toast('GIF attached');
  }
  // 4. Fallback for comments (still use link for comments as they don't support media uploads)
  else if (activeElement && activeElement.classList.contains('comment-input')) {
    activeElement.value = (activeElement.value + ` ![GIF](${gifUrl})`).trim();
    activeElement.focus();
  }
};

async function openProfileModal(userId) {
  const modal = document.getElementById('profileModal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.dataset.userId = userId;
  await loadProfileModal(userId);
}

async function loadProfileModal(userId) {
  const banner = document.getElementById('profileModalBanner');
  const header = document.getElementById('profileModalHeader');
  const feed = document.getElementById('profileModalFeed');

  if (!userId) return;

  try {
    const user = await apiRequest(`/users/${userId}`, 'GET');
    const postsResponse = await apiRequest(`/posts/user/${userId}`, 'GET');
    
    // Handle both old format (array) and new format (object with pagination)
    const posts = Array.isArray(postsResponse) ? postsResponse : (postsResponse.posts || []);

    const currentUserId = state.user?._id?.toString();
    const isMe = currentUserId === userId.toString();
    const initials = user.username ? user.username[0].toUpperCase() : 'U';

    // Check if following
    let isFollowing = false;
    if (state.user?.following && Array.isArray(state.user.following)) {
      isFollowing = state.user.following.some(followId => {
        const followIdStr = typeof followId === 'object' ? (followId._id?.toString() || followId.toString()) : followId.toString();
        const userIdStr = user._id?.toString() || user.toString();
        return followIdStr === userIdStr;
      });
    }

    if (banner) {
      if (user.coverImage) {
        banner.style.backgroundImage = `url('${user.coverImage}')`;
        banner.style.animation = 'none';
      } else {
        // CSS handles the animation now
        banner.style.backgroundImage = 'none';
        banner.style.animation = '';
      }
    }

    if (header) {
      const avatarHtml = renderAvatar(user, 120);
      header.innerHTML = `
        <div class="profile-summary">
          <div class="profile-avatar">${avatarHtml}</div>
          <div class="profile-details">
            <h2>${user.fullName || user.username}</h2>
            <p class="profile-handle">@${user.username}</p>
            <p class="profile-bio">${user.bio || 'This user prefers to keep an air of mystery.'}</p>
            <div class="profile-stats">
              <div><strong>${posts.length}</strong><span>Posts</span></div>
              <div><strong><button class="link-like" onclick="window.openFollowList('${user._id}', 'followers')">${user.followers?.length || 0}</button></strong><span style="cursor:pointer;" onclick="window.openFollowList('${user._id}', 'followers')">Followers</span></div>
              <div><strong><button class="link-like" onclick="window.openFollowList('${user._id}', 'following')">${user.following?.length || 0}</button></strong><span style="cursor:pointer;" onclick="window.openFollowList('${user._id}', 'following')">Following</span></div>
            </div>
          </div>
          ${!isMe
          ? `<div style="display:flex; gap:8px;">
                <button class="btn ${isFollowing ? 'secondary' : 'primary'}" data-follow-user="${user._id}" type="button" onclick="window.followUser('${user._id}'); setTimeout(() => loadProfileModal('${userId}'), 500);">${isFollowing ? 'Following' : 'Follow'}</button>
                <button class="btn secondary" type="button" onclick="window.startChatWithUser('${user._id}', '${user.username}'); window.closeProfileModal();" title="Send message">
                  <i class="fas fa-envelope"></i> Message
                </button>
              </div>`
          : `<button class="btn secondary" type="button" onclick="window.closeProfileModal(); navigate('profile');">View Full Profile</button>`
        }
        </div>
      `;
    }

    if (feed) {
      renderPosts(posts, feed, false); // Don't show delete in modal
    }
  } catch (e) {
    console.error('Load profile modal error:', e);
    if (header) header.innerHTML = '<p style="padding:20px; color:var(--danger);">Failed to load profile</p>';
  }
}

// (Duplicate GIF picker functions removed — preserved the primary implementation earlier in the file.)

// `debounce` helper (defined later) — earlier duplicate removed to avoid redeclaration

// --- Data Loading & Rendering ---

// Pagination state
const feedPagination = {
  page: 1,
  limit: 50,
  hasMore: true,
  loading: false
};

async function loadFeed(append = false) {
  const container = document.getElementById('feedList');
  if (!container) return;

  // Prevent duplicate requests
  if (feedPagination.loading) return;
  if (append && !feedPagination.hasMore) return;

  feedPagination.loading = true;

  if (!append) {
    // Show cached content immediately if available
    if (state.feedCache && state.feedCache.length > 0) {
      refreshFeedView();
    } else {
      container.innerHTML = createSkeletonLoader('post', 3);
    }
    feedPagination.page = 1;
    feedPagination.hasMore = true;
  } else {
    // Show loading indicator at bottom
    const loader = document.createElement('div');
    loader.id = 'feedLoader';
    loader.innerHTML = createSkeletonLoader('post', 2);
    container.appendChild(loader);
  }

  try {
    const response = await apiRequest(`/posts?page=${feedPagination.page}&limit=${feedPagination.limit}`, 'GET');
    
    // Handle both old format (array) and new format (object with pagination)
    const posts = Array.isArray(response) ? response : (response.posts || []);
    const pagination = response.pagination || null;

    if (!Array.isArray(posts)) {
      throw new Error('Invalid response format');
    }

    if (append) {
      state.feedCache = [...(state.feedCache || []), ...posts];
      const loader = document.getElementById('feedLoader');
      if (loader) loader.remove();
    } else {
      state.feedCache = posts;
    }

    // Update pagination state
    if (pagination) {
      feedPagination.hasMore = feedPagination.page < pagination.pages;
      feedPagination.page++;
    } else {
      // Old format - assume no more if less than limit
      feedPagination.hasMore = posts.length >= feedPagination.limit;
      if (feedPagination.hasMore) feedPagination.page++;
    }

    refreshFeedView();
    if (!append) updateHomeMetrics();

  } catch (err) {
    console.error('Load feed error:', err);
    if (!append) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--danger);">
          <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px; display:block;"></i>
          <p style="margin-bottom:10px;">Failed to load feed</p>
          <small style="color:var(--text-muted); display:block; margin-bottom:15px;">${err.message || 'Please check your connection'}</small>
          <button class="btn secondary" onclick="loadFeed()">Retry</button>
        </div>
      `;
    } else {
      const loader = document.getElementById('feedLoader');
      if (loader) loader.remove();
    }
  } finally {
    feedPagination.loading = false;
  }
}

// Initialize infinite scroll for feed
function initInfiniteScroll() {
  let scrollTimeout;
  const checkScroll = () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const container = document.getElementById('feedList');
      if (!container || state.currentView !== 'home') return;
      
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 1000;
      
      if (scrollPosition >= threshold && !feedPagination.loading && feedPagination.hasMore) {
        loadFeed(true);
      }
    }, 100);
  };

  window.addEventListener('scroll', checkScroll);
  window.addEventListener('resize', checkScroll);
}

// Explore Page State
const exploreState = {
  currentFilter: 'for-you',
  viewMode: 'grid',
  heroContent: [],
  contentItems: [],
  mapInstance: null,
  mapLayer: null,
  ghostMode: false,
  tripRadar: false,
  heatCircles: [],
  radarPulse: null,
  userLocation: null
};

async function loadExplore() {
  const container = document.getElementById('exploreGrid');
  if (!container) return;

  container.innerHTML = `<div style="grid-column:1/-1;">${generateSkeletonFeed(3)}</div>`;

  try {
    renderExploreGreeting();
    // Load hero carousel
    await loadExploreHero();
    
    // Load bento grid
    await loadExploreBentoGrid();
    
    // Initialize filters
    initExploreFilters();
    
    // Initialize view toggle
    initExploreViewToggle();
  } catch (e) {
    container.innerHTML = '<p style="text-align:center;">Failed to load explore.</p>';
    console.error('Explore load error:', e);
  }
}

function renderExploreGreeting() {
  const titleEl = document.getElementById('exploreGreetingTitle');
  const subEl = document.getElementById('exploreGreetingSubtitle');

  if (!titleEl || !subEl) return;

  const name = state?.user?.fullName || state?.user?.username || 'there';
  const hour = new Date().getHours();
  let headline = 'Explore';
  let subtitle = 'Discover what the community is doing right now.';

  if (hour < 12) {
    headline = `Good morning, ${name}.`;
    subtitle = 'Ready for an adventure?';
  } else if (hour < 18) {
    headline = `Hey ${name}, the day is yours.`;
    subtitle = 'Find a spot and head out.';
  } else {
    headline = `Evening, ${name}.`;
    subtitle = "See what's trending tonight.";
  }

  titleEl.textContent = headline;
  subEl.textContent = subtitle;
}

async function loadExploreHero() {
  const heroCarousel = document.getElementById('heroCarousel');
  if (!heroCarousel) return;

  heroCarousel.innerHTML = `
    <div class="hero-skeletons">
      ${Array(4).fill(0).map(() => `
        <div class="hero-card skeleton-card" style="height: 160px; border-radius: 16px;"></div>
      `).join('')}
    </div>
  `;

  try {
    // Load trips and creators in parallel for speed
    const [trips, creators] = await Promise.all([
      apiRequest('/trips', 'GET').catch(() => []),
      apiRequest('/leaderboard/users', 'GET').catch(() => [])
    ]);
    
    // Mix trending content
    const trendingTrips = (trips || []).slice(0, 3);
    const hotCreators = (creators || []).slice(0, 3);
    
    exploreState.heroContent = [
      ...trendingTrips.map(t => ({ type: 'trip', data: t })),
      ...hotCreators.map(c => ({ type: 'creator', data: c }))
    ];

    if (exploreState.heroContent.length === 0) {
      heroCarousel.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">No trending content available</p>';
      return;
    }

    heroCarousel.innerHTML = exploreState.heroContent.map((item, idx) => {
      if (item.type === 'trip') {
        const trip = item.data;
        const destination = trip.destination?.city || trip.destination || trip.title || 'Unknown';
        const costStr = trip.estimatedCost ? `₹${trip.estimatedCost.toLocaleString()}` : 'TBD';
        const participantCount = (trip.participants || []).length;
        const hasImg = trip.coverImage && !/placeholder/.test(trip.coverImage);
        return `
          <div class="hero-card" onclick="window.openTripDetail('${trip._id}')" style="cursor:pointer;">
            ${hasImg ? `<img src="${trip.coverImage}" class="hero-card-bg" alt="${destination}" onerror="this.style.display='none';">` : 
              '<div class="hero-card-bg" style="background:linear-gradient(135deg, rgba(124,93,255,0.3), rgba(16,185,129,0.3));"></div>'}
            <div class="hero-card-overlay">
              <div class="hero-card-title">${escapeHtml(destination)}</div>
              <div class="hero-card-meta">
                <span>👥 ${participantCount} joining</span>
                <span>${costStr}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        const creator = item.data.user || item.data;
        const hasImg = creator.profilePicture && !/placeholder/.test(creator.profilePicture);
        return `
          <div class="hero-card" onclick="window.viewUserProfile('${creator._id}')" style="cursor:pointer;">
            ${hasImg ? 
              `<img src="${creator.profilePicture}" class="hero-card-bg" alt="${creator.username}" onerror="this.style.display='none';">` : 
              `<div class="hero-card-bg" style="background:${getAvatarColor(getAvatarSeed(creator))};"></div>`}
            <div class="hero-card-overlay">
              <div class="hero-card-title">@${escapeHtml(creator.username)}</div>
              <div class="hero-card-meta">
                <span>⭐ Top Creator</span>
              </div>
            </div>
          </div>
        `;
      }
    }).join('');
  } catch (e) {
    console.error('Hero load error:', e);
    heroCarousel.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">Unable to load trending content</p>';
  }
}

async function loadExploreBentoGrid() {
  const container = document.getElementById('exploreGrid');
  if (!container) return;

  // Masonry layout for For You to remove vertical gaps
  if (exploreState.currentFilter === 'for-you') {
    container.classList.add('masonry');
  } else {
    container.classList.remove('masonry');
  }

  container.innerHTML = Array(6).fill(null).map(() => '<div class="skeleton-card" style="min-height:220px;border-radius:16px;background:var(--glass);overflow:hidden;position:relative;"><div class="skeleton-shimmer"></div></div>').join('');

  try {
    const currentUserId = getCurrentUserId();
    
    // Load mixed content based on filter
    let allContent = [];
    
    if (exploreState.currentFilter === 'for-you' || exploreState.currentFilter === 'trending') {
      // Use unified mixed feed endpoint
      const resp = await apiRequest('/explore/foryou', 'GET').catch(() => ({ items: [] }));
      const items = resp?.items || [];
      allContent = items.map((item, idx) => ({
        type: item.type === 'creator' ? 'creator' : item.type === 'post' ? 'post' : 'trip',
        size: idx % 7 === 0 ? 'large' : (idx % 5 === 0 ? 'tall' : 'regular'),
        data: item.type === 'creator' ? { ...item, isFollowing: (typeof item.isFollowing === 'boolean') ? item.isFollowing : isFollowingUser(item._id || item.id) } : item
      }));
    } else if (exploreState.currentFilter === 'trips') {
      const trips = await apiRequest('/trips', 'GET').catch(() => []);
      allContent = (trips || []).map((t, i) => ({
        type: 'trip',
        size: i % 7 === 0 ? 'large' : (i % 5 === 0 ? 'tall' : 'regular'),
        data: t
      }));
    } else if (exploreState.currentFilter === 'creators') {
      const creators = await apiRequest('/leaderboard/users', 'GET').catch(() => []);
      allContent = (creators || []).map((c, i) => ({
        type: 'creator',
        size: i % 7 === 0 ? 'large' : (i % 5 === 0 ? 'tall' : 'regular'),
        data: c
      }));
    } else if (exploreState.currentFilter === 'nearby') {
      const defaultBounds = { neLat: 25, neLng: 85, swLat: 15, swLng: 70 }; // fallback India region
      const params = exploreState.mapInstance?.getBounds?.() || defaultBounds;
      const bounds = params.getNorthEast ? {
        neLat: params.getNorthEast().lat,
        neLng: params.getNorthEast().lng,
        swLat: params.getSouthWest().lat,
        swLng: params.getSouthWest().lng,
      } : defaultBounds;
      const query = `neLat=${bounds.neLat}&neLng=${bounds.neLng}&swLat=${bounds.swLat}&swLng=${bounds.swLng}`;
      const resp = await apiRequest(`/explore/nearby?${query}`, 'GET').catch(() => ({ items: [] }));
      const items = resp?.items || [];
      allContent = items.map((item, idx) => ({
        type: item.type === 'creator' ? 'creator' : 'trip',
        size: idx % 3 === 0 ? 'large' : 'regular',
        data: item
      }));
    }

    // Filter out current user
    allContent = allContent.filter(item => {
      const id = item.data.user?._id || item.data._id;
      return !currentUserId || id?.toString() !== currentUserId.toString();
    });

    // Shuffle for "For You"
    if (exploreState.currentFilter === 'for-you') {
      allContent = allContent.sort(() => Math.random() - 0.5);
    }

    exploreState.contentItems = allContent;

    if (allContent.length === 0) {
      const emptyIcons = {
        'for-you': '✨',
        'trending': '🔥',
        'trips': '🗺️',
        'creators': '👥',
        'nearby': '📍'
      };
      const emptyMessages = {
        'for-you': 'Nothing here yet',
        'trending': 'No trending content',
        'trips': 'No trips available',
        'creators': 'No creators found',
        'nearby': 'No one nearby'
      };
      const icon = emptyIcons[exploreState.currentFilter] || '🔍';
      const message = emptyMessages[exploreState.currentFilter] || 'No content found';
      container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--text-muted);"><div style="font-size:5rem;margin-bottom:20px;opacity:0.3;">${icon}</div><h3 style="margin-bottom:12px;font-size:1.5rem;color:var(--text-main);">${message}</h3><p style="font-size:0.95rem;">Try switching to a different filter or check back later</p></div>`;
      return;
    }

    // Render cards efficiently
    container.innerHTML = allContent.map(item => {
      const sizeClass = item.size || 'regular';
      
      if (item.type === 'creator') {
        return renderBentoCreatorCard(item.data, sizeClass);
      } else if (item.type === 'trip') {
        return renderBentoTripCard(item.data, sizeClass);
      } else if (item.type === 'post') {
        return renderBentoPostCard(item.data, sizeClass);
      }
      return '';
    }).join('');
  } catch (e) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--danger);"><i class="fas fa-exclamation-triangle" style="font-size:2rem;margin-bottom:12px;display:block;"></i>Failed to load content<br><small>Please try again</small></div>';
    console.error('Bento grid error:', e);
  }
}

function renderBentoCreatorCard(creator, sizeClass) {
  const u = creator.user || creator;
  const id = u._id;
  const username = u.username || 'Creator';
  const pic = (u.profilePicture || '').toString();
  const hasImg = pic && !/placeholder\.com/i.test(pic);
  const isFollowing = (typeof u.isFollowing === 'boolean') ? u.isFollowing : isFollowingUser(id);
  const badge = Math.random() > 0.7 ? '🏆 Top Creator' : '⭐ Rising Star';
  const mutualCount = Math.floor(Math.random() * 5);

  return `
    <div class="bento-card creator-bento ${sizeClass}" onclick="window.viewUserProfile('${id}')">
      <div class="creator-bento-header" style="background: linear-gradient(135deg, ${getAvatarColor(getAvatarSeed(u))}, ${getAvatarColor(getAvatarSeed(u) + 1)});">
        ${hasImg ? `<img src="${pic}" class="creator-bento-avatar" alt="${username}" onerror="this.style.display='none';">` : 
          `<div class="creator-bento-avatar" style="background: ${getAvatarColor(getAvatarSeed(u))}; display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">${username[0].toUpperCase()}</div>`
        }
      </div>
      <div class="creator-bento-content">
        <div class="creator-bento-name">${escapeHtml(username)}</div>
        <div class="creator-bento-handle">@${escapeHtml(username)}</div>
        <div class="creator-bento-badge">${badge}</div>
        ${mutualCount > 0 ? `<div class="creator-bento-mutuals">👥 <span>${mutualCount} mutual friend${mutualCount !== 1 ? 's' : ''}</span></div>` : ''}
        <div class="creator-bento-actions">
          <button class="btn secondary" onclick="event.stopPropagation(); window.viewUserProfile('${id}')">View</button>
          ${isFollowing
            ? `<button class="btn secondary" onclick="event.stopPropagation(); window.unfollowUser('${id}')">Following</button>`
            : `<button class="btn primary" onclick="event.stopPropagation(); window.followUser('${id}')">Follow</button>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderBentoTripCard(trip, sizeClass) {
  const id = trip._id;
  const destination = trip.destination?.city || trip.destination || trip.title || 'Untitled Trip';
  const costStr = trip.estimatedCost ? `₹${trip.estimatedCost.toLocaleString()}` : 'Price TBD';
  const participantCount = (trip.participants || []).length;
  const spotsLeft = Math.max(0, (trip.maxParticipants || 10) - participantCount);
  const hasImage = trip.coverImage && !/placeholder/.test(trip.coverImage);
  const now = Date.now();
  const start = trip.startDate ? new Date(trip.startDate).getTime() : null;
  const end = trip.endDate ? new Date(trip.endDate).getTime() : null;
  const isLive = start && end && now >= start && now <= end;
  const clickHandler = isLive ? `(window.openTripStory && window.openTripStory('${id}')) || window.openTripDetail('${id}')` : `window.openTripDetail('${id}')`;
  const avatars = (trip.participants || []).slice(0, 3).map(p => {
    const src = p.profilePicture && !/placeholder/.test(p.profilePicture) ? p.profilePicture : '';
    if (src) return `<img src="${src}" class="trip-avatar" onerror="this.style.display='none'" />`;
    const initial = (p.username || 'U')[0]?.toUpperCase?.() || 'U';
    return `<div class="trip-avatar" style="background:#0b1020;color:#fff;display:flex;align-items:center;justify-content:center;">${initial}</div>`;
  }).join('');
  const overflow = Math.max(0, participantCount - 3);
  const dateLabel = trip.startDate && trip.endDate
    ? `${new Date(trip.startDate).toLocaleDateString()} - ${new Date(trip.endDate).toLocaleDateString()}`
    : 'Flexible dates';
  const durationLabel = (trip.startDate && trip.endDate)
    ? `${Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))} days`
    : 'Plan together';

  return `
    <div class="trip-card-immersive ${sizeClass}" onclick="${clickHandler}" style="cursor:pointer;">
      ${hasImage ? `<img src="${trip.coverImage}" class="trip-immersive-img" alt="${destination}" onerror="this.style.display='none';">` :
        `<div class="trip-immersive-img" style="width:100%;height:200px;background:linear-gradient(135deg, rgba(124,93,255,0.3), rgba(16,185,129,0.3));"></div>`
      }

      <div class="trip-immersive-bottom">
        <div class="trip-immersive-text">
          <div class="trip-immersive-title">${escapeHtml(destination)}</div>
          <div class="trip-immersive-meta">
            <span>📍 ${trip.destination?.state || trip.destination?.country || 'Location TBD'}</span>
            <span class="dot">•</span>
            <span>${durationLabel}</span>
          </div>
          <p style="font-size:0.85rem; color:#bdbfc8; margin:4px 0 0 0;">Bring your crew and explore together.</p>
        </div>
      </div>

      <div class="trip-immersive-hidden">
        <div class="trip-immersive-hidden-inner">
          <button class="trip-actions-btn" onclick="event.stopPropagation(); window.openTripDashboard('${id}');">📊 Dashboard</button>
          <button class="trip-actions-btn" onclick="event.stopPropagation();">💰 Expenses</button>
          <button class="trip-actions-btn" onclick="event.stopPropagation(); window.openTripMap && window.openTripMap('${id}');">🗺️ Map</button>
        </div>
        <button class="trip-join-btn" onclick="event.stopPropagation(); window.joinTrip('${id}');"><i class="fas fa-plus"></i> Join Trip</button>
      </div>

      ${isLive ? '<div class="live-pill live-pill-top">LIVE</div>' : ''}
    </div>
  `;
}

function renderBentoPostCard(post, sizeClass) {
  const id = post._id;
  const author = post.author || { username: 'Creator', _id: '' };
  const content = (post.content || '').substring(0, 100);
  const likes = (post.likes || []).length;
  const comments = (post.comments || []).length;
  const shares = (post.shares || 0);

  return `
    <div class="bento-card post-bento ${sizeClass}" onclick="openPostPreview('${id}')">
      <div class="post-bento-header">
        ${author.profilePicture && !/placeholder/.test(author.profilePicture) ?
          `<img src="${author.profilePicture}" class="post-bento-avatar" alt="${author.username}" onerror="this.style.display='none';">` :
          `<div class="post-bento-avatar" style="background: ${getAvatarColor(getAvatarSeed(author))}; display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">${author.username?.[0]?.toUpperCase() || '?'}</div>`
        }
        <div class="post-bento-author">${escapeHtml(author.username || 'Creator')}</div>
      </div>
      <div class="post-bento-preview">${escapeHtml(content)}${content.length >= 100 ? '...' : ''}</div>
      ${post.mediaUrl && !/placeholder/.test(post.mediaUrl) ? `<img src="${post.mediaUrl}" class="post-bento-media" alt="Post media" onerror="this.style.display='none';">` : ''}
      <div class="post-bento-stats">
        <span>❤️ ${likes}</span>
        <span>💬 ${comments}</span>
        <span>↗️ ${shares}</span>
      </div>
    </div>
  `;
}

function initExploreFilters() {
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', async () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      exploreState.currentFilter = pill.dataset.exploreFilter;
      
      // Auto-geolocate for Near Me
      if (exploreState.currentFilter === 'nearby' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (exploreState.mapInstance) {
              exploreState.mapInstance.setView([pos.coords.latitude, pos.coords.longitude], 12);
            }
          },
          (err) => console.warn('Geolocation denied:', err)
        );
      }
      
      await loadExploreBentoGrid();
    });
  });
}

function initExploreViewToggle() {
  const gridBtn = document.getElementById('gridViewBtn');
  const mapBtn = document.getElementById('mapViewBtn');
  const gridContainer = document.getElementById('exploreGrid');
  const mapContainer = document.getElementById('mapViewContainer');

  if (gridBtn && mapBtn) {
    gridBtn.addEventListener('click', () => {
      gridBtn.classList.add('active');
      mapBtn.classList.remove('active');
      if (gridContainer) gridContainer.classList.remove('hidden');
      if (mapContainer) mapContainer.classList.add('hidden');
      exploreState.viewMode = 'grid';
    });

    mapBtn.addEventListener('click', () => {
      mapBtn.classList.add('active');
      gridBtn.classList.remove('active');
      if (gridContainer) gridContainer.classList.add('hidden');
      if (mapContainer) {
        mapContainer.classList.remove('hidden');
        initExploreMap();
      }
      exploreState.viewMode = 'map';
    });
  }
}

function initExploreMap() {
  // Check if Leaflet is available (from tripMapModal)
  if (typeof L === 'undefined') {
    const mapContainer = document.getElementById('mapViewContainer');
    if (mapContainer) {
      mapContainer.innerHTML = '<p style="text-align:center; padding:40px;">Map view requires Leaflet library. Loading...</p>';
    }
    return;
  }

  const mapElement = document.getElementById('explorerMap');
  if (!mapElement) return;

  try {
    if (!exploreState.mapInstance) {
      // Clear marker cache when creating new map
      cachedMarkers.clear();
      lastMapBounds = null;
      exploreState.heatCircles = [];
      exploreState.radarPulse = null;
      
      // Create map centered on India/Asia
      exploreState.mapInstance = L.map('explorerMap').setView([20, 78], 4);

      // Premium dark tile layer
      const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        maxZoom: 20
      });

      darkMatter.addTo(exploreState.mapInstance);

      exploreState.mapLayer = L.layerGroup().addTo(exploreState.mapInstance);

      buildMapControlDock();

      exploreState.mapInstance.on('moveend', async () => {
        await refreshNearbyOnMap();
      });

      // Warm start user location for radar visuals
      ensureUserLocation();
    }

    // Initial load of nearby pins
    refreshNearbyOnMap();
  } catch (e) {
    console.error('Map init error:', e);
  }
}

function buildMapControlDock() {
  if (!exploreState.mapInstance) return;
  const container = exploreState.mapInstance.getContainer();
  if (!container) return;

  const existing = container.querySelector('.map-control-dock');
  if (existing) existing.remove();

  const dock = L.DomUtil.create('div', 'map-control-dock');
  dock.innerHTML = `
    <button class="map-control-button" id="ghostModeToggle" title="Preview how you appear to others (visual only)">
      <span class="map-control-icon">👻</span>
      <span>Lowkey Mode</span>
    </button>
    <button class="map-control-button" id="tripRadarToggle" title="Show 9km search radius around your location">
      <span class="map-control-icon">📡</span>
      <span>Area Radar</span>
    </button>
  `;

  L.DomEvent.disableClickPropagation(dock);
  container.appendChild(dock);

  const ghostBtn = dock.querySelector('#ghostModeToggle');
  const radarBtn = dock.querySelector('#tripRadarToggle');

  const syncButtons = () => {
    ghostBtn.classList.toggle('active', exploreState.ghostMode);
    radarBtn.classList.toggle('active', exploreState.tripRadar);
  };

  ghostBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exploreState.ghostMode = !exploreState.ghostMode;
    syncButtons();
    cachedMarkers.clear();
    refreshNearbyOnMap();
    if (exploreState.ghostMode) {
      toast('Lowkey mode: Your marker appears dimmed (preview only)');
    } else {
      toast('Normal visibility restored');
    }
  });

  radarBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    exploreState.tripRadar = !exploreState.tripRadar;
    syncButtons();
    cachedMarkers.clear();
    await updateRadarPulse();
    refreshNearbyOnMap();
    if (exploreState.tripRadar) {
      toast('Radar active: Showing 9km search radius');
    } else {
      toast('Radar off');
    }
  });

  syncButtons();
}

function clearRadarPulse() {
  if (exploreState.radarPulse && exploreState.mapLayer) {
    exploreState.mapLayer.removeLayer(exploreState.radarPulse);
  }
  exploreState.radarPulse = null;
}

async function updateRadarPulse() {
  if (!exploreState.mapInstance || !exploreState.mapLayer) return;
  clearRadarPulse();
  if (!exploreState.tripRadar) return;

  const loc = await ensureUserLocation() || exploreState.mapInstance.getCenter();
  if (!loc) return;

  exploreState.radarPulse = L.circle([loc.lat, loc.lng], {
    radius: 9000,
    color: '#7c5dff',
    weight: 1,
    fillColor: '#7c5dff',
    fillOpacity: 0.08,
    className: 'radar-ring'
  }).addTo(exploreState.mapLayer);
}

function resetHeatmap() {
  if (!exploreState.heatCircles || !exploreState.mapLayer) return;
  exploreState.heatCircles.forEach(circle => exploreState.mapLayer.removeLayer(circle));
  exploreState.heatCircles = [];
}

async function ensureUserLocation() {
  if (exploreState.userLocation) return exploreState.userLocation;
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        exploreState.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(exploreState.userLocation);
      },
      (err) => {
        console.warn('Geolocation denied:', err);
        resolve(null);
      },
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 6000 }
    );
  });
}

let mapRefreshTimeout;
let lastMapBounds = null;
let cachedMarkers = new Map(); // Persistent marker cache

async function refreshNearbyOnMap() {
  if (!exploreState.mapInstance || !exploreState.mapLayer) return;
  
  // Debounce map updates to prevent excessive refreshes
  if (mapRefreshTimeout) clearTimeout(mapRefreshTimeout);
  
  mapRefreshTimeout = setTimeout(async () => {
    const bounds = exploreState.mapInstance.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    // Check if bounds changed significantly (>15% movement)
    if (lastMapBounds) {
      const latDiff = Math.abs(lastMapBounds.ne.lat - ne.lat);
      const lngDiff = Math.abs(lastMapBounds.ne.lng - ne.lng);
      const latRange = Math.abs(ne.lat - sw.lat);
      const lngRange = Math.abs(ne.lng - sw.lng);
      
      if (latDiff < latRange * 0.15 && lngDiff < lngRange * 0.15) {
        return; // Skip update for small movements
      }
    }
    
    lastMapBounds = { ne: { lat: ne.lat, lng: ne.lng }, sw: { lat: sw.lat, lng: sw.lng } };
    
    const query = `neLat=${ne.lat}&neLng=${ne.lng}&swLat=${sw.lat}&swLng=${sw.lng}`;
    try {
      const resp = await apiRequest(`/explore/nearby?${query}`, 'GET').catch(() => ({ items: [] }));
      const items = resp?.items || [];
      await updateRadarPulse();
      resetHeatmap();

      // Build lightweight heatmap glow for trip density
      const heatBuckets = {};
      items.filter(i => i.type === 'trip').forEach(trip => {
        const coords = trip.destination?.coordinates || trip.location?.coordinates || trip.coordinates;
        if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;
        const key = `${Math.round(coords.lat * 2) / 2}-${Math.round(coords.lng * 2) / 2}`;
        const weight = Math.max(1, Math.min((trip.participants || []).length, 25));
        if (!heatBuckets[key]) {
          heatBuckets[key] = { lat: coords.lat, lng: coords.lng, weight: 0 };
        }
        heatBuckets[key].weight += weight;
      });

      Object.values(heatBuckets).forEach(bucket => {
        const intensity = Math.min(bucket.weight / 30, 1);
        const radius = 10000 + bucket.weight * 300;
        const circle = L.circle([bucket.lat, bucket.lng], {
          radius,
          color: 'transparent',
          weight: 0,
          fillColor: 'rgba(245, 158, 11, 0.45)',
          fillOpacity: 0.35 * intensity,
          className: 'heat-glow'
        }).addTo(exploreState.mapLayer);
        exploreState.heatCircles.push(circle);
      });
      
      // Remove markers that are no longer in view
      const newIds = new Set(items.map(i => i._id || i.id));
      for (const [markerId, marker] of cachedMarkers.entries()) {
        if (!newIds.has(markerId)) {
          exploreState.mapLayer.removeLayer(marker);
          cachedMarkers.delete(markerId);
        }
      }

      // Add or update markers
      items.forEach(item => {
        const itemId = item._id || item.id;
        if (!itemId) return;
        const coords = item.coordinates || item.destination?.coordinates || item.location?.coordinates;
        if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;
        
        // Use exact coordinates from data
        const lat = parseFloat(coords.lat);
        const lng = parseFloat(coords.lng);
        
        if (isNaN(lat) || isNaN(lng)) return;

        const isCurrentUser = state?.user?._id && itemId?.toString() === state.user._id.toString();
        const ghostActive = exploreState.ghostMode && isCurrentUser;
        const hasStory = !!(item.hasStory || (Array.isArray(item.stories) && item.stories.length));

        // Always rebuild marker to reflect styling changes but keep cache references clean
        if (cachedMarkers.has(itemId)) {
          exploreState.mapLayer.removeLayer(cachedMarkers.get(itemId));
          cachedMarkers.delete(itemId);
        }
        
        let marker;
        if (item.type === 'creator' && item.profilePicture && !/placeholder/.test(item.profilePicture)) {
          const ringClass = hasStory ? 'story-ring' : '';
          const borderColor = ghostActive ? '#6b7280' : '#7c5dff';
          const opacity = ghostActive ? 0.45 : 1;
          const shadowOpacity = ghostActive ? 0.25 : 0.4;
          const avatarIcon = L.divIcon({
            className: 'custom-avatar-marker',
            html: `<div class="${ringClass}" style="width:44px;height:44px;border-radius:50%;border:3px solid ${borderColor};overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,${shadowOpacity});background:rgba(17,24,39,0.9);opacity:${opacity};"><img src="${item.profilePicture}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/></div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 44],
            popupAnchor: [0, -22]
          });
          marker = L.marker([lat, lng], { icon: avatarIcon }).addTo(exploreState.mapLayer);
          marker.bindPopup(`<div style="min-width:200px;padding:10px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <img src="${item.profilePicture}" style="width:34px;height:34px;border-radius:50%;border:2px solid ${borderColor};opacity:${opacity};" onerror="this.style.display='none'"/>
              <div>
                <strong>@${escapeHtml(item.username || 'creator')}</strong>
                <div style="color:#9ca3af;font-size:12px;">${escapeHtml(item.fullName || '')}</div>
              </div>
            </div>
            ${hasStory ? '<div style="color:#a78bfa;font-weight:600;">Story live now</div>' : ''}
            ${ghostActive ? '<div style="color:#9ca3af;font-size:12px;margin-top:6px;">Lowkey preview: dimmed appearance</div>' : ''}
          </div>`);
        } else {
          // Custom pin markers for trips and creators without avatars
          const getInitial = (txt) => (txt || '•').trim().charAt(0).toUpperCase();
          const size = item.type === 'creator' ? 38 : 36;
          const shadowOpacity = ghostActive ? 0.25 : 0.4;
          let bg, label, borderColor;
          
          if (item.type === 'creator') {
            bg = ghostActive ? '#6b7280' : '#10b981';
            label = getInitial(item.username || item.fullName || 'U');
            borderColor = '#ffffff';
          } else {
            bg = ghostActive ? '#6b7280' : 'linear-gradient(135deg, #6c5dd3, #60a5fa)';
            label = getInitial(item.title || item.destination?.city || 'T');
            borderColor = '#ffffff';
          }
          
          const opacity = ghostActive ? 0.5 : 1;
          const fontSize = item.type === 'creator' ? 14 : 16;
          const iconContent = item.type === 'creator' 
            ? `<span style="color:#fff;font-weight:700;font-size:${fontSize}px;">${label}</span>`
            : `<i class="fas fa-map-marker-alt" style="color:#fff;font-size:18px;"></i>`;
          const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${borderColor};box-shadow:0 6px 18px rgba(0,0,0,${shadowOpacity});background:${bg};display:flex;align-items:center;justify-content:center;opacity:${opacity};">${iconContent}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [0, -size / 2]
          });
          
          marker = L.marker([lat, lng], { icon: customIcon }).addTo(exploreState.mapLayer);

          if (item.type === 'creator') {
            marker.bindPopup(`<div style="min-width:180px;padding:8px;"><strong style="color:${ghostActive ? '#9ca3af' : '#10b981'};">@${escapeHtml(item.username || 'creator')}</strong><br><p style="color:#6b7280;font-size:0.85rem;margin:4px 0 0 0;">${escapeHtml(item.fullName || 'Creator')}</p>${ghostActive ? '<div style="color:#9ca3af;font-size:12px;margin-top:6px;">Lowkey preview mode</div>' : ''}</div>`);
          } else {
            const participants = Array.isArray(item.participants) ? item.participants.length : 0;
            marker.bindPopup(`<div style="min-width:200px;padding:8px;"><strong style="color:${ghostActive ? '#9ca3af' : '#7c5dff'};">${escapeHtml(item.title || item.destination?.city || 'Trip')}</strong><br><p style="color:#6b7280;font-size:0.85rem;margin:4px 0 0 0;">👥 ${participants} joining</p>${exploreState.tripRadar ? '<div style="color:#a78bfa;font-weight:600;margin-top:6px;">Within radar range</div>' : ''}</div>`);
          }
        }
        cachedMarkers.set(itemId, marker);
      });
    } catch (err) {
      console.error('Nearby map error:', err);
    }
  }, 500); // 500ms debounce
}
function changeHomeFilter(filter) {
  if (!filter || state.homeFilter === filter) return;
  state.homeFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  refreshFeedView();
}

let searchTimeout;
async function updateSearch(query) {
  const searchQuery = (query || '').trim();
  state.searchQuery = searchQuery.toLowerCase();
  const clearBtn = document.getElementById('btnClearSearch');
  const resultsEl = document.getElementById('searchResults');

  if (clearBtn) clearBtn.classList.toggle('hidden', !state.searchQuery.length);

  if (searchTimeout) clearTimeout(searchTimeout);

  if (searchQuery.length < 2) {
    if (resultsEl) {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
    }
    refreshFeedView();
    return;
  }

  // Show user search results
  searchTimeout = setTimeout(async () => {
    try {
      const users = await apiRequest(`/users/search/${encodeURIComponent(searchQuery)}`, 'GET');
      const currentUserId = getCurrentUserId();
      const filteredUsers = Array.isArray(users)
        ? users.filter(u => {
          const id = (u?._id?.toString?.() || u?._id || '').toString();
          return !currentUserId || id !== currentUserId;
        })
        : [];
      if (resultsEl) {
        if (filteredUsers && filteredUsers.length > 0) {
          // Enrich users to determine mutual-follow relationships (fetch details in parallel)
          const enriched = await Promise.all(filteredUsers.map(async (u) => {
            try {
              const detail = await apiRequest(`/users/${u._id}`, 'GET');
              return { base: u, detail };
            } catch (e) {
              return { base: u, detail: null };
            }
          }));

          resultsEl.innerHTML = enriched.map(item => {
            const u = item.base;
            const d = item.detail;
            const initials = (u.username || 'U')[0].toUpperCase();
            const isFollowing = state.user?.following?.some(followId => {
              const followIdStr = typeof followId === 'object' ? followId._id?.toString() || followId.toString() : followId.toString();
              return followIdStr === u._id.toString();
            });
            const isMutual = !!(d && state.user && state.user.following && d.following && state.user.following.some(ff => (ff._id || ff).toString() === u._id.toString()) && d.following.some(ff => (ff._id || ff).toString() === state.user._id.toString()));
            return `
              <div class="search-result-item" style="padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; display:flex; align-items:center; gap:12px; transition:background 0.2s ease;" onmouseover="this.style.background='rgba(124,93,255,0.1)'" onmouseout="this.style.background='transparent'" onclick="window.viewUserProfile('${u._id}'); document.getElementById('searchResults').classList.add('hidden');">
                ${renderAvatar(u, 40)}
                <div style="flex:1;">
                  <div style="font-weight:bold; margin-bottom:4px;">${highlightMatch(u.fullName || u.username, searchQuery)}</div>
                  <div style="font-size:0.85rem; color:var(--text-muted);">@${highlightMatch(u.username, searchQuery)}</div>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                  ${isMutual ? `<span class="badge" style="background:rgba(51,225,173,0.15); color:#33e1ad; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:600;">Mutual</span>` : ''}
                  ${!isFollowing ? `<button class="btn primary" style="padding:6px 12px; font-size:0.85rem;" onclick="event.stopPropagation(); window.followUser('${u._id}');">Follow</button>` : ''}
                  <button class="btn secondary" style="padding:6px 12px; font-size:0.85rem;" onclick="event.stopPropagation(); window.startChatWithUser('${u._id}', '${u.username}'); document.getElementById('searchResults').classList.add('hidden');" title="Send message">
                    <i class="fas fa-envelope"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('');
          resultsEl.classList.remove('hidden');
        } else {
          resultsEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">No users found</div>';
          resultsEl.classList.remove('hidden');
        }
      }
    } catch (e) {
      console.error('Search error:', e);
      if (resultsEl) resultsEl.classList.add('hidden');
    }
  }, 300);

  refreshFeedView();
}

function applyFeedFilters() {
  let posts = [...state.feedCache];
  switch (state.homeFilter) {
    case 'media':
      posts = posts.filter(p => !!p.mediaUrl);
      break;
    case 'following':
      if (state.user?.following?.length) {
        posts = posts.filter(p => state.user.following.includes(p.author._id));
      }
      break;
    case 'popular':
      posts = posts.filter(p => (p.likes?.length || 0) >= 3);
      break;
    default:
      break;
  }
  if (state.searchQuery) {
    posts = posts.filter(p => {
      const haystack = `${p.author?.username || ''} ${p.content || ''}`.toLowerCase();
      return haystack.includes(state.searchQuery);
    });
  }
  return posts;
}

function refreshFeedView() {
  const container = document.getElementById('feedList');
  if (!container) return;
  const posts = applyFeedFilters();
  renderPosts(posts, container, false); // Don't show delete button in home feed
}

function updateHomeMetrics() {
  const postsCount = state.feedCache.length;
  const stories = Array.isArray(state.stories) ? state.stories : [];
  const signals = state.feedCache.reduce((acc, p) => acc + (p.likes?.length || 0) + (p.comments?.length || 0), 0)
    + stories.reduce((acc, g) => acc + (g.stories?.length || 0), 0);
  const metrics = {
    metricPosts: postsCount,
    metricTrips: state.tripCount,
    metricSignals: signals
  };
  Object.entries(metrics).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function renderPosts(posts, container, showDeleteButton = false) {
  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No posts yet. Be the first!</p>';
    return;
  }

  const currentUserId = state.user?._id;
  const currentUserIdStr = currentUserId?.toString();
  container.innerHTML = posts.map(p => {
    const likes = Array.isArray(p.likes) ? p.likes : [];
    const comments = Array.isArray(p.comments) ? p.comments : [];
    // Check if current user liked this post
    const isLiked = currentUserIdStr && likes.some(likeId => {
      const likeIdStr = typeof likeId === 'object' ? likeId._id?.toString() || likeId.toString() : likeId.toString();
      return likeIdStr === currentUserIdStr;
    });
    const isMyPost = currentUserIdStr && (p.author._id?.toString() === currentUserIdStr || p.author.toString() === currentUserIdStr);
    const date = formatTimeAgo(p.createdAt);
    const displayName = p.author.fullName || p.author.username || 'Creator';
    const handle = p.author.username ? `@${p.author.username}` : '';

    return `
      <article class="post-card" data-post-id="${p._id}">
        <div class="post-header">
          <button class="post-author" type="button" onclick="window.viewUserProfile('${p.author._id}')">
            ${renderAvatar(p.author, 44)}
            <div class="post-meta">
              <h4>${displayName}</h4>
              <span>${handle}</span>
            </div>
          </button>
          <div style="display:flex; align-items:center; gap:12px;">
            ${(showDeleteButton && isMyPost) ? `<button class="ghost-icon" style="color:var(--danger); padding:6px;" onclick="event.stopPropagation(); event.preventDefault(); window.deletePost('${p._id}')" title="Delete post"><i class="fas fa-trash"></i></button>` : ''}
            <span class="post-time" style="color:var(--text-muted); font-size:0.85rem; white-space:nowrap;">${date}</span>
          </div>
        </div>

        <div class="post-content">${escapeHtml(p.content)}</div>
        ${renderMedia(p.mediaUrl || p.image)}

        <div class="post-footer">
          <button type="button" class="post-action ${isLiked ? 'liked' : ''}" data-action="like" data-id="${p._id}">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
            <span>${likes.length}</span>
          </button>
          <button type="button" class="post-action" data-action="comment" data-id="${p._id}">
            <i class="far fa-comment"></i>
            <span>${comments.length}</span>
          </button>
          <button type="button" class="post-action" data-action="share" data-id="${p._id}" title="Share post">
            <i class="far fa-share-square"></i>
          </button>
        </div>

        <div id="comments-${p._id}" class="comments-wrap hidden">
          ${comments.map(c => {
      const commentText = c.text || '';
      const isGif = commentText.match(/^https?:\/\/.*\.gif/i) || commentText.includes('giphy.com');
      return `
             <div class="comment-item">
               <strong style="color: var(--primary)">${c.user?.username || c.username || 'User'}</strong>
               ${isGif
          ? `<div style="margin-top:8px;"><img src="${commentText}" alt="GIF" style="max-width:200px; max-height:200px; border-radius:8px;" onerror="this.parentElement.innerHTML='<span style=\\'color:var(--text-main)\\'>${escapeHtml(commentText)}</span>'"></div>`
          : `<span style="color: var(--text-main)">${escapeHtml(commentText)}</span>`
        }
             </div>
          `;
    }).join('')}
          <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
            <input type="text" class="comment-input" data-id="${p._id}" placeholder="Write a comment..." style="flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:var(--input-bg); color:var(--text-main);">
            <button type="button" class="ai-comment-btn" onclick="event.stopPropagation(); window.generateAiComment('${p._id}')" title="AI comment suggestion">
              <i class="fas fa-robot"></i>
              <span>AI reply</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
  
  // Activate lazy loading for images
  setTimeout(() => {
    if (window.FrontendPerformance?.lazyLoader) {
      window.FrontendPerformance.lazyLoader.observeAll('.lazy-img');
    }
  }, 0);
}

function renderPostHtml(p, showDeleteButton = false) {
  const likes = Array.isArray(p.likes) ? p.likes : [];
  const comments = Array.isArray(p.comments) ? p.comments : [];
  const currentUserId = state.user?._id;
  const currentUserIdStr = currentUserId?.toString();
  const isLiked = currentUserIdStr && likes.some(likeId => {
    const likeIdStr = typeof likeId === 'object' ? likeId._id?.toString() || likeId.toString() : likeId.toString();
    return likeIdStr === currentUserIdStr;
  });
  const isMyPost = currentUserIdStr && (p.author._id?.toString() === currentUserIdStr || p.author.toString() === currentUserIdStr);
  const date = formatTimeAgo(p.createdAt);
  const displayName = p.author.fullName || p.author.username || 'Creator';
  const handle = p.author.username ? `@${p.author.username}` : '';

  return `
    <article class="post-card" data-post-id="${p._id}">
      <div class="post-header">
        <button class="post-author" type="button" onclick="window.viewUserProfile('${p.author._id}')">
          ${renderAvatar(p.author, 44)}
          <div class="post-meta">
            <h4>${displayName}</h4>
            <span>${handle}</span>
          </div>
        </button>
        <div style="display:flex; align-items:center; gap:12px;">
          ${(showDeleteButton && isMyPost) ? `<button class="ghost-icon" style="color:var(--danger); padding:6px;" onclick="event.stopPropagation(); event.preventDefault(); window.deletePost('${p._id}')" title="Delete post"><i class="fas fa-trash"></i></button>` : ''}
          <span class="post-time" style="color:var(--text-muted); font-size:0.85rem; white-space:nowrap;">${date}</span>
        </div>
      </div>

      <div class="post-content">${escapeHtml(p.content)}</div>
      ${renderMedia(p.mediaUrl || p.image)}

      <div class="post-footer">
        <button type="button" class="post-action ${isLiked ? 'liked' : ''}" data-action="like" data-id="${p._id}">
          <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          <span>${likes.length}</span>
        </button>
        <button type="button" class="post-action" data-action="comment" data-id="${p._id}">
          <i class="far fa-comment"></i>
          <span>${comments.length}</span>
        </button>
        <button type="button" class="post-action" data-action="share" data-id="${p._id}" title="Share post">
          <i class="far fa-share-square"></i>
        </button>
      </div>

      <div id="comments-${p._id}" class="comments-wrap hidden">
        ${comments.map(c => {
    const commentText = c.text || '';
    const isGif = commentText.match(/^https?:\/\/.*\.gif/i) || commentText.includes('giphy.com');
    return `
           <div class="comment-item">
             <strong style="color: var(--primary)">${c.user?.username || c.username || 'User'}</strong>
             ${isGif
        ? `<div style="margin-top:8px;"><img src="${commentText}" alt="GIF" style="max-width:200px; max-height:200px; border-radius:8px;" onerror="this.parentElement.innerHTML='<span style=\\'color:var(--text-main)\\'>${escapeHtml(commentText)}</span>'"></div>`
        : `<span style="color: var(--text-main)">${escapeHtml(commentText)}</span>`
      }
           </div>
        `;
  }).join('')}
        <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
          <input type="text" class="comment-input" data-id="${p._id}" placeholder="Write a comment..." style="flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:var(--input-bg); color:var(--text-main);">
          <button type="button" class="ai-comment-btn" onclick="event.stopPropagation(); window.generateAiComment('${p._id}')" title="AI comment suggestion">
            <i class="fas fa-robot"></i>
            <span>AI reply</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

function updateSinglePostInDOM(post) {
  try {
    // Update feed cache
    if (Array.isArray(state.feedCache)) {
      const idx = state.feedCache.findIndex(p => p._id === post._id || p._id?.toString() === post._id?.toString());
      if (idx > -1) state.feedCache[idx] = post;
    }

    // Update any rendered post-card elements
    const existing = document.querySelectorAll(`.post-card[data-post-id="${post._id}"]`);
    existing.forEach(el => {
      const parent = el.parentElement;
      if (!parent) return;
      const showDelete = parent.closest('#profileFeed') ? true : false;
      const html = renderPostHtml(post, showDelete);
      // Replace element
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const newEl = temp.firstElementChild;
      el.replaceWith(newEl);
    });
  } catch (e) { console.error('updateSinglePostInDOM error', e); }
}

function renderMedia(url) {
  if (!url || url.trim() === '') return '';
  const cleanUrl = url.trim();
  let mime = '';
  let ext = '';
  if (cleanUrl.startsWith('data:')) {
    mime = cleanUrl.slice(5, cleanUrl.indexOf(';'));
  } else {
    ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
  }
  const isVideo = mime.startsWith('video') || ['mp4', 'webm', 'ogg'].includes(ext);
  if (isVideo) {
    return `<video src="${cleanUrl}" controls class="post-media" preload="metadata" style="width:100%; max-height:500px; border-radius:12px; margin-top:12px;"></video>`;
  }
  // Use data-src for lazy loading
  return `<img data-src="${cleanUrl}" class="post-media lazy-img" alt="Post media" loading="lazy" decoding="async" style="width:100%; max-height:500px; object-fit:contain; border-radius:12px; margin-top:12px; background:var(--card-bg);" onerror="this.style.display='none';">`;
}

// --- Trips ---
async function loadTrips() {
  const container = document.getElementById('tripList');
  const widget = document.getElementById('journeyWidget');
  if (!container && !widget) return;
  if (container) container.innerHTML = createSkeletonLoader('card', 3);
  if (widget) widget.innerHTML = '<small>Syncing journeys...</small>';
  try {
    const trips = await apiRequest('/trips', 'GET');
    state.tripCount = Array.isArray(trips) ? trips.length : 0;
    updateHomeMetrics();
    if (!Array.isArray(trips) || trips.length === 0) {
      if (container) container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-map-marked-alt" style="font-size:3rem; margin-bottom:10px; display:block;"></i><p>No active trips yet.</p><button class="btn primary" style="margin-top:15px;" onclick="window.openComposer(\'trip\')">Create Your First Trip</button></div>';
      if (widget) widget.innerHTML = '<small>No journeys yet.</small>';
      return;
    }
    if (container) {
      container.innerHTML = trips.map(t => {
        const myId = state?.user?._id ? state.user._id.toString() : '';
        const isParticipant = Array.isArray(t.participants) && t.participants.some(p => {
          const userId = (p?.user?._id || p?.user);
          // Only consider participants with confirmed/host status as joined members
          return myId && userId && userId.toString() === myId && ['host', 'confirmed'].includes(p.status);
        });
        const isHost = myId && ((t?.host?._id && t.host._id.toString() === myId) || (t?.host && t.host.toString() === myId));
        const participantsCount = t.participants?.length || 0;
        const maxParticipants = t.maxParticipants || 8;
        const startDate = t.startDate ? new Date(t.startDate).toLocaleDateString() : 'TBD';
        const endDate = t.endDate ? new Date(t.endDate).toLocaleDateString() : 'TBD';
        const city = t.destination?.city || 'Unknown';
        const country = t.destination?.country || '';
        const coverImg = t.coverImage || 'https://images.unsplash.com/photo-1502920917128-1aa500764b43?auto=format&fit=crop&w=600&q=60';
        const contactPhone = (t.contactPhone || '').trim();

        return `
          <article class="journey-card">
            <div class="journey-hero" style="background-image:url('${coverImg}')"></div>
            <div class="journey-body">
              <div class="journey-meta">
                <h4>${escapeHtml(t.title || 'Untitled Trip')}</h4>
                <span>${escapeHtml(city)}${country ? ', ' + escapeHtml(country) : ''}</span>
              </div>
              <p>${escapeHtml(t.description || 'Bring your crew and explore together.')}</p>
              ${contactPhone ? `<p class="journey-contact"><i class="fas fa-phone"></i> ${escapeHtml(contactPhone)}</p>` : ''}
              <div class="journey-foot">
                <span><i class="fas fa-calendar"></i> ${startDate} - ${endDate}</span>
                <span><i class="fas fa-users"></i> ${participantsCount}/${maxParticipants}</span>
              </div>
              <div class="journey-actions journey-actions-row">
                ${(isHost || isParticipant) ? `<button class="btn secondary" onclick="window.openTripDashboard('${t._id}')"><i class="fas fa-columns"></i> Dashboard</button>` : ''}
                ${(isHost || isParticipant) ? `<button class="btn secondary" onclick="window.openTripExpenses('${t._id}')"><i class="fas fa-receipt"></i> Expenses</button>` : ''}
                <button class="btn secondary" onclick="window.openTripMap('${t._id}')"><i class="fas fa-map"></i> Map</button>
              </div>
            </div>
            ${isHost
            ? `<div class="journey-actions journey-actions-row" style="padding:0 16px 16px; gap:12px;">
                  <button class="btn secondary" disabled style="margin-right:8px;"><i class="fas fa-crown"></i> Host</button>
                  <button class="btn danger" onclick="window.deleteTrip('${t._id}')" style="margin-left:8px;"><i class="fas fa-trash"></i> Delete</button>
                </div>`
            : isParticipant
              ? `<div class="journey-actions journey-actions-row" style="padding:0 16px 16px; gap:12px;">
                   <button class="btn secondary" disabled style="margin-right:8px;"><i class="fas fa-check"></i> Joined</button>
                   <button class="btn danger" onclick="window.leaveTrip('${t._id}')" style="margin-left:8px;"><i class="fas fa-sign-out-alt"></i> Leave</button>
                 </div>`
              : participantsCount >= maxParticipants
                ? `<div style="padding:0 16px 16px; display:flex; justify-content:center;">
                     <button class="btn secondary" disabled><i class="fas fa-hourglass-half"></i> Full</button>
                   </div>`
                : `<div style="padding:0 16px 16px; display:flex; justify-content:center;">
                     <button class="btn primary trip-join-btn" onclick="window.joinTrip('${t._id}')"><i class="fas fa-plus"></i> Join</button>
                   </div>`
          }
          </article>
        `;
      }).join('');
    }
    if (widget) {
      widget.innerHTML = trips.slice(0, 3).map(t => `
        <div class="journey-widget-item">
          <div>
            <strong>${escapeHtml(t.title || 'Trip')}</strong>
            <p>${escapeHtml(t.destination?.city || 'Unknown')}${t.destination?.country ? ', ' + escapeHtml(t.destination.country) : ''}</p>
          </div>
          <small>${t.startDate ? new Date(t.startDate).toLocaleDateString() : 'TBD'}</small>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Load trips error:', e);
    if (container) container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger);">Failed to load trips. Please try again.</div>';
    if (widget) widget.innerHTML = '<small>Unable to sync.</small>';
  }
}

window.leaveTrip = async function (tripId) {
  if (!confirm('Are you sure you want to leave this trip?')) return;
  try {
    await apiRequest(`/trips/${tripId}/leave`, 'POST');
    toast('You left the trip');
    loadTrips();
  } catch (e) {
    console.error('Leave trip error:', e);
    toast(e.message || 'Unable to leave trip', 'error');
  }
};

// --- Leaderboard (God Level) ---
async function loadLeaderboard() {
  const podiumEl = document.getElementById('lbPodium');
  const listEl = document.getElementById('lbList');
  if (!podiumEl && !listEl) return;

  if (podiumEl) podiumEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading leaderboard...</div>';
  if (listEl) listEl.innerHTML = '';

  try {
    const users = await apiRequest('/leaderboard/daily', 'GET');
    if (!users || !users.length) {
      if (podiumEl) podiumEl.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-trophy" style="font-size:3rem; margin-bottom:10px; display:block;"></i><p>No leaderboard data yet. Start posting to get on the board!</p></div>';
      if (listEl) listEl.innerHTML = '';
      return;
    }

    const top3 = users.slice(0, 3);
    const rest = users.slice(3);

    if (podiumEl) {
      podiumEl.innerHTML = '';
      // Render Podium: 2nd, 1st, 3rd logic
      if (top3[1]) podiumEl.innerHTML += renderPodiumPlace(top3[1], 2);
      if (top3[0]) podiumEl.innerHTML += renderPodiumPlace(top3[0], 1);
      if (top3[2]) podiumEl.innerHTML += renderPodiumPlace(top3[2], 3);
    }

    if (listEl) {
      listEl.innerHTML = rest.length > 0 ? rest.map((u, i) => {
        const username = u.user?.username || u.user?.fullName || 'User';
        const fullName = u.user?.fullName || '';
        const initials = username[0]?.toUpperCase() || 'U';
        const score = u.score || 0;
        return `
          <div class="lb-row" style="display:flex; align-items:center; padding:14px 20px; border-bottom:1px solid var(--border); gap:14px; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-panel)'" onmouseout="this.style.background='transparent'">
            <div style="font-weight:bold; color:var(--text-muted); min-width:45px; font-size:1rem;">#${i + 4}</div>
            <div style="flex:1; display:flex; align-items:center; gap:12px;">
              <div class="orb" style="width:42px; height:42px; font-size:1rem; font-weight:bold;">${initials}</div>
              <div style="flex:1;">
                <strong style="display:block; color:var(--text-main); font-size:1rem; margin-bottom:2px;">${escapeHtml(username)}</strong>
                ${fullName && fullName !== username ? `<div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:2px;">${escapeHtml(fullName)}</div>` : ''}
                <small style="color:var(--text-muted); font-size:0.85rem;">${u.likes || 0} likes • ${u.posts || 0} posts</small>
              </div>
            </div>
            <div style="color:var(--primary); font-weight:bold; font-size:1.2rem; min-width:60px; text-align:right;">${score} pts</div>
          </div>
        `;
      }).join('') : '<div style="text-align:center; padding:20px; color:var(--text-muted);">No more entries</div>';
    }
  } catch (e) {
    console.error('Load leaderboard error:', e);
    if (podiumEl) podiumEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger);">Failed to load leaderboard.</div>';
    if (listEl) listEl.innerHTML = '';
  }
}

function renderPodiumPlace(u, rank) {
  const username = u.user?.username || u.user?.fullName || 'User';
  const fullName = u.user?.fullName || '';
  const initials = username[0]?.toUpperCase() || 'U';
  const score = u.score || 0;
  const height = rank === 1 ? '180px' : rank === 2 ? '150px' : '120px';
  const bgColor = rank === 1 ? 'var(--primary)' : rank === 2 ? '#c0c0c0' : '#cd7f32';

  return `
    <div class="podium-place" style="display:flex; flex-direction:column; align-items:center; min-width:140px;">
      <div style="width:90px; height:90px; border-radius:50%; background:${bgColor}; display:flex; align-items:center; justify-content:center; color:white; font-size:2.2rem; font-weight:bold; margin-bottom:12px; border:4px solid var(--bg-panel); box-shadow:0 4px 15px rgba(0,0,0,0.2);">${initials}</div>
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:14px; text-align:center; min-width:120px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="font-weight:bold; margin-bottom:4px; color:var(--text-main); font-size:1rem;">${escapeHtml(username)}</div>
        ${fullName && fullName !== username ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:6px;">${escapeHtml(fullName)}</div>` : ''}
        <div style="color:var(--primary); font-size:1.3rem; font-weight:bold; margin-bottom:4px;">${score} pts</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">${u.likes || 0} likes</div>
      </div>
      <div style="margin-top:12px; font-size:2.5rem;">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</div>
    </div>
  `;
}

// --- Messaging ---
async function loadChats() {
  const container = document.getElementById('chatList');
  try {
    const chats = await apiRequest('/messages/conversations', 'GET');
    state.chats = Array.isArray(chats) ? [...chats] : [];
    // Sort chats by most recent message
    if (Array.isArray(state.chats)) {
      state.chats.sort((a, b) => {
        const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return tb - ta;
      });
    }
    if (!state.chats.length) {
      container.innerHTML = '<p style="padding:20px;">No conversations.</p>';
      return state.chats;
    }
    container.innerHTML = state.chats.map(c => {
      const isActive = state.activeChatId === c.user._id ? 'active' : '';
      const snippet = c.lastMessage ? c.lastMessage.content : 'Started a chat';
      const time = c.lastMessage?.createdAt ? formatTimeAgo(c.lastMessage.createdAt) : '';
      return `
        <div class="chat-item ${isActive}" data-id="${c.user._id}" data-username="${c.user.username}">
           <div class="follow-drawer-avatar" style="width:40px; height:40px;">${renderAvatar(c.user, 40)}</div>
           <div style="flex:1; min-width:0;">
             <div style="font-weight:bold; color:var(--text-main); display:flex; align-items:center; justify-content:space-between; gap:8px;">
               <span style="display:flex; align-items:center; gap:6px;">
                 <span class="status-dot"></span>
                 ${c.user.username}
               </span>
               <small style="color:var(--text-muted);">${time}</small>
             </div>
             <div style="font-size:0.85rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
               ${snippet}
             </div>
           </div>
        </div>
      `;
    }).join('');
    highlightActiveChat();
    if (!state.activeChatId) {
      updateChatSubline('Choose a contact to open the thread.');
    }
    return state.chats;
  } catch (e) {
    container.innerHTML = '<p>Error loading chats.</p>';
    state.chats = [];
    return [];
  }
}

async function loadMessages(uid, uname) {
  state.activeChatId = uid;
  const headerEl = document.getElementById('chatHeader');
  if (headerEl && uname) headerEl.textContent = uname;

  const area = document.getElementById('msgArea');
  if (!area) return;
  area.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading messages...</div>';

  try {
    const msgs = await apiRequest(`/messages/${uid}`, 'GET');
    if (!msgs || msgs.length === 0) {
      area.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-comments" style="font-size:2rem; margin-bottom:10px; display:block;"></i><p>No messages yet. Start the conversation!</p></div>';
      updateChatSubline('No messages yet');
      return;
    }

    const myId = state?.user?._id ? state.user._id.toString() : '';
    area.innerHTML = msgs.map(m => {
      const senderId = m.sender?._id || m.sender;
      const isMine = myId && senderId && (senderId.toString() === myId);
      const content = m.content || '';
      const time = formatTimeAgo(m.createdAt);
      const hasMedia = m.mediaUrl || (m.messageType && m.messageType !== 'text');

      let mediaHtml = '';
      if (hasMedia && m.mediaUrl) {
        if (m.messageType === 'image') {
          mediaHtml = `<img src="${m.mediaUrl}" loading="lazy" style="max-width:100%; max-height:300px; border-radius:12px; margin-bottom:8px; object-fit:contain;" alt="Shared image" onerror="this.style.display='none';">`;
        } else if (m.messageType === 'video') {
          mediaHtml = `<video src="${m.mediaUrl}" controls style="max-width:100%; max-height:300px; border-radius:12px; margin-bottom:8px;" alt="Shared video"></video>`;
        } else {
          const fileName = content || 'File';
          mediaHtml = `<div style="padding:12px; background:var(--bg-card); border-radius:8px; margin-bottom:8px; display:flex; align-items:center; gap:10px;"><i class="fas fa-file" style="font-size:1.5rem;"></i><span>${escapeHtml(fileName)}</span></div>`;
        }
      }

      const sharedPostId = (!hasMedia) ? extractSharedPostId(content) : '';
      const textHtml = (!hasMedia || m.messageType === 'text') ? `<div class="msg-content">${escapeHtml(content.replace(/https?:\/\/[^\s]+/g, '').trim())}</div>` : '';
      const actionHtml = sharedPostId ? `<div style="margin-top:8px;"><button class="btn secondary" data-open-post="${sharedPostId}"><i class="fas fa-external-link-alt"></i> Open Post</button></div>` : '';
      const deleteBtn = isMine ? `<button class="msg-delete-btn" data-delete-msg="${m._id}" title="Delete message"><i class="fas fa-times"></i></button>` : '';
      return `
        <div class="msg ${isMine ? 'mine' : 'theirs'}" data-msg-id="${m._id}">
          ${mediaHtml}
          ${textHtml}
          ${actionHtml}
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:4px;">
            <small class="msg-time">${time}</small>
            ${deleteBtn}
          </div>
        </div>
      `;
    }).join('');

    // Wire up open-post buttons
    area.querySelectorAll('button[data-open-post]').forEach(btn => {
      btn.addEventListener('click', () => openPostPreview(btn.dataset.openPost));
    });

    // Wire up delete message buttons
    area.querySelectorAll('button[data-delete-msg]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.pendingDeleteMsgId = btn.dataset.deleteMsg;
        showModal('deleteMessageModal');
      });
    });

    // Scroll to bottom
    setTimeout(() => {
      area.scrollTop = area.scrollHeight;
    }, 100);

    highlightActiveChat();
    const last = msgs[msgs.length - 1];
    const subtitle = last ? `Last message ${formatTimeAgo(last.createdAt)}` : 'No messages yet';
    updateChatSubline(subtitle);
  } catch (e) {
    area.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger);">Error loading messages. Please try again.</div>';
    updateChatSubline('Failed to load conversation.');
    console.error('Load messages error:', e);
  }
}

function highlightActiveChat() {
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === state.activeChatId);
  });
}

function handleChatToolbarClick(e) {
  const btn = e.target.closest('button[data-tool]');
  if (!btn) return;
  const tool = btn.dataset.tool;

  if (tool === 'call') {
    // Voice call feature - show modal with WebRTC info
    if (!state.activeChatId) {
      toast('Select a chat first', 'error');
      return;
    }
    startVoiceCall();
  } else if (tool === 'video') {
    if (!state.activeChatId) {
      toast('Select a chat first', 'error');
      return;
    }
    startVideoCall();
  }
}

function initCallUi() {
  const callBtn = document.getElementById('btnChatCall');
  if (callBtn) callBtn.addEventListener('click', startVoiceCall);
  const videoBtn = document.getElementById('btnChatVideo');
  if (videoBtn) videoBtn.addEventListener('click', startVideoCall);
  const camToggle = document.getElementById('btnCallCamera');
  if (camToggle) camToggle.addEventListener('click', toggleLocalVideo);
  const endBtn = document.getElementById('btnCallEnd');
  if (endBtn) endBtn.addEventListener('click', () => {
    const reason = callState.pendingOffer && !callState.isCaller ? 'declined' : 'ended';
    endVoiceCall(reason, true);
  });
  const muteBtn = document.getElementById('btnCallMute');
  if (muteBtn) muteBtn.addEventListener('click', toggleCallMute);
  const acceptBtn = document.getElementById('btnCallAccept');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🎯 Accept button clicked!');
      try {
        await acceptIncomingCall();
      } catch (error) {
        console.error('Error in acceptIncomingCall:', error);
        toast('Error accepting call: ' + error.message, 'error');
      }
    });
  }
}

// Delete Message & Chat Functions
async function deleteMessage() {
  const msgId = state.pendingDeleteMsgId;
  if (!msgId) {
    toast('No message selected', 'error');
    return;
  }
  
  try {
    console.log('Deleting message:', msgId);
    await apiRequest(`/messages/${msgId}`, 'DELETE');
    toast('Message deleted', 'success');
    hideModal('deleteMessageModal');
    // Optimistically remove message DOM node
    const msgEl = document.querySelector(`.msg[data-msg-id="${msgId}"]`);
    if (msgEl && msgEl.parentElement) {
      msgEl.parentElement.removeChild(msgEl);
    }
    // Reload messages in current chat
    if (state.activeChatId) {
      const activeChat = state.chats?.find(c => {
        const chatUserId = c.user?._id || c.user;
        return chatUserId && chatUserId.toString() === state.activeChatId.toString();
      });
      if (activeChat) {
        const username = activeChat.user?.username || activeChat.user;
        loadMessages(state.activeChatId, username);
      }
    }
    state.pendingDeleteMsgId = null;
  } catch (e) {
    toast(e.message || 'Failed to delete message', 'error');
    console.error('Delete message error:', e);
  }
}

async function deleteChat() {
  const chatId = state.activeChatId;
  if (!chatId) {
    toast('No chat selected', 'error');
    return;
  }
  
  try {
    console.log('Deleting chat with user:', chatId);
    await apiRequest(`/messages/conversation/${chatId}`, 'DELETE');
    toast('Chat deleted', 'success');
    hideModal('deleteChatModal');
    // Reload chat list
    await loadChats();
    // Clear message area
    const area = document.getElementById('msgArea');
    if (area) {
      area.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-comments" style="font-size:2rem; margin-bottom:10px; display:block;"></i><p>Select a chat to view messages</p></div>';
    }
    state.activeChatId = null;
    updateChatSubline('Chat deleted. Choose a contact to start again.');
  } catch (e) {
    toast(e.message || 'Failed to delete chat', 'error');
    console.error('Delete chat error:', e);
  }
}

function initDeleteUI() {
  // Delete chat button
  const deleteChatBtn = document.getElementById('btnDeleteChat');
  if (deleteChatBtn) {
    deleteChatBtn.addEventListener('click', () => {
      if (!state.activeChatId) {
        toast('Select a chat first', 'error');
        return;
      }
      showModal('deleteChatModal');
    });
  }

  // Delete message modal actions
  const confirmDeleteMsg = document.getElementById('confirmDeleteMsg');
  const cancelDeleteMsg = document.getElementById('cancelDeleteMsg');
  const closeDeleteMsgModal = document.getElementById('closeDeleteMsgModal');
  
  if (confirmDeleteMsg) confirmDeleteMsg.addEventListener('click', deleteMessage);
  if (cancelDeleteMsg) cancelDeleteMsg.addEventListener('click', () => hideModal('deleteMessageModal'));
  if (closeDeleteMsgModal) closeDeleteMsgModal.addEventListener('click', () => hideModal('deleteMessageModal'));

  // Delete chat modal actions
  const confirmDeleteChat = document.getElementById('confirmDeleteChat');
  const cancelDeleteChat = document.getElementById('cancelDeleteChat');
  const closeDeleteChatModal = document.getElementById('closeDeleteChatModal');
  
  if (confirmDeleteChat) confirmDeleteChat.addEventListener('click', deleteChat);
  if (cancelDeleteChat) cancelDeleteChat.addEventListener('click', () => hideModal('deleteChatModal'));
  if (closeDeleteChatModal) closeDeleteChatModal.addEventListener('click', () => hideModal('deleteChatModal'));
}

function getActiveChatUser() {
  if (!state.activeChatId) return null;
  const activeId = state.activeChatId.toString();
  const match = (state.chats || []).find(chat => {
    const id = chat.user?._id || chat.user;
    return id && id.toString() === activeId;
  });
  if (match?.user) return match.user;
  return {
    _id: activeId,
    username: document.getElementById('chatHeader')?.textContent || 'User'
  };
}

function showCallOverlay({ user, status, showAccept = false }) {
  const overlay = document.getElementById('callOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  const nameEl = document.getElementById('callUserName');
  const statusEl = document.getElementById('callStatus');
  const avatarEl = document.getElementById('callUserAvatar');
  const acceptBtn = document.getElementById('btnCallAccept');
  const muteBtn = document.getElementById('btnCallMute');
  const camBtn = document.getElementById('btnCallCamera');
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const callMedia = document.querySelector('.call-media');
  const timerEl = document.getElementById('callTimer');
  const seed = getAvatarSeed(user || {});
  if (nameEl) nameEl.textContent = user?.fullName || user?.username || 'SocioSphere user';
  if (statusEl) statusEl.textContent = status || 'Connecting…';
  if (avatarEl) {
    avatarEl.textContent = seed.charAt(0);
    avatarEl.style.background = getAvatarColor(seed);
  }
  if (acceptBtn) acceptBtn.classList.toggle('hidden', !showAccept);
  if (muteBtn) muteBtn.classList.toggle('hidden', showAccept);
  if (camBtn) camBtn.classList.toggle('hidden', !callState.wantVideo);
  if (callMedia) callMedia.style.display = callState.wantVideo ? 'block' : 'none';
  if (localVideo) localVideo.style.display = callState.wantVideo ? 'block' : 'none';
  if (remoteVideo) remoteVideo.style.display = callState.wantVideo ? 'block' : 'none';
  if (timerEl) timerEl.textContent = '00:00';
}

function updateCallStatus(text) {
  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = text;
}

function hideCallOverlay() {
  const overlay = document.getElementById('callOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function formatCallDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startCallTimer() {
  const timerEl = document.getElementById('callTimer');
  callState.callStartedAt = Date.now();
  if (callState.timerInterval) clearInterval(callState.timerInterval);
  callState.timerInterval = setInterval(() => {
    if (!timerEl || !callState.callStartedAt) return;
    const elapsed = Math.floor((Date.now() - callState.callStartedAt) / 1000);
    timerEl.textContent = formatCallDuration(elapsed);
  }, 1000);
}

function resetCallState() {
  if (callState.timerInterval) {
    clearInterval(callState.timerInterval);
    callState.timerInterval = null;
  }
  if (callState.peer) {
    callState.peer.onicecandidate = null;
    callState.peer.ontrack = null;
    try {
      // remove any senders to detach tracks from the RTCPeerConnection
      try {
        const senders = callState.peer.getSenders?.() || [];
        senders.forEach(s => {
          try { callState.peer.removeTrack?.(s); } catch (_) { }
        });
      } catch (_) { }
      callState.peer.close();
    } catch (e) { /* ignore close errors */ }
  }
  // Stop and release local media tracks
  if (callState.localStream) {
    try { callState.localStream.getTracks().forEach(track => { try { track.stop(); } catch (_) { } }); } catch (_) { }
  }
  // Stop remote stream tracks if present
  if (callState.remoteStream) {
    try { callState.remoteStream.getTracks().forEach(track => { try { track.stop(); } catch (_) { } }); } catch (_) { }
  }
  // Clear video/audio element sources to release any attached streams
  const localVideoEl = document.getElementById('localVideo');
  const remoteVideoEl = document.getElementById('remoteVideo');
  const remoteAudio = document.getElementById('remoteAudio');
  if (localVideoEl) try { localVideoEl.srcObject = null; } catch (_) { }
  if (remoteVideoEl) try { remoteVideoEl.srcObject = null; } catch (_) { }
  if (remoteAudio) try { remoteAudio.srcObject = null; } catch (_) { }

  callState.peer = null;
  callState.localStream = null;
  callState.remoteStream = null;
  callState.callStartedAt = null;
  callState.targetUserId = null;
  callState.pendingOffer = null;
  callState.partner = null;
  callState.isCaller = false;
  callState.isMuted = false;
  callState.pendingCandidates = [];
}

// Ringtone and desktop notification helpers
function startRingtone() {
  try {
    if (callState._ringtone && callState._ringtone.playing) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    // Primary: use WebAudio oscillator if available
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 620;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      // rhythm: beep pattern using interval toggling
      let on = false;
      const interval = setInterval(() => {
        on = !on;
        // short ticks and pauses: on for 300ms, off for 300ms
        try { gain.gain.setTargetAtTime(on ? 0.12 : 0.0, ctx.currentTime, 0.01); } catch (_) { }
      }, 600);
      callState._ringtone = { type: 'webaudio', ctx, osc, gain, interval, playing: true };
      // ensure the context is resumed on user gesture if suspended
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume().catch(() => { });
      // vibrate if supported (short pattern)
      try { navigator.vibrate?.([200, 150, 200]); } catch (_) { }
      return;
    }
    // Fallback: use an HTMLAudioElement with a short hosted sound
    const FALLBACK_RING_URL = 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg';
    try {
      let audio = callState._ringtoneAudio;
      if (!audio) {
        audio = new Audio(FALLBACK_RING_URL);
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = 0.6;
        callState._ringtoneAudio = audio;
      }
      audio.currentTime = 0;
      audio.play().catch(e => { console.warn('ringtone audio play rejected', e); });
      callState._ringtone = { type: 'audioelement', playing: true };
      try { navigator.vibrate?.([200, 150, 200]); } catch (_) { }
    } catch (e) { console.warn('startRingtone fallback error', e); }
  } catch (e) { console.warn('startRingtone error', e); }
}

function stopRingtone() {
  try {
    const r = callState._ringtone;
    if (!r) {
      // also stop audio element if present
      if (callState._ringtoneAudio) {
        try { callState._ringtoneAudio.pause(); callState._ringtoneAudio.currentTime = 0; } catch (_) { }
      }
      return;
    }
    if (r.type === 'webaudio') {
      try { clearInterval(r.interval); } catch (_) { }
      try { r.gain.gain.setTargetAtTime(0, r.ctx.currentTime, 0.01); } catch (_) { }
      try { r.osc.stop(); } catch (_) { }
      try { r.ctx.close(); } catch (_) { }
    } else if (r.type === 'audioelement') {
      try { callState._ringtoneAudio?.pause(); callState._ringtoneAudio.currentTime = 0; } catch (_) { }
    }
    callState._ringtone = null;
    try { navigator.vibrate?.(0); } catch (_) { }
  } catch (e) { console.warn('stopRingtone error', e); }
}

function showCallNotification(caller) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(() => showCallNotification(caller)).catch(() => { });
      return;
    }
    if (Notification.permission !== 'granted') return;
    const title = caller?.fullName || caller?.username || 'Incoming call';
    const body = callState.wantVideo ? 'Incoming video call' : 'Incoming voice call';
    const notif = new Notification(title, { body, silent: true });
    notif.onclick = () => {
      try { window.focus(); } catch (_) { }
      // bring app to front, and ensure overlay visible
      showCallOverlay({ user: caller, status: body, showAccept: true });
      stopRingtone();
    };
    // auto-close after 10s
    setTimeout(() => { try { notif.close(); } catch (_) { } }, 10000);
  } catch (e) { console.warn('showCallNotification error', e); }
}

function endVoiceCall(reason = 'ended', notifyPeer = false) {
  try { stopRingtone(); } catch (_) { }
  if (notifyPeer && callState.targetUserId && state.socket) {
    state.socket.emit('end-call', { targetUserId: callState.targetUserId, reason });
  }
  hideCallOverlay();
  resetCallState();
  if (reason && reason !== 'remote') {
    toast(reason === 'ended' ? 'Call ended' : `Call ${reason}`);
  }
}

async function ensurePeerConnection() {
  if (callState.peer) return callState.peer;
  callState.remoteStream = new MediaStream();
  await loadDynamicIceServers();
  // Use multiple STUN servers for better connectivity
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];
  console.log('🔧 Configuring ICE servers...');
  
  // First, try to use dynamic ICE servers from Twilio API (with fresh credentials)
  if (Array.isArray(DYNAMIC_ICE_SERVERS) && DYNAMIC_ICE_SERVERS.length > 0) {
    console.log('✅ Using dynamic ICE servers from Twilio API');
    DYNAMIC_ICE_SERVERS.forEach(s => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls || s.url];
      urls.filter(Boolean).forEach(u => {
        iceServers.push({ urls: u, username: s.username, credential: s.credential || s.password });
        console.log('✅ Added dynamic server:', u.substring(0, 50));
      });
    });
  } else if (TURN_ENABLED && TURN_URLS?.length) {
    // Fallback to hardcoded TURN servers if dynamic servers not available
    console.log('⚠️ Using fallback TURN servers (dynamic servers unavailable)');
    console.log('🔄 Adding TURN servers:', TURN_URLS.length, 'URLs');
    TURN_URLS.forEach(url => {
      // Use free credentials for public TURN servers
      if (url.includes('openrelay.metered.ca')) {
        iceServers.push({ urls: url, username: FREE_TURN_USERNAME, credential: FREE_TURN_CREDENTIAL });
        console.log('✅ Added free public TURN:', url);
      } else {
        iceServers.push({ urls: url, username: TURN_USERNAME, credential: TURN_CREDENTIAL });
        console.log('⚠️ Added Twilio TURN (using hardcoded credentials):', url);
      }
    });
  } else {
    console.warn('⚠️ No TURN servers configured - may fail on restrictive networks');
  }
  const rtcConfig = { iceServers };
  const hasTurn = iceServers.some(s => (Array.isArray(s.urls) ? s.urls : [s.urls || s.url]).some(u => typeof u === 'string' && u.startsWith('turn:')));
  console.log('📊 ICE Configuration:', {
    totalServers: iceServers.length,
    hasTurn,
    forceTurn: FORCE_TURN
  });
  
  if (FORCE_TURN && hasTurn) {
    console.warn('⚠️ Forcing relay mode - will only use TURN servers');
    rtcConfig.iceTransportPolicy = 'relay';
  } else if (FORCE_TURN && !hasTurn) {
    console.warn('⚠️ FORCE_TURN enabled but no valid TURN servers found; falling back to all transports');
  } else {
    console.log('✅ Using all transport modes (direct + relay)');
  }
  callState.peer = new RTCPeerConnection(rtcConfig);
  callState.peer.onicecandidate = (event) => {
    if (event.candidate && callState.targetUserId && state.socket) {
      console.log('🧊 Sending ICE candidate:', event.candidate.type, event.candidate.candidate?.substring(0, 50));
      state.socket.emit('call-ice-candidate', {
        targetUserId: callState.targetUserId,
        candidate: event.candidate
      });
    } else if (!event.candidate) {
      console.log('🧊 ICE gathering complete');
    }
  };
  callState.peer.ontrack = (event) => {
    console.log('ontrack received:', event.track.kind, 'stream:', event.streams?.length);
    const remoteAudio = document.getElementById('remoteAudio');
    const remoteVideo = document.getElementById('remoteVideo');
    try {
      if (event.streams && event.streams[0]) {
        console.log('Setting stream from event.streams[0]');
        if (remoteAudio) {
          remoteAudio.srcObject = event.streams[0];
          console.log('remoteAudio srcObject set');
        }
        if (remoteVideo) {
          remoteVideo.srcObject = event.streams[0];
          console.log('remoteVideo srcObject set');
        }
      } else {
        console.log('Adding track to remoteStream:', event.track.kind);
        if (!callState.remoteStream) callState.remoteStream = new MediaStream();
        callState.remoteStream.addTrack(event.track);
        if (remoteAudio) {
          remoteAudio.srcObject = callState.remoteStream;
          console.log('remoteAudio srcObject set from remoteStream');
        }
        if (remoteVideo) {
          remoteVideo.srcObject = callState.remoteStream;
          console.log('remoteVideo srcObject set from remoteStream');
        }
      }
    } catch (e) { console.warn('ontrack handling error', e); }
  };
  callState.peer.onconnectionstatechange = () => {
    const s = callState.peer.connectionState;
    console.log('✅ Connection state changed to:', s);
    if (s === 'connected') {
      if (!callState.callStartedAt) {
        console.log('✅ Call connected successfully');
        updateCallStatus('Connected');
        startCallTimer();
        callState.callStartedAt = Date.now();
      }
    }
    if (s === 'disconnected' || s === 'failed' || s === 'closed') {
      console.warn('❌ Connection state error:', s);
      updateCallStatus(s === 'failed' ? 'Connection failed' : 'Disconnected');
      endVoiceCall(s, false);
    }
  };
  callState.peer.oniceconnectionstatechange = () => {
    const s = callState.peer.iceConnectionState;
    console.log('🧊 ICE connection state changed to:', s);
    if (s === 'checking') {
      console.log('🔍 ICE candidates being checked...');
      updateCallStatus('Connecting...');
    } else if (s === 'connected' || s === 'completed') {
      console.log('✅ ICE connected!');
      updateCallStatus('Connected');
      if (!callState.callStartedAt) {
        startCallTimer();
        callState.callStartedAt = Date.now();
      }
    } else if (s === 'failed') {
      console.error('❌ ICE connection failed - possible network/firewall issue');
      updateCallStatus('Connection failed');
      toast('Connection failed - check network/firewall', 'error');
      try { callState.peer.restartIce?.(); } catch (e) { }
      setTimeout(() => endVoiceCall('failed', false), 2000);
    } else if (s === 'disconnected') {
      console.warn('⚠️ ICE disconnected');
      updateCallStatus('Connection lost');
    }
  };
  callState.peer.onicecandidateerror = (e) => {
    console.warn('❌ ICE candidate error:', {
      errorCode: e.errorCode,
      errorText: e.errorText,
      url: e.url,
      address: e.address,
      port: e.port
    });
    // Only show toast once to avoid spam
    if (!callState._iceErrorLogged) {
      if (e.errorCode === 701) {
        console.error('❌ TURN server authentication failed - credentials may be invalid');
        toast('TURN server authentication failed', 'error');
      } else if (e.errorCode === 300) {
        console.error('❌ STUN/TURN server unreachable');
      }
      callState._iceErrorLogged = true;
    }
  };
  return callState.peer;
}

function waitForIceGatheringComplete(peer, timeoutMs = 4000) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (peer.iceGatheringState === 'complete') {
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    const timer = setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, timeoutMs);
    peer.addEventListener('icegatheringstatechange', check);
  });
}
async function flushPendingCandidates() {
  const pc = callState.peer;
  if (!pc) {
    console.log('📦 No peer connection to flush candidates');
    return;
  }
  if (!callState.pendingCandidates || callState.pendingCandidates.length === 0) {
    console.log('📦 No pending candidates to flush');
    return;
  }
  if (!pc.remoteDescription) {
    console.log('⚠️ Cannot flush candidates yet - remoteDescription not set');
    return;
  }
  const list = [...callState.pendingCandidates];
  console.log(`📦 Flushing ${list.length} pending ICE candidates`);
  callState.pendingCandidates = [];
  
  for (const c of list) {
    try { 
      await pc.addIceCandidate(new RTCIceCandidate(c));
      console.log('✅ Pending candidate added:', c.type);
    } catch (e) { 
      console.warn('⚠️ Failed to add pending candidate:', e);
    }
  }
  console.log('✅ All pending candidates flushed');
  
  // After flushing, check if connection is now established
  setTimeout(() => {
    if (callState.peer) {
      const iceState = callState.peer.iceConnectionState;
      const connState = callState.peer.connectionState;
      console.log('📊 Post-flush states - ICE:', iceState, 'Connection:', connState);
      
      if ((iceState === 'connected' || iceState === 'completed' || connState === 'connected') && !callState.callStartedAt) {
        console.log('✅ Connection established after candidate flush');
        updateCallStatus('Connected');
        startCallTimer();
        callState.callStartedAt = Date.now();
      }
    }
  }, 100);
}

async function ensureLocalAudio() {
  if (callState.localStream) return callState.localStream;
  callState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const peer = await ensurePeerConnection();
  // CRITICAL FIX: Check if peer exists before calling addTrack to prevent null reference error
  if (peer && callState.localStream) {
    callState.localStream.getTracks().forEach(track => {
      try {
        peer.addTrack(track, callState.localStream);
      } catch (err) {
        console.error('❌ Error adding track to peer:', err);
      }
    });
  } else {
    console.warn('⚠️ Peer connection or local stream is null');
  }
  return callState.localStream;
}

async function startVoiceCall() {
  if (callState.peer) {
    const s = callState.peer.connectionState;
    if (['closed', 'failed', 'disconnected'].includes(s)) {
      resetCallState();
    } else {
      toast('You are already in a call', 'error');
      return;
    }
  }
  if (!state.activeChatId) {
    toast('Select a chat first', 'error');
    return;
  }
  if (!state.socket) {
    toast('Realtime connection offline', 'error');
    return;
  }
  const hostname = window.location.hostname;
  const secureContext = window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (!secureContext) {
    toast('Voice calls require HTTPS or running the app on localhost.', 'error');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Browser does not support voice calls', 'error');
    return;
  }
  callState.isCaller = true;
  callState.targetUserId = state.activeChatId;
  callState.partner = getActiveChatUser();
  callState.wantVideo = false;
  showCallOverlay({ user: callState.partner, status: 'Calling…' });
  try {
    // Parallelize: get peer connection and audio stream simultaneously
    const [peer] = await Promise.all([
      ensurePeerConnection(),
      ensureLocalAudio()
    ]);
    
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    
    // Send offer immediately (don't wait for full ICE gathering)
    // Send initial offer quickly, add ICE candidates as they arrive
    const offerToSend = offer;
    if (!offerToSend) throw new Error('Local offer missing');
    
    state.socket.emit('call-offer', {
      targetUserId: callState.targetUserId,
      offer: offerToSend,
      caller: { _id: state.user._id, username: state.user.username, fullName: state.user.fullName }
    });
    
    // Let ICE gathering continue in background - candidates will be sent via onicecandidate
    updateCallStatus('Ringing…');
  } catch (error) {
    console.error('Call start error', error);
    toast('Unable to start call', 'error');
    endVoiceCall('failed', false);
  }
}

async function startVideoCall() {
  if (callState.peer) {
    const s = callState.peer.connectionState;
    if (['closed', 'failed', 'disconnected'].includes(s)) {
      resetCallState();
    } else {
      toast('You are already in a call', 'error');
      return;
    }
  }
  if (!state.activeChatId) {
    toast('Select a chat first', 'error');
    return;
  }
  if (!state.socket) {
    toast('Realtime connection offline', 'error');
    return;
  }
  const hostname = window.location.hostname;
  const secureContext = window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (!secureContext) {
    toast('Video calls require HTTPS. Please access via https://' + hostname + ':' + window.location.port, 'error');
    console.error('Insecure context detected. Current URL:', window.location.href);
    console.error('For video calls to work, access the app via HTTPS or localhost');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Browser does not support video calls', 'error');
    return;
  }
  callState.isCaller = true;
  callState.targetUserId = state.activeChatId;
  callState.partner = getActiveChatUser();
  callState.wantVideo = true;
  showCallOverlay({ user: callState.partner, status: 'Calling…' });
  try {
    // Parallelize: get peer connection and media stream simultaneously
    await ensurePeerConnection();
    callState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const peer = callState.peer;
    // CRITICAL FIX: Ensure peer exists before adding tracks
    if (!peer) {
      throw new Error('Peer connection is not initialized');
    }
    callState.localStream.getTracks().forEach(track => {
      try {
        peer.addTrack(track, callState.localStream);
      } catch (err) {
        console.error('❌ Error adding track to peer:', err);
      }
    });
    const localVideo = document.getElementById('localVideo');
    if (localVideo) localVideo.srcObject = callState.localStream;
    
    const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await peer.setLocalDescription(offer);
    
    // Send offer immediately (don't wait for full ICE gathering)
    const offerToSend = offer;
    if (!offerToSend) throw new Error('Local offer missing');
    state.socket.emit('call-offer', {
      targetUserId: callState.targetUserId,
      offer: offerToSend,
      caller: { _id: state.user._id, username: state.user.username, fullName: state.user.fullName }
    });
    
    // Let ICE gathering continue in background
    updateCallStatus('Ringing…');
  } catch (error) {
    console.error('Video call start error', error);
    if (error.name === 'NotAllowedError') {
      toast('Camera/microphone access denied. Please allow permissions and use HTTPS.', 'error');
    } else if (error.name === 'NotFoundError') {
      toast('Camera or microphone not found', 'error');
    } else if (error.name === 'NotReadableError') {
      toast('Camera/microphone already in use', 'error');
    } else {
      toast('Unable to start video call: ' + error.message, 'error');
    }
    endVoiceCall('failed', false);
  }
}

function toggleLocalVideo() {
  const btn = document.getElementById('btnCallCamera');
  if (!callState.localStream || !btn) return;
  const videoTracks = callState.localStream.getVideoTracks();
  if (videoTracks && videoTracks.length) {
    const enabled = !videoTracks[0].enabled;
    videoTracks.forEach(t => t.enabled = enabled);
    callState.cameraOn = enabled;
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const icon = btn.querySelector('i');
    if (icon) icon.className = enabled ? 'fas fa-video' : 'fas fa-video-slash';
  } else {
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      callState.localStream.addTrack(track);
      callState.peer?.addTrack(track, callState.localStream);
      const localVideo = document.getElementById('localVideo');
      if (localVideo) localVideo.srcObject = callState.localStream;
      callState.cameraOn = true;
      btn.setAttribute('aria-pressed', 'true');
      const icon = btn.querySelector('i');
      if (icon) icon.className = 'fas fa-video';
    }).catch(() => toast('Unable to enable camera', 'error'));
  }
}

async function acceptIncomingCall() {
  console.log('📞 acceptIncomingCall() called');
  console.log('pendingOffer:', !!callState.pendingOffer);
  console.log('targetUserId:', callState.targetUserId);
  console.log('partner:', callState.partner);
  
  if (!callState.pendingOffer) {
    toast('No incoming call to accept', 'error');
    console.warn('acceptIncomingCall called but no pendingOffer present');
    return;
  }
  // Require secure context for getUserMedia
  const hostname = window.location.hostname;
  const secureContext = window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (!secureContext) {
    toast('Cannot accept call: app is not served over HTTPS or localhost.', 'error');
    console.warn('acceptIncomingCall blocked due to insecure context');
    return;
  }
  try {
    console.log('🎤 Starting to accept incoming call...');
    // stop incoming ringtone when accepting
    try { stopRingtone(); } catch (_) { }
    
    updateCallStatus('Accepting…');
    
    // Parallelize: get peer connection and media stream
    console.log('🔌 Ensuring peer connection...');
    await ensurePeerConnection();
    console.log('✅ Peer connection ready');
    
    // Get media in parallel with other setup
    if (callState.wantVideo) {
      console.log('📹 Getting video stream...');
      callState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      console.log('✅ Video stream acquired');
      // CRITICAL FIX: Check if peer exists before adding tracks
      if (callState.peer) {
        callState.localStream.getTracks().forEach(track => {
          try {
            callState.peer.addTrack(track, callState.localStream);
          } catch (err) {
            console.error('❌ Error adding track to peer:', err);
          }
        });
      } else {
        console.warn('⚠️ Peer connection is null');
      }
      const localVideo = document.getElementById('localVideo');
      if (localVideo) localVideo.srcObject = callState.localStream;
    } else {
      console.log('🎙️ Getting audio only stream...');
      await ensureLocalAudio();
      console.log('✅ Audio stream acquired');
    }
    
    // Set remote description immediately
    console.log('📥 Setting remote description from offer');
    await callState.peer.setRemoteDescription(new RTCSessionDescription(callState.pendingOffer));
    console.log('✅ Remote description set, signalingState:', callState.peer.signalingState);
    
    // Create and send answer immediately (don't wait for ICE gathering)
    console.log('📝 Creating answer');
    const answer = await callState.peer.createAnswer();
    console.log('📤 Setting local description with answer');
    await callState.peer.setLocalDescription(answer);
    console.log('✅ Local description set, signalingState:', callState.peer.signalingState);
    
    // Send answer right away - ICE candidates follow via onicecandidate
    // Use localDescription which includes full SDP with ICE candidates
    console.log('📡 Sending answer via socket');
    state.socket.emit('call-answer', {
      targetUserId: callState.targetUserId,
      answer: callState.peer.localDescription
    });
    console.log('✅ Answer sent to caller');
    
    // Flush pending candidates in background
    console.log('📦 Flushing pending candidates...');
    await flushPendingCandidates();
    console.log('✅ Pending candidates flushed');
    
    callState.pendingOffer = null;
    document.getElementById('btnCallAccept')?.classList.add('hidden');
    document.getElementById('btnCallMute')?.classList.remove('hidden');
    
    // Check if already connected (in case ICE completed very quickly)
    const currentIceState = callState.peer.iceConnectionState;
    const currentConnState = callState.peer.connectionState;
    console.log('🔍 Current states after setup - ICE:', currentIceState, 'Conn:', currentConnState);
    
    if (currentIceState === 'connected' || currentIceState === 'completed' || currentConnState === 'connected') {
      console.log('✅ Already connected, starting timer');
      updateCallStatus('Connected');
      if (!callState.callStartedAt) {
        startCallTimer();
        callState.callStartedAt = Date.now();
      }
    } else {
      updateCallStatus('Connecting…');
      
      // Start a watchdog to check connection status every 500ms for up to 10 seconds
      let attempts = 0;
      const maxAttempts = 20;
      const watchdog = setInterval(() => {
        if (!callState.peer) {
          clearInterval(watchdog);
          return;
        }
        
        attempts++;
        const ice = callState.peer.iceConnectionState;
        const conn = callState.peer.connectionState;
        console.log(`🔍 Watchdog check ${attempts}/${maxAttempts} - ICE: ${ice}, Conn: ${conn}`);
        
        if (ice === 'connected' || ice === 'completed' || conn === 'connected') {
          console.log('✅ Watchdog detected connection!');
          updateCallStatus('Connected');
          if (!callState.callStartedAt) {
            startCallTimer();
            callState.callStartedAt = Date.now();
          }
          clearInterval(watchdog);
        } else if (ice === 'failed' || conn === 'failed' || attempts >= maxAttempts) {
          console.warn('❌ Watchdog timeout or connection failed');
          if (ice === 'failed' || conn === 'failed') {
            updateCallStatus('Connection failed');
            endVoiceCall('failed', false);
          }
          clearInterval(watchdog);
        }
      }, 500);
    }
  } catch (error) {
    console.error('❌ Accept call error:', error);
    console.error('Error stack:', error.stack);
    toast('Unable to answer call: ' + error.message, 'error');
    endVoiceCall('failed', true);
  }
}

function toggleCallMute() {
  if (!callState.localStream) return;
  callState.isMuted = !callState.isMuted;
  callState.localStream.getAudioTracks().forEach(track => {
    track.enabled = !callState.isMuted;
  });
  const muteBtn = document.getElementById('btnCallMute');
  if (muteBtn) {
    const icon = muteBtn.querySelector('i');
    if (icon) icon.className = callState.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
    muteBtn.setAttribute('aria-pressed', callState.isMuted ? 'true' : 'false');
  }
}

function registerCallSocketEvents() {
  if (!state.socket) return;
  const callEvents = ['incoming-call-offer', 'incoming-call-answer', 'call-ice-candidate', 'call-ended', 'call-unavailable'];
  callEvents.forEach(evt => state.socket.off?.(evt));
  state.socket.on('incoming-call-offer', async ({ offer, caller, callerId }) => {
    console.log('RTC: incoming-call-offer from', callerId, 'wantVideo?', !!(offer && /\bm=video\b/.test((offer && offer.sdp) ? offer.sdp : '')));
    if (callState.peer) {
      state.socket.emit('end-call', { targetUserId: callerId, reason: 'busy' });
      toast('Already on another call', 'error');
      return;
    }
    callState.isCaller = false;
    callState.pendingOffer = offer;
    callState.targetUserId = callerId;
    callState.partner = caller;
    const sdp = (offer && offer.sdp) ? offer.sdp : '';
    callState.wantVideo = /\bm=video\b/.test(sdp);
    // Ensure accept button is visible and enabled for incoming calls
    showCallOverlay({ user: caller, status: callState.wantVideo ? 'Incoming video call' : 'Incoming voice call', showAccept: true });
    const acceptBtnEl = document.getElementById('btnCallAccept');
    if (acceptBtnEl) {
      acceptBtnEl.classList.remove('hidden');
      acceptBtnEl.disabled = false;
    }
      updateCallStatus(callState.wantVideo ? 'Incoming video call' : 'Incoming voice call');
      // Play ringtone and show a desktop notification for incoming calls
      startRingtone();
      try { showCallNotification(callState.partner); } catch (_) { }
  });

  state.socket.on('incoming-call-answer', async ({ answer }) => {
    if (!callState.peer) {
      console.warn('⚠️ Received answer but no peer connection exists');
      return;
    }
    try {
      console.log('📥 Received incoming-call-answer, signalingState:', callState.peer.signalingState);
      // Only apply an answer when the local side is in a state that expects it
      const signaling = callState.peer.signalingState;
      // If we are in the expected state for applying an answer, do it
      if (signaling === 'have-local-offer' || signaling === 'have-remote-offer' || signaling === 'stable') {
        try {
          console.log('📝 Applying answer immediately');
          await callState.peer.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Remote description (answer) set successfully');
          await flushPendingCandidates();
          
          // Check if connection is already established
          const iceState = callState.peer.iceConnectionState;
          const connState = callState.peer.connectionState;
          console.log('📊 Current states - ICE:', iceState, 'Connection:', connState);
          
          if (iceState === 'connected' || iceState === 'completed' || connState === 'connected') {
            console.log('✅ Connection already established after answer');
            updateCallStatus('Connected');
            if (!callState.callStartedAt) {
              startCallTimer();
              callState.callStartedAt = Date.now();
            }
          } else {
            updateCallStatus('Connecting...');
          }
          callState.pendingAnswer = null;
        } catch (innerErr) {
          // Some browsers throw InvalidStateError if signalingState is not exactly right.
          // Queue the answer and attempt to apply when signalingState changes.
          console.warn('Could not apply remote answer immediately, will queue:', innerErr);
          callState.pendingAnswer = answer;
        }
      } else {
        // Queue the answer and wait for a suitable signaling state change
        console.warn('Queuing remote answer, current signaling state:', signaling);
        callState.pendingAnswer = answer;
      }
      // Attach a one-time listener to try to apply a queued answer when state becomes appropriate
      if (callState.pendingAnswer) {
        const onSignal = async function () {
          try {
            const s = callState.peer?.signalingState;
            if (!callState.peer) return callState.peer?.removeEventListener('signalingstatechange', onSignal);
            console.log('signalingstatechange event, new state:', s);
            if (s === 'have-local-offer' || s === 'have-remote-offer' || s === 'stable') {
              console.log('Applying queued answer now');
              await callState.peer.setRemoteDescription(new RTCSessionDescription(callState.pendingAnswer));
              await flushPendingCandidates();
              callState.pendingAnswer = null;
              updateCallStatus('Connected');
              startCallTimer();
              callState.peer.removeEventListener('signalingstatechange', onSignal);
            }
          } catch (e) {
            console.warn('Applying queued remote answer failed:', e);
          }
        };
        try { callState.peer.addEventListener('signalingstatechange', onSignal); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('Set remote description error', err);
      updateCallStatus('Failed to connect');
      endVoiceCall('failed', false);
    }
  });

  state.socket.on('call-ice-candidate', async ({ candidate }) => {
    if (!callState.peer || !candidate) {
      console.warn('⚠️ Ignoring ICE candidate: peer missing or no candidate');
      return;
    }
    console.log('🧊 Received ICE candidate:', candidate.type, 'remoteDescription:', !!callState.peer.remoteDescription);
    if (!callState.peer.remoteDescription) {
      console.log('📦 Queuing ICE candidate - remoteDescription not set yet');
      callState.pendingCandidates = callState.pendingCandidates || [];
      callState.pendingCandidates.push(candidate);
      return;
    }
    try { 
      console.log('➕ Adding ICE candidate immediately');
      await callState.peer.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added successfully');
    } catch (error) { 
      console.error('❌ ICE candidate error:', error); 
    }
  });

  state.socket.on('call-ended', ({ reason }) => {
    updateCallStatus(reason || 'Call ended');
    endVoiceCall('remote', false);
  });

  state.socket.on('call-unavailable', ({ reason }) => {
    toast(reason || 'User unavailable', 'error');
    endVoiceCall('unavailable', false);
  });
}

async function handleChatFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > MAX_UPLOAD_BYTES) {
    toast('File must be under 6MB', 'error');
    return;
  }

  if (!state.activeChatId) {
    toast('Select a chat first', 'error');
    return;
  }

  try {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileData = event.target.result;
      const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';

      await apiRequest('/messages', 'POST', {
        receiverId: state.activeChatId,
        content: file.name,
        messageType: fileType,
        mediaUrl: fileData
      });

      toast('File sent');
      e.target.value = '';
      loadMessages(state.activeChatId);
    };
    reader.readAsDataURL(file);
  } catch (err) {
    toast(err.message || 'Failed to send file', 'error');
  }
}

function updateChatSubline(text) {
  const el = document.getElementById('chatSubline');
  if (el) el.textContent = text;
}

// --- Notifications ---
async function loadNotifications() {
  const container = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');

  try {
    const notifs = await apiRequest('/notifications', 'GET');
    const unread = notifs.filter(n => !n.isRead).length;

    badge.style.display = unread > 0 ? 'block' : 'none';

    if (!notifs.length) {
      container.innerHTML = '<p style="padding:20px;">No notifications.</p>';
      return;
    }

    container.innerHTML = notifs.map(n => {
      const iconData = getNotificationIcon(n.content);
      return `
        <div class="notification-card" ${((n.link || '').includes('/posts/')) ? `data-post-id="${(n.link || '').split('/').pop()}"` : ''}>
           <div class="orb" style="width:40px; height:40px; min-width:40px; font-size:1rem; background:var(--bg-card); border:1px solid var(--border); color:${iconData.color}; display:flex; align-items:center; justify-content:center; border-radius:50%;">
             <i class="fas ${iconData.icon}"></i>
           </div>
           <div class="notif-content">
             <div class="notif-text">${n.content}</div>
             <small class="relative-time">${getRelativeTime(n.createdAt)}</small>
           </div>
        </div>
      `;
    }).join('');
    try { container.querySelectorAll('.notification-card[data-post-id]').forEach(el => { el.addEventListener('click', () => { const id = el.dataset.postId; if (id) { state.pendingPostId = id; resolveDeeplinkPost(); } }); }); } catch (_) { }

    if (unread > 0) {
      apiRequest('/notifications/read/all', 'PUT').then(() => { if (badge) badge.style.display = 'none'; }).catch(() => { });
    }
  } catch (e) {
    console.error(e);
  }
}

// --- Profile ---
function renderProfileSkeleton() {
  const header = document.getElementById('profileHeader');
  const feed = document.getElementById('profileFeed');
  if (header) {
    header.innerHTML = `<div class="card skeleton-card"></div>`;
  }
  if (feed) {
    feed.innerHTML = `
      <div class="card skeleton-line"></div>
      <div class="card skeleton-line"></div>
      <div class="card skeleton-line"></div>
    `;
  }
}

async function loadProfile(userId) {
  if (!userId) {
    console.error('loadProfile: No userId provided');
    return;
  }

  // Convert to string for comparison
  const targetUserId = userId.toString();
  state.profileId = targetUserId;

  renderProfileSkeleton();
  const container = document.getElementById('profileHeader');
  const banner = document.getElementById('profileBanner');
  const feedContainer = document.getElementById('profileFeed');

  try {
    // Parallel requests for instant loading
    const [user, postsResponse] = await Promise.all([
      apiRequest(`/users/${targetUserId}`, 'GET'),
      apiRequest(`/posts/user/${targetUserId}`, 'GET')
    ]);
    
    // Handle both old format (array) and new format (object with pagination)
    const posts = Array.isArray(postsResponse) ? postsResponse : (postsResponse.posts || []);

    // Compare user IDs properly
    const currentUserId = state.user?._id?.toString();
    const isMe = currentUserId === targetUserId;
    const initials = user.username ? user.username[0].toUpperCase() : 'U';
    state.profileDraft = user;
    state.profileAvatarData = null;
    if (banner) {
      if (user.coverImage) {
        banner.style.backgroundImage = `url('${user.coverImage}')`;
        banner.style.animation = 'none';
      } else {
        // CSS handles the animation now
        banner.style.backgroundImage = 'none';
        banner.style.animation = '';
      }
    }

    if (container) {
      const followers = Array.isArray(user.followers) ? user.followers : [];
      const following = Array.isArray(user.following) ? user.following : [];
      const currentUserId = state.user?._id?.toString();
      const isFollowedBy = followers.some(f => {
        const followerId = (f._id || f).toString();
        return followerId === currentUserId;
      });
      const isFollowing = isFollowingUser(user._id);
      const mutualBadge = (!isMe && isFollowing && isFollowedBy)
        ? `<span class="mutual-pill"><i class="fas fa-user-check"></i> Mutual</span>`
        : '';
      const avatarSeed = getAvatarSeed(user);
      const src = (user.profilePicture || '').toString();
      const hasImg = src && !/placeholder\.com/i.test(src);
      const avatarStyle = hasImg ? '' : `style="background:${getAvatarColor(avatarSeed)}"`;
      const avatarContent = hasImg
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(user.username || 'User')}">`
        : avatarSeed.charAt(0);

      container.innerHTML = `
        <div class="profile-summary">
          <div class="profile-avatar" ${avatarStyle}>
            ${avatarContent}
          </div>
          <div class="profile-details">
            <div class="profile-title">
              <h2>${user.fullName || user.username}</h2>
              ${mutualBadge}
            </div>
            <p class="profile-handle">@${user.username}</p>
            <p class="profile-bio">${user.bio || 'This user prefers to keep an air of mystery.'}</p>
            <div class="profile-stats">
              <div class="profile-stat">
                <strong>${posts.length}</strong>
                <span>Posts</span>
              </div>
              <button class="profile-stat link" type="button" data-follow-type="followers">
                <strong>${followers.length}</strong>
                <span>Followers</span>
              </button>
              <button class="profile-stat link" type="button" data-follow-type="following">
                <strong>${following.length}</strong>
                <span>Following</span>
              </button>
            </div>
          </div>
          ${!isMe
          ? `<div style="display:flex; gap:8px;">
                <button class="btn ${isFollowing ? 'secondary' : 'primary'}" type="button" id="profileFollowBtn" onclick="window.followUser('${user._id}')">${isFollowing ? 'Following' : 'Follow'}</button>
                <button class="btn secondary" type="button" onclick="window.startChatWithUser('${user._id}', '${user.username}')" title="Send message">
                  <i class="fas fa-envelope"></i> Message
                </button>
              </div>`
          : `<button class="btn secondary" type="button" onclick="window.openEditProfile()">Edit Profile</button>`
        }
        </div>
      `;
    }

    renderPosts(posts, feedContainer, true); // Show delete button in profile view
    renderProfileTrips(targetUserId);
    wireProfileStats(user);
  } catch (e) {
    console.error('Load profile error:', e);
    if (container) {
      container.innerHTML = `
        <div class="card empty-state">
          <p>We couldn't load this profile.</p>
          <button class="btn secondary" type="button" onclick="loadProfile('${targetUserId}')">Retry</button>
        </div>
      `;
    }
    if (banner) {
      // CSS handles the animation now
      banner.style.backgroundImage = 'none';
      banner.style.animation = '';
    }
    if (feedContainer) feedContainer.innerHTML = '';
  }
}

async function renderProfileTrips(userId) {
  const container = document.getElementById('profileTrips');
  if (!container) return;
  container.innerHTML = '<div class="card empty-state">Loading trips...</div>';
  try {
    const trips = await apiRequest('/trips', 'GET');
    const authored = (trips || []).filter(t => {
      const hostId = t.host?._id?.toString() || t.host?.toString();
      return hostId === userId.toString();
    });
    if (!authored.length) {
      container.innerHTML = '<div class="card empty-state">No trips yet.</div>';
      return;
    }
    container.innerHTML = authored.map(t => {
      const city = t.destination?.city || 'Unknown';
      const country = t.destination?.country ? `, ${t.destination.country}` : '';
      const start = t.startDate ? new Date(t.startDate).toLocaleDateString() : 'TBD';
      const end = t.endDate ? new Date(t.endDate).toLocaleDateString() : 'TBD';
      const coverImg = t.coverImage || 'https://images.unsplash.com/photo-1502920917128-1aa500764b43?auto=format&fit=crop&w=600&q=60';
      return `
        <article class="journey-card compact">
          <div class="journey-hero" style="background-image:url('${coverImg}')"></div>
          <div class="journey-body">
            <div class="journey-meta">
              <h4>${escapeHtml(t.title || 'Untitled Trip')}</h4>
              <span>${escapeHtml(city)}${escapeHtml(country)}</span>
            </div>
            <p>${escapeHtml(t.description || '')}</p>
            <div class="journey-foot">
              <span><i class="fas fa-calendar"></i> ${start} - ${end}</span>
              <span><i class="fas fa-users"></i> ${(t.participants?.length || 1)}/${t.maxParticipants || 8}</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="card empty-state">Unable to load trips.</div>';
    console.error('renderProfileTrips error', err);
  }
}

function wireProfileStats(user) {
  const stats = document.querySelectorAll('[data-follow-type]');
  if (!stats.length) return;
  stats.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.followType;
      const list = type === 'following' ? (user.following || []) : (user.followers || []);
      openFollowDrawer(type, list);
    });
  });
}

function openFollowDrawer(type, list = []) {
  const drawer = document.getElementById('followDrawer');
  const title = document.getElementById('followDrawerTitle');
  const body = document.getElementById('followDrawerBody');
  if (!drawer || !title || !body) return;
  const label = type === 'following' ? 'Following' : 'Followers';
  title.textContent = label;
  if (!list.length) {
    body.innerHTML = `<p style="padding:16px; color:var(--text-muted);">No ${label.toLowerCase()} yet.</p>`;
  } else {
    body.innerHTML = list.map(renderFollowDrawerRow).join('');
  }
  drawer.classList.remove('hidden');
}

function closeFollowDrawer() {
  const drawer = document.getElementById('followDrawer');
  if (drawer) drawer.classList.add('hidden');
}

function renderFollowDrawerRow(member) {
  const normalized = typeof member === 'object' ? member : { _id: member };
  const id = (normalized._id || normalized).toString();
  const isMe = id === state.user?._id?.toString();
  const name = normalized.fullName || normalized.username || 'User';
  const handle = normalized.username ? `@${normalized.username}` : '';
  const following = isFollowingUser(id);
  return `
    <div class="follow-drawer-row">
      <div class="follow-drawer-avatar">${renderAvatar(normalized, 48)}</div>
      <div class="follow-drawer-meta">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(handle)}</span>
      </div>
      <div class="follow-drawer-actions">
        ${isMe ? '' : following
      ? `<button class="btn secondary" data-follow-user="${id}" onclick="event.stopPropagation(); window.unfollowUser('${id}')">Following</button>`
      : `<button class="btn primary" data-follow-user="${id}" onclick="event.stopPropagation(); window.followUser('${id}')">Follow</button>`
    }
        <button class="btn ghost" type="button" onclick="event.stopPropagation(); window.viewUserProfile('${id}')">
          <i class="fas fa-user"></i>
        </button>
      </div>
    </div>
  `;
}

function openShareDrawer() {
  if (!state.shareDraft) {
    toast('Select a post to share first', 'error');
    return;
  }
  if (!Array.isArray(state.chats) || !state.chats.length) {
    loadChats().then((chats) => {
      if (chats && chats.length) {
        openShareDrawer();
      } else {
        toast('Start a conversation to share this post.', 'error');
      }
    }).catch(() => toast('Unable to load chats right now', 'error'));
    return;
  }
  const existing = document.getElementById('shareDrawer');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'shareDrawer';
  overlay.className = 'follow-drawer';
  const rows = state.chats.map(renderShareDrawerRow).join('');
  overlay.innerHTML = `
    <div class="follow-drawer-card">
      <div class="follow-drawer-head">
        <h4>Share via Messages</h4>
        <button class="ghost-icon" type="button" data-close-share><i class="fas fa-times"></i></button>
      </div>
      <div class="follow-drawer-body">
        ${rows || '<p style="padding:16px; color:var(--text-muted);">No conversations yet.</p>'}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeShareDrawer();
  });
  const closeBtn = overlay.querySelector('[data-close-share]');
  if (closeBtn) closeBtn.addEventListener('click', closeShareDrawer);
  overlay.querySelectorAll('[data-share-chat]').forEach(btn => {
    btn.addEventListener('click', () => {
      sendShareToChat(btn.dataset.shareChat, btn.dataset.chatUsername);
    });
  });
}

function closeShareDrawer() {
  const drawer = document.getElementById('shareDrawer');
  if (drawer) drawer.remove();
  state.shareDraft = null;
}

function renderShareDrawerRow(chat) {
  if (!chat?.user?._id) return '';
  const username = chat.user.username || chat.user.fullName || 'User';
  const fullName = chat.user.fullName && chat.user.fullName !== username ? chat.user.fullName : '';
  return `
    <div class="follow-drawer-row">
      <div class="follow-drawer-avatar">${renderAvatar(chat.user, 48)}</div>
      <div class="follow-drawer-meta">
        <strong>${escapeHtml(username)}</strong>
        <span>${escapeHtml(fullName)}</span>
      </div>
      <div class="follow-drawer-actions">
        <button class="btn primary" type="button" data-share-chat="${chat.user._id}" data-chat-username="${escapeHtml(username)}">Send</button>
      </div>
    </div>
  `;
}

async function sendShareToChat(chatId, username = '') {
  if (!state.shareDraft) return;
  try {
    const message = `${state.shareDraft.text} ${state.shareDraft.url}`.trim();
    const payload = { receiverId: chatId, content: message };
    if (state.shareDraft.mediaUrl) {
      payload.messageType = state.shareDraft.messageType || 'image';
      payload.mediaUrl = state.shareDraft.mediaUrl;
    }
    await apiRequest('/messages', 'POST', payload);
    toast(`Shared with ${username || 'friend'}`);
    closeShareDrawer();
    state.activeChatId = chatId;
    loadMessages(chatId, username);
    state.shareDraft = null;
  } catch (err) {
    toast(err.message || 'Failed to share', 'error');
  }
}

// --- Trending & Suggestions (Extras) ---
async function loadTrending() {
  const container = document.getElementById('tagCloud');
  if (!container) return;
  try {
    const res = await apiRequest('/ai/trending', 'GET');
    if (res.trending && res.trending.length) {
      container.innerHTML = res.trending.map(t => `
        <span class="tag-chip">#${t.tag}</span>
      `).join('');
    } else {
      container.innerHTML = '<small>No trends yet.</small>';
    }
  } catch (e) { }
}

async function loadSuggestions() {
  const container = document.getElementById('suggestedUsers');
  if (!container) return;
  try {
    const users = await apiRequest('/ai/suggest-friends', 'GET');
    if (users.length) {
      container.innerHTML = users.slice(0, 3).map(u => `
        <div class="suggested-card">
           <div class="suggested-meta">
             <div class="orb" style="width:32px; height:32px; font-size:0.8rem;">${u.user.username[0].toUpperCase()}</div>
             <div>
               <strong>${u.user.username}</strong>
               <small>Recommended</small>
             </div>
           </div>
           <button class="btn secondary" onclick="window.followUser('${u.user._id}')">Follow</button>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<small>No suggestions.</small>';
    }
  } catch (e) { }
}

async function loadStories() {
  const container = document.getElementById('storyRail');
  if (container) {
    container.innerHTML = '<div class="story-empty">Syncing stories...</div>';
  }
  try {
    const stories = await apiRequest('/stories/feed', 'GET');
    state.stories = stories;
    renderStoryRail(stories);
    updateHomeMetrics();
  } catch (e) {
    if (container) container.innerHTML = '<div class="story-empty">No stories yet.</div>';
  }
}

function renderStoryRail(groups) {
  const container = document.getElementById('storyRail');
  if (!container) return;
  const createCard = `
    <button class="story-circle ring" data-create="true" aria-label="Create story">
      <i class="fas fa-plus"></i>
    </button>
  `;
  if (!groups || !groups.length) {
    container.innerHTML = createCard + `
      <div class="empty-state-message">
        <i class="fas fa-camera"></i>
        <p>No one has shared stories yet.</p>
        <button class="btn secondary" onclick="document.querySelector('[data-create=true]').click()">
          <i class="fas fa-plus"></i> Create First Story
        </button>
      </div>
    `;
    return;
  }
  container.innerHTML = [
    createCard,
    ...groups.map(group => {
      const src = (group.user?.profilePicture || '').toString();
      const hasImg = src && !/placeholder\.com/i.test(src);
      const seed = getAvatarSeed(group.user || {});
      const initials = getInitials(group.user || {});
      const color = getAvatarColor(seed);
      const media = hasImg
        ? `<img src="${src}" alt="${group.user.username}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`
        : `<div class="orb" style="width:100%; height:100%; border-radius:inherit; display:flex; align-items:center; justify-content:center; font-size:1.2rem; background:${color}; color:white;">${initials}</div>`;
      const isNew = group.stories?.some(story => {
        return !(story.views || []).some(v => {
          const viewerId = v.user?._id || v.user;
          if (!viewerId || !state.user?._id) return false;
          return viewerId.toString() === state.user._id;
        });
      });
      return `
        <button class="story-circle ${isNew ? 'ring' : ''}" data-user="${group.user._id}" title="${group.user.username}">
          ${media}
        </button>
      `;
    })
  ].join('');
}

function openComposer(mode = 'post') {
  const modal = document.getElementById('composerModal');
  const form = document.getElementById('composerForm');
  if (!modal || !form) return;
  form.reset();
  modal.classList.remove('hidden');
  setComposerMode(mode);
}

function closeComposer() {
  const modal = document.getElementById('composerModal');
  if (modal) modal.classList.add('hidden');
  clearMediaPreview('composer');
  clearMediaPreview('story');
}

function setComposerMode(mode) {
  const tabs = document.querySelectorAll('.composer-tab');
  const sections = document.querySelectorAll('.composer-section');
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  sections.forEach(section => section.classList.toggle('active', section.dataset.mode === mode));
  const form = document.getElementById('composerForm');
  if (form) form.dataset.mode = mode;
}

async function submitComposer(e) {
  e.preventDefault();
  const form = e.target;
  const mode = form.dataset.mode || 'post';
  try {
    if (mode === 'post') {
      const content = form.postContent.value.trim();
      const hasMedia = Boolean(state.composerMedia?.data);
      if (!content && !hasMedia) return toast('Share text or add media', 'error');
      const payload = {};
      if (content) payload.content = content;
      if (hasMedia) {
        payload.image = state.composerMedia.data;
      }
      
      // Close instantly
      form.reset();
      closeComposer();
      clearMediaPreview('composer');
      toast('Moment published');
      
      await apiRequest('/posts', 'POST', payload);
      loadFeed();
    } else if (mode === 'story') {
      let mediaUrl = form.storyMedia.value.trim();
      const caption = form.storyCaption.value.trim();

      // If user uploaded a file, use that instead
      if (state.storyMedia?.data) {
        mediaUrl = state.storyMedia.data;
      } else if (state.composerMedia?.data) {
        mediaUrl = state.composerMedia.data;
      }

      if (!mediaUrl) return toast('Add a media URL or upload a file', 'error');

      // Determine media type
      const mediaType = mediaUrl.startsWith('data:video/') || mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image';

      // Close instantly
      form.reset();
      closeComposer();
      clearMediaPreview('story');
      clearMediaPreview('composer');
      toast('Story is live for 24h');
      
      await apiRequest('/stories', 'POST', { mediaUrl, caption, mediaType });
      loadStories();
    } else if (mode === 'trip') {
      const payload = {
        title: form.tripTitle.value.trim(),
        city: form.tripCity.value.trim(),
        country: form.tripCountry.value.trim(),
        startDate: form.tripStart.value,
        endDate: form.tripEnd.value,
        maxParticipants: Number(form.tripGuests.value) || 5,
        description: form.tripDescription.value,
        contactPhone: form.tripContact.value.trim()
      };
      if (!payload.title || !payload.city || !payload.country) {
        return toast('Trip title, city and country are required', 'error');
      }
      const { city, country } = payload;
      payload.destination = { city, country };
      delete payload.city;
      delete payload.country;
      
      // If user selected an image, use it; otherwise auto-generate with AI
      if (state.tripMedia?.data) {
        payload.coverImage = state.tripMedia.data;
      }
      
      // Create trip immediately without waiting for image generation
      form.reset();
      closeComposer(); // Close instantly for better UX
      
      const tripResponse = await apiRequest('/trips', 'POST', payload);
      toast('Trip deployed');
      loadTrips();
      
      // If no cover image was provided, generate one in the background
      if (!state.tripMedia?.data && tripResponse?._id) {
        console.log('Starting background image generation for trip:', tripResponse._id);
        toast('Generating cover image in background...', 'info');
        (async () => {
          try {
            const seasonMap = {
              '01': 'winter', '02': 'winter', '03': 'spring',
              '04': 'spring', '05': 'summer', '06': 'summer',
              '07': 'summer', '08': 'summer', '09': 'fall',
              '10': 'fall', '11': 'fall', '12': 'winter'
            };
            const season = payload.startDate ? seasonMap[payload.startDate.slice(5, 7)] : '';
            
            // Ultra-premium prompt for maximum photorealism
            const prompt = [
              `Professional travel photography: ${city}, ${country}`,
              season ? `stunning ${season} season weather` : '',
              'most iconic landmark view, world-famous destination, UNESCO World Heritage perspective',
              'ultra photorealistic, hyperdetailed, 100% real photograph quality',
              'shot with Canon EOS R5, Sony A1, Nikon Z9, Fujifilm GFX 100 II',
              'prime lens: Zeiss Otus 28mm f/1.4, Canon RF 50mm f/1.2, Sony GM 24mm f/1.4',
              'golden hour perfection, magic hour lighting, god rays through clouds, atmospheric perspective',
              'National Geographic cover quality, Travel + Leisure feature, Lonely Planet showcase',
              'razor sharp focus, tack sharp details, pristine clarity, crystal clear optics',
              'dramatic cinematic sky, epic cloud formations, stunning natural lighting',
              'professional color grading, cinema-grade color science, perfect white balance, rich vibrant colors',
              'masterful composition, rule of thirds, leading lines, perfect depth of field',
              'ultra high resolution, 8K quality, maximum detail capture, gallery-worthy print quality',
              'breathtaking panoramic vista, postcard perfect, magazine cover shot',
              'vivid natural saturation, perfect contrast, exceptional dynamic range',
              'architectural photography mastery, landscape excellence, travel photography award winner',
              'trending on 500px Pulse, featured on Unsplash, Getty Images quality',
              'photorealistic ONLY, genuine photograph, real location, authentic scene',
              'no people visible, no text overlays, no watermarks, no logos, pristine landscape',
              'professional editing, color correction mastery, natural enhancement',
              'DSLR professional quality, mirrorless camera perfection, large sensor excellence',
              'real world photography, true to life colors, natural lighting only',
              'premium travel destination image, luxury tourism quality, high-end travel magazine standard'
            ].filter(Boolean).join(', ');
            
            console.log('Image generation prompt:', prompt);
            const imageResponse = await apiRequest('/hf/image', 'POST', { prompt, size: '1024x680', quality: 'hd' });
            console.log('Image generation response:', imageResponse);
            if (imageResponse?.image) {
              // Update the trip with the generated cover image
              console.log('Updating trip with cover image...');
              await apiRequest(`/trips/${tripResponse._id}`, 'PUT', { coverImage: imageResponse.image });
              toast('Cover image ready!', 'success');
              loadTrips(); // Refresh to show the new cover image
            } else {
              console.warn('No image in response');
            }
          } catch (err) {
            console.error('Background AI image generation failed:', err);
            toast('Cover image generation failed', 'error');
          }
        })();
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openStoryViewer(userId) {
  const modal = document.getElementById('storyViewer');
  if (!modal) return;
  const group = state.stories.find(g => g.user._id === userId);
  if (!group || !group.stories.length) return;
  state.storySession = { groupId: userId, index: 0 };
  modal.classList.remove('hidden');
  renderStorySlide();
}

function closeStoryViewer() {
  const modal = document.getElementById('storyViewer');
  if (modal) modal.classList.add('hidden');
  state.storySession = null;
}

function cycleStory(direction) {
  if (!state.storySession) return;
  const group = state.stories.find(g => g.user._id === state.storySession.groupId);
  if (!group) return closeStoryViewer();
  const nextIndex = state.storySession.index + direction;
  if (nextIndex < 0 || nextIndex >= group.stories.length) {
    closeStoryViewer();
    return;
  }
  state.storySession.index = nextIndex;
  renderStorySlide();
}

function handleMediaSelection(fileList, target) {
  if (!fileList || !fileList.length) return;
  const file = fileList[0];
  if (file.size > MAX_UPLOAD_BYTES) {
    toast('Media must be under 6MB', 'error');
    return;
  }
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    toast('Only image or video uploads are supported', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    const payload = {
      data: event.target.result,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type
    };
    if (target === 'inline') state.inlineMedia = payload;
    else if (target === 'story') state.storyMedia = payload;
    else if (target === 'trip') state.tripMedia = payload;
    else state.composerMedia = payload;
    updateMediaPreview(target);
  };
  reader.readAsDataURL(file);
}

function updateMediaPreview(target) {
  let data;
  if (target === 'inline') data = state.inlineMedia;
  else if (target === 'story') data = state.storyMedia;
  else if (target === 'trip') data = state.tripMedia;
  else data = state.composerMedia;

  const previewId = target === 'story' ? 'storyMediaPreview' : `${target}MediaPreview`;
  const preview = document.getElementById(previewId);
  if (!preview) return;
  if (!data) {
    preview.classList.add('hidden');
    return;
  }
  preview.classList.remove('hidden');
  const thumbId = target === 'story' ? 'storyMediaThumb' : `${target}MediaThumb`;
  const nameId = target === 'story' ? 'storyMediaName' : `${target}MediaName`;
  const sizeId = target === 'story' ? 'storyMediaSize' : `${target}MediaSize`;
  const thumb = document.getElementById(thumbId);
  const nameEl = document.getElementById(nameId);
  const sizeEl = document.getElementById(sizeId);
  const isVideo = data.type?.includes('video');
  if (thumb) {
    if (isVideo) {
      thumb.style.backgroundImage = 'none';
      thumb.innerHTML = '<i class="fas fa-video"></i>';
    } else {
      thumb.style.backgroundImage = 'none';
      thumb.innerHTML = `<img src="${data.data}" alt="${data.name || 'preview'}" />`;
    }
  }
  if (nameEl) nameEl.textContent = data.name;
  if (sizeEl) sizeEl.textContent = data.size;
}

function clearMediaPreview(target) {
  if (target === 'inline') state.inlineMedia = null;
  else if (target === 'story') state.storyMedia = null;
  else if (target === 'trip') state.tripMedia = null;
  else state.composerMedia = null;
  updateMediaPreview(target);
  if (target === 'inline') {
    const input = document.getElementById('inlineMediaInput');
    if (input) input.value = '';
  } else if (target === 'story') {
    const input = document.getElementById('storyFileInput');
    if (input) input.value = '';
  } else if (target === 'trip') {
    const input = document.getElementById('tripFileInput');
    if (input) input.value = '';
  } else {
    const input = document.getElementById('composerFileInput');
    if (input) input.value = '';
  }
}

function handleDropEvent(e, zone) {
  e.preventDefault();
  if (!zone) return;
  if (e.type === 'dragover') {
    zone.classList.add('dragover');
  } else if (e.type === 'dragleave') {
    zone.classList.remove('dragover');
  } else if (e.type === 'drop') {
    zone.classList.remove('dragover');
    handleMediaSelection(e.dataTransfer.files, 'composer');
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function configureApiEndpoint() {
  const current = localStorage.getItem('sociosphere_api') || DEFAULT_API;
  const next = prompt('Enter SocioSphere API base URL', current);
  if (next && next.trim()) {
    localStorage.setItem('sociosphere_api', next.trim());
    toast('API endpoint saved. Reload the app to apply.');
  }
}

async function checkSystemStatus() {
  try {
    const status = await apiRequest('/system/status', 'GET');
    state.systemStatus = status;
    if (status?.email && status.email.configured === false) {
      console.warn('Email service is not configured. OTP emails will fall back to console logs.');
    }
    if (status?.llm && status.llm.available === false) {
      console.warn('LLM keys are missing. AI helpers will use basic fallbacks.');
    }
  } catch (err) {
    console.warn('System status check failed:', err.message);
  }
}

function renderStorySlide() {
  if (!state.storySession) return;
  const group = state.stories.find(g => g.user._id === state.storySession.groupId);
  if (!group) return closeStoryViewer();
  const story = group.stories[state.storySession.index];
  if (!story) return closeStoryViewer();
  const payloadEl = document.getElementById('storyPayload');
  const metaEl = document.getElementById('storyMeta');
  const progressEl = document.getElementById('storyProgress');
  if (!payloadEl || !metaEl || !progressEl) return;

  const isVideo = story.mediaType?.includes('video') || story.mediaUrl?.match(/\.(mp4|webm|ogg)$/i);
  const mediaUrl = story.mediaUrl || '';
  const isOwnStory = group.user._id === state.user._id;

  // Fix image URL if it's a data URL or needs proper handling
  if (mediaUrl) {
    payloadEl.innerHTML = isVideo
      ? `<video src="${mediaUrl}" controls autoplay playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
      : `<img src="${mediaUrl}" alt="${story.caption || 'Story'}" style="width:100%; height:100%; object-fit:contain;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding:40px; text-align:center; color:var(--text-muted);\\'><i class=\\'fas fa-image\\' style=\\'font-size:3rem; margin-bottom:10px;\\'></i><p>Image failed to load</p></div>';">`;
  } else {
    payloadEl.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="fas fa-image" style="font-size:3rem; margin-bottom:10px;"></i><p>No media available</p></div>';
  }

  const initials = (group.user?.username || 'U')[0].toUpperCase();
  const src = (group.user?.profilePicture || '').toString();
  const hasImg = src && !/placeholder\.com/i.test(src);
  const seed = getAvatarSeed(group.user || {});
  const color = getAvatarColor(seed);
  const avatarHtml = hasImg
    ? `<img src="${src}" alt="${group.user.username}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">`
    : `<div class="orb" style="width:40px; height:40px; font-size:1rem; background:${color}; color:white; border:2px solid ${color};">${initials}</div>`;

  metaEl.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      ${avatarHtml}
      <div>
        <strong>${group.user.username}</strong>
        <span style="color:var(--text-muted); margin-left:8px;">${formatTimeAgo(story.createdAt)}</span>
      </div>
    </div>
    <span>${story.caption || ''}</span>
  `;
  const ratio = ((state.storySession.index + 1) / group.stories.length) * 100;
  progressEl.style.setProperty('--progress', `${ratio}%`);

  // Mark as viewed silently
  apiRequest(`/stories/${story._id}/view`, 'POST').catch(() => { });

  // Update action buttons - always show delete button if it's own story
  const actionsEl = document.getElementById('storyActions');
  if (actionsEl) {
    let actionsHtml = '';

    if (isOwnStory) {
      actionsHtml = `<button class="ghost-icon story-delete-btn" style="background:rgba(255,0,0,0.4); color:#ff4444; backdrop-filter:blur(10px); border:2px solid rgba(255,68,68,0.6); padding:12px; font-size:1.1rem; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:50%; box-shadow:0 2px 10px rgba(255,0,0,0.3);" onclick="window.deleteCurrentStory()" title="Delete story"><i class="fas fa-trash"></i></button>`;
    }

    // Always show like button
    actionsHtml += `<button class="ghost-icon story-like-btn" id="storyLikeBtn" style="background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); padding:12px; font-size:1.1rem; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid rgba(255,255,255,0.2);" onclick="window.toggleStoryLike()" title="Like story"><i class="far fa-heart"></i></button>`;

    actionsEl.innerHTML = actionsHtml;
    actionsEl.style.cssText = 'position:absolute; top:80px; right:20px; display:flex; gap:12px; flex-direction:column; z-index:10;';
    updateStoryLikeButton();
  }
}

async function updateStoryLikeButton() {
  if (!state.storySession || !state.user) return;
  const group = state.stories.find(g => g.user._id === state.storySession.groupId);
  if (!group) return;
  const story = group.stories[state.storySession.index];
  if (!story) return;

  const likeBtn = document.getElementById('storyLikeBtn');
  if (!likeBtn) return;

  // Check if story has likes array, if not initialize it
  if (!story.likes) story.likes = [];

  const isLiked = story.likes.some(id => {
    const idStr = id.toString ? id.toString() : id;
    return idStr === state.user._id.toString();
  });
  const likesCount = story.likes.length || 0;

  likeBtn.innerHTML = `<i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>`;
  likeBtn.style.color = isLiked ? '#ff4444' : 'white';
  likeBtn.style.background = isLiked ? 'rgba(255,68,68,0.2)' : 'rgba(255,255,255,0.1)';
  likeBtn.title = `${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`;
}

window.toggleStoryLike = async function () {
  if (!state.storySession || !state.user) return;
  const group = state.stories.find(g => g.user._id === state.storySession.groupId);
  if (!group) return;
  const story = group.stories[state.storySession.index];
  if (!story) return;

  try {
    const res = await apiRequest(`/stories/${story._id}/like`, 'POST');
    // Update story in state
    if (!story.likes) story.likes = [];

    const currentLikeIndex = story.likes.findIndex(id => {
      const idStr = id.toString ? id.toString() : id;
      return idStr === state.user._id.toString();
    });

    if (currentLikeIndex > -1) {
      // Unlike
      story.likes.splice(currentLikeIndex, 1);
    } else {
      // Like
      story.likes.push(state.user._id);
    }

    updateStoryLikeButton();

    // Add animation
    const likeBtn = document.getElementById('storyLikeBtn');
    if (likeBtn) {
      likeBtn.classList.add('heartbeat');
      setTimeout(() => likeBtn.classList.remove('heartbeat'), 400);
    }
  } catch (e) {
    toast(e.message || 'Failed to like story', 'error');
  }
};

function formatTimeAgo(date) {
  const ts = typeof date === 'string' ? new Date(date).getTime() : date;
  const diff = Date.now() - ts;
  const units = [
    { label: 'd', value: 86400000 },
    { label: 'h', value: 3600000 },
    { label: 'm', value: 60000 },
    { label: 's', value: 1000 }
  ];
  for (const unit of units) {
    const amount = Math.floor(diff / unit.value);
    if (amount >= 1) return `${amount}${unit.label} ago`;
  }
  return 'just now';
}

function debounce(fn, delay = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(null, args), delay);
  };
}

function setLiveStatus(isOnline) {
  const pill = document.getElementById('liveStatus');
  if (!pill) return;
  const dot = pill.querySelector('.dot');
  const text = document.getElementById('liveStatusText');
  if (dot) {
    const color = isOnline ? '#16a34a' : '#f97316';
    dot.style.background = color;
    dot.style.boxShadow = `0 0 8px ${color}`;
  }
  if (text) text.textContent = isOnline ? 'Live' : 'Offline';
}

// --- Global Helpers ---

// Attached to window for inline onclick handlers
window.viewUserProfile = (id) => {
  if (!id) return;
  const targetUserId = id.toString();
  const currentUserId = state.user?._id?.toString();

  // If viewing own profile, navigate normally
  if (targetUserId === currentUserId) {
    state.profileId = targetUserId;
    navigate('profile');
    return;
  }

  // For other users, open in modal
  openProfileModal(targetUserId);
};

window.closeProfileModal = function () {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.add('hidden');
};

window.openFollowList = async function (userId, listType = 'followers') {
  if (!userId) return;
  try {
    const user = await apiRequest(`/users/${userId}`, 'GET');
    const list = listType === 'followers' ? (user.followers || []) : (user.following || []);

    // Build modal
    const existing = document.querySelector('.follow-list-overlay');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'follow-list-overlay';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:11000;';
    modal.innerHTML = `
      <div style="background:var(--bg-card); padding:18px; border-radius:12px; width:420px; max-height:70vh; overflow:auto; border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 style="margin:0;">${listType === 'followers' ? 'Followers' : 'Following'}</h3>
          <button class="ghost-icon" onclick="this.closest('.follow-list-overlay').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div id="followListContainer">
          ${list.length ? list.map(u => {
      const uid = typeof u === 'object' ? (u._id || '') : u;
      const uname = typeof u === 'object' ? (u.username || uid) : u;
      return `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
                <div style="display:flex; gap:10px; align-items:center;">
                  <div class="orb" style="width:36px; height:36px;">${(uname[0] || 'U').toUpperCase()}</div>
                  <div>
                    <div style="font-weight:bold;">${escapeHtml(uname)}</div>
                    <small style="color:var(--text-muted);">@${escapeHtml(uname)}</small>
                  </div>
                </div>
                <div>
                  <button class="btn secondary" onclick="window.viewUserProfile('${uid}'); document.querySelector('.follow-list-overlay')?.remove();">View</button>
                </div>
              </div>`;
    }).join('') : '<div style="padding:12px; color:var(--text-muted);">No users found</div>'}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    toast('Failed to load list', 'error');
  }
};

window.followUser = async (id) => {
  // Optimistic UI: switch follow buttons to Following immediately
  // Find all buttons that represent following state for this user. Some templates
  // render buttons with `data-follow-user`, others use inline `onclick` or
  // specific ids like `profileFollowBtn`. Collect all and dedupe.
  const btnSet = new Set();
  document.querySelectorAll(`[data-follow-user="${id}"]`).forEach(b => btnSet.add(b));
  // Inline onclick handlers (e.g. onclick="window.followUser('...')")
  document.querySelectorAll('[onclick]').forEach(el => {
    const attr = el.getAttribute('onclick') || '';
    if (attr.includes(`window.followUser('${id}')`) || attr.includes(`window.followUser(\"${id}\")`) || el.id === 'profileFollowBtn') {
      btnSet.add(el);
    }
  });
  const btns = Array.from(btnSet);
  btns.forEach(b => {
    b.classList.remove('primary');
    b.classList.add('secondary');
    b.textContent = 'Following';
  });
  try {
    const res = await apiRequest(`/users/follow/${id}`, 'POST');
    toast('Followed user');
    if (res.user) {
      state.user = res.user;
    } else {
      await fetchUser();
    }
    if (state.profileId === id || state.view === 'profile') {
      loadProfile(id);
    }
    if (state.view === 'explore') {
      await loadExplore();
    }
    const searchInput = document.getElementById('globalSearch');
    if (searchInput && searchInput.value.trim().length >= 2) {
      updateSearch(searchInput.value);
    }
  } catch (e) {
    // revert optimistic UI
    btns.forEach(b => {
      b.classList.remove('secondary');
      b.classList.add('primary');
      b.textContent = 'Follow';
    });
    // If server reports already following, switch to unfollow state
    if (e.message && e.message.includes('already')) {
      btns.forEach(b => {
        b.classList.remove('primary');
        b.classList.add('secondary');
        b.textContent = 'Following';
      });
      try {
        const res = await apiRequest(`/users/unfollow/${id}`, 'POST');
        toast('Unfollowed user');
        if (res.user) state.user = res.user; else await fetchUser();
        if (state.profileId === id || state.view === 'profile') loadProfile(id);
        const searchInput = document.getElementById('globalSearch');
        if (searchInput && searchInput.value.trim().length >= 2) updateSearch(searchInput.value);
      } catch (e2) {
        toast(e.message || 'Follow action failed', 'error');
      }
    } else {
      toast(e.message || 'Follow action failed', 'error');
    }
  }
};

window.unfollowUser = async (id) => {
  // Optimistic UI: switch follow buttons to Follow immediately
  // Symmetric logic to followUser: find all follow buttons and set them to "Follow"
  const btnSet = new Set();
  document.querySelectorAll(`[data-follow-user="${id}"]`).forEach(b => btnSet.add(b));
  document.querySelectorAll('[onclick]').forEach(el => {
    const attr = el.getAttribute('onclick') || '';
    if (attr.includes(`window.unfollowUser('${id}')`) || attr.includes(`window.unfollowUser(\"${id}\")`) || el.id === 'profileFollowBtn') {
      btnSet.add(el);
    }
  });
  const btns = Array.from(btnSet);
  btns.forEach(b => {
    b.classList.remove('secondary');
    b.classList.add('primary');
    b.textContent = 'Follow';
  });
  try {
    const res = await apiRequest(`/users/unfollow/${id}`, 'POST');
    // Show undo toast allowing the user to quickly refollow
    toastWithAction('Unfollowed user', 'Undo', async () => {
      await window.followUser(id);
      toast('Follow restored');
    }, 6000);
    if (res.user) {
      state.user = res.user;
    } else {
      await fetchUser();
    }
    if (state.profileId === id || state.view === 'profile') {
      loadProfile(id);
    }
    if (state.view === 'explore') {
      await loadExplore();
    }
    const searchInput = document.getElementById('globalSearch');
    if (searchInput && searchInput.value.trim().length >= 2) {
      updateSearch(searchInput.value);
    }
  } catch (e) {
    // revert optimistic UI
    btns.forEach(b => {
      b.classList.remove('primary');
      b.classList.add('secondary');
      b.textContent = 'Following';
    });
    toast(e.message || 'Failed to unfollow', 'error');
  }
};

window.startChatWithUser = function (userId, username) {
  navigate('messages');
  setTimeout(() => {
    loadMessages(userId, username);
  }, 100);
};

window.joinTrip = async (tripId) => {
  try {
    await apiRequest(`/trips/${tripId}/join`, 'POST');
    toast('Trip join request sent');
    showTripChatPreview(tripId);
    loadTrips();
  } catch (e) { toast(e.message || 'Failed to join trip', 'error'); }
};

function showTripChatPreview(tripId) {
  const existing = document.getElementById('tripChatPreview');
  if (existing) existing.remove();

  const preview = document.createElement('div');
  preview.id = 'tripChatPreview';
  preview.className = 'trip-chat-preview';
  preview.innerHTML = `
    <div class="trip-chat-preview__header">
      <span class="dot live"></span>
      Trip Dashboard
    </div>
    <div class="trip-chat-preview__body">
      <p><strong>Trip joined!</strong> View your trip dashboard to coordinate with participants.</p>
      <p class="trip-chat-preview__hint">Check the map, schedule, and participant details.</p>
    </div>
    <div class="trip-chat-preview__actions">
      <button class="btn ghost" onclick="document.getElementById('tripChatPreview').remove()">Dismiss</button>
      <button class="btn primary" onclick="window.openTripDashboard('${tripId}'); document.getElementById('tripChatPreview').remove();">Open Dashboard</button>
    </div>
  `;

  document.body.appendChild(preview);

  setTimeout(() => {
    preview.classList.add('visible');
  }, 50);

  // Auto-dismiss after 10s
  setTimeout(() => {
    if (preview.parentNode) preview.remove();
  }, 10000);
}

window.deleteTrip = async (tripId) => {
  if (!confirm('Delete this trip?')) return;
  
  // INSTANT: Remove from DOM immediately
  const tripCards = document.querySelectorAll(`.trip-card[data-trip-id="${tripId}"], [data-trip-id="${tripId}"]`);
  const removedElements = [];
  tripCards.forEach(card => {
    removedElements.push({ element: card, parent: card.parentElement, nextSibling: card.nextSibling });
    card.style.transition = 'opacity 0.2s, transform 0.2s';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
    setTimeout(() => card.remove(), 200);
  });
  
  toast('Trip deleted');
  
  // Send request in background
  try {
    await apiRequest(`/trips/${tripId}`, 'DELETE');
  } catch (e) {
    // Revert on error
    removedElements.forEach(({ element, parent, nextSibling }) => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
      if (parent) {
        if (nextSibling && nextSibling.parentElement === parent) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      }
    });
    toast(e.message || 'Failed to delete trip', 'error');
    loadTrips();
  }
};

let tripMapInstance = null;

window.openTripMap = async function (tripId) {
  const modal = document.getElementById('tripMapModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const mapContainer = document.getElementById('tripMapView');
  if (mapContainer) mapContainer.innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">Loading map...</div>';

  try {
    // 1. Fetch Trip
    const trip = await apiRequest(`/trips/${tripId}`, 'GET');

    // 2. Trigger Auto-Geocoding (background)
    // We await this so we can show the pins immediately
    let highlights = trip.highlights || [];
    try {
      const geoRes = await apiRequest(`/trips/${tripId}/geocode-highlights`, 'POST');
      if (geoRes.highlights) highlights = geoRes.highlights;
    } catch (err) {
      console.warn('Auto-geocoding failed, showing existing coords only', err);
    }

    // 3. Initialize Map
    if (mapContainer) mapContainer.innerHTML = '';
    if (tripMapInstance) {
      tripMapInstance.remove();
      tripMapInstance = null;
    }

    if (!window.L) {
      mapContainer.innerHTML = '<div style="padding:20px; text-align:center;">Map library not loaded.</div>';
      return;
    }

    // Default to world view or destination
    let center = [20, 0];
    let zoom = 2;
    const destLat = trip.destination?.coordinates?.lat;
    const destLng = trip.destination?.coordinates?.lng;

    if (destLat && destLng) {
      center = [destLat, destLng];
      zoom = 10;
    }

    tripMapInstance = L.map('tripMapView').setView(center, zoom);

    // Layers with detailed street and road labels in English
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>',
      maxZoom: 20
    });
    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri'
    });

    streetLayer.addTo(tripMapInstance);

    L.control.layers({
      "Street": streetLayer,
      "Satellite": satLayer
    }).addTo(tripMapInstance);

    const markers = [];
    const points = [];

    const getInitial = (txt) => (txt || '•').trim().charAt(0).toUpperCase();
    const createCircleMarker = ({ size = 36, bg = '#6c5dd3', image, label = '•', border = '#fff', iconHtml = null }) => {
      const fontSize = size > 38 ? 14 : 12;
      const safeLabel = getInitial(label);
      let content;
      if (image) {
        content = `<img src="${image}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
      } else if (iconHtml) {
        content = `<div style="color:#fff;font-size:${fontSize}px;">${iconHtml}</div>`;
      } else {
        content = `<span style="color:#fff;font-weight:700;font-size:${fontSize}px;">${safeLabel}</span>`;
      }
      const html = `
        <div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${border};box-shadow:0 6px 16px rgba(0,0,0,0.35);background:${bg};display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${content}
        </div>
      `;
      const half = size / 2;
      return L.divIcon({
        className: 'custom-map-marker',
        html,
        iconSize: [size, size],
        iconAnchor: [half, size],
        popupAnchor: [0, -half]
      });
    };

    const hasHostImage = trip?.host?.profilePicture || trip?.host?.avatar;
    const destIcon = createCircleMarker({
      size: 42,
      bg: 'linear-gradient(135deg, #6c5dd3, #60a5fa)',
      image: hasHostImage,
      label: trip?.destination?.city || trip?.name || 'Trip',
      iconHtml: hasHostImage ? null : '<i class="fas fa-map-marked-alt"></i>'
    });

    const highlightIcon = (h) => {
      const type = (h?.type || h?.category || '').toLowerCase();
      const palette = {
        food: '#f97316',
        stay: '#22c55e',
        activity: '#06b6d4',
        transit: '#a855f7',
        photo: '#f43f5e'
      };
      const icons = {
        food: '<i class="fas fa-utensils"></i>',
        stay: '<i class="fas fa-bed"></i>',
        activity: '<i class="fas fa-hiking"></i>',
        transit: '<i class="fas fa-plane"></i>',
        photo: '<i class="fas fa-camera"></i>'
      };
      const iconHtml = icons[type] || `<span style="font-weight:700;">${getInitial(h?.label || '•')}</span>`;
      const isIcon = !!icons[type];
      const label = getInitial(h?.label || '•');
      const bg = palette[type] || '#0ea5e9';
      const image = h?.image || h?.photo || h?.thumbnail;
      return createCircleMarker({ size: 32, bg, image, label, iconHtml: isIcon ? iconHtml : null });
    };

    // Destination Marker
    if (destLat && destLng) {
      const m = L.marker([destLat, destLng], { icon: destIcon })
        .addTo(tripMapInstance)
        .bindPopup(`<b>${escapeHtml(trip.destination.city)}</b><br>Main Destination`)
        .openPopup();
      markers.push(m);
      points.push([destLat, destLng]);
    }

    // Highlight Markers
    highlights.forEach(h => {
      if (h.coordinates && h.coordinates.lat && h.coordinates.lng) {
        const m = L.marker([h.coordinates.lat, h.coordinates.lng], { icon: highlightIcon(h) })
          .addTo(tripMapInstance)
          .bindPopup(`<b>${escapeHtml(h.label)}</b><br>${escapeHtml(h.details || '')}`);
        markers.push(m);
        points.push([h.coordinates.lat, h.coordinates.lng]);
      }
    });

    // Draw Polyline Route
    if (points.length > 1) {
      // Sort points? No, assume itinerary order is logical order.
      // But highlights might be unordered. Ideally we'd sort by Day.
      // For now, simple connection.
      L.polyline(points, {
        color: '#6366f1',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      }).addTo(tripMapInstance);
    }

    // Fit bounds if multiple markers
    if (markers.length > 0) {
      const group = new L.featureGroup(markers);
      tripMapInstance.fitBounds(group.getBounds().pad(0.1));
    }

    // Close handler
    const closeBtn = document.getElementById('closeMap');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.add('hidden');
        if (tripMapInstance) {
          tripMapInstance.remove();
          tripMapInstance = null;
        }
      };
    }

  } catch (e) {
    console.error('Map error:', e);
    if (mapContainer) mapContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--danger);">Unable to load map.</div>';
    toast('Failed to load map', 'error');
  }
};

// --- Trip Expenses ---
window.openTripExpenses = async (tripId) => {
  state.currentTripId = tripId;
  const modal = document.getElementById('tripExpensesModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  try {
    const trip = await apiRequest(`/trips/${tripId}`, 'GET');
    const myId = state?.user?._id ? state.user._id.toString() : '';
    const isHost = myId && ((trip?.host?._id && trip.host._id.toString() === myId) || (trip?.host && trip.host.toString() === myId));
    const isConfirmed = Array.isArray(trip.participants) && trip.participants.some(p => {
      const uid = (p?.user?._id || p?.user);
      return uid && uid.toString() === myId && ['host', 'confirmed'].includes(p.status);
    });
    if (!isHost && !isConfirmed) {
      document.getElementById('closeExpenses').onclick = () => modal.classList.add('hidden');
      toast('Only confirmed participants can view trip finances', 'error');
      return;
    }
    const paidSel = document.getElementById('expPaidBy');
    const shareBox = document.getElementById('expSharedWithBox');
    const members = [trip.host, ...trip.participants.filter(p => ['host', 'confirmed'].includes(p.status)).map(p => p.user)];
    const opts = members.map(u => `<option value="${u._id}">${escapeHtml(u.fullName || u.username || 'User')}</option>`).join('');
    paidSel.innerHTML = opts;
    shareBox.innerHTML = members.map(u => {
      const id = u._id;
      const label = escapeHtml(u.fullName || u.username || 'User');
      return `<label style="display:inline-flex; align-items:center; gap:6px; border:1px solid var(--border); padding:6px 10px; border-radius:12px;"><input type="checkbox" class="exp-share-check" value="${id}" checked/> ${label}</label>`;
    }).join('');
    const expensesData = await apiRequest(`/trips/${tripId}/expenses`, 'GET');
    renderExpenseList(expensesData?.expenses || [], members);
    document.getElementById('btnAddExpense').onclick = addExpense;
    document.getElementById('btnComputeSettlement').onclick = computeSettlement;
    document.getElementById('btnParseReceipt').onclick = parseReceiptText;
    document.getElementById('closeExpenses').onclick = () => modal.classList.add('hidden');
  } catch (e) {
    toast('Unable to load trip finances', 'error');
  }
};

async function addExpense() {
  const tripId = state.currentTripId;
  const title = document.getElementById('expTitle').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const currency = document.getElementById('expCurrency').value.trim() || 'USD';
  const paidBy = document.getElementById('expPaidBy').value;
  const sharedWith = Array.from(document.querySelectorAll('.exp-share-check')).filter(cb => cb.checked).map(cb => cb.value);
  const note = document.getElementById('expNote').value.trim();
  if (!title || !amount || !paidBy) return toast('Fill title, amount and payer', 'error');
  try {
    const res = await apiRequest(`/trips/${tripId}/expenses`, 'POST', { title, amount, currency, paidBy, sharedWith, note });
    const trip = await apiRequest(`/trips/${tripId}`, 'GET');
    const members = [trip.host, ...trip.participants.filter(p => ['host', 'confirmed'].includes(p.status)).map(p => p.user)];
    const expensesData = await apiRequest(`/trips/${tripId}/expenses`, 'GET');
    renderExpenseList(expensesData?.expenses || [], members);
    toast('Expense added');
  } catch (e) {
    toast('Failed to add expense', 'error');
  }
}

function renderExpenseList(expenses, members) {
  const list = document.getElementById('expenseList');
  const name = (id) => {
    const u = members.find(m => (m._id || m).toString() === id.toString());
    return escapeHtml(u?.fullName || u?.username || 'User');
  };
  if (!expenses || !expenses.length) {
    list.innerHTML = '<small style="color:var(--text-muted);">No expenses yet</small>';
    return;
  }
  list.innerHTML = expenses.map(e => `
    <div class="list-item">
      <div><strong>${escapeHtml(e.title)}</strong><small style="display:block; color:var(--text-muted);">${e.currency || 'USD'} ${Number(e.amount).toFixed(2)}</small></div>
      <div><small>Payer: ${name(e.paidBy)}</small><small style="display:block; color:var(--text-muted);">Shared: ${(e.sharedWith || []).map(name).join(', ') || 'All'}</small></div>
    </div>
  `).join('');
}

async function computeSettlement() {
  const tripId = state.currentTripId;
  try {
    const res = await apiRequest(`/trips/${tripId}/settlement`, 'GET');
    const panel = document.getElementById('settlementResults');
    if (!res.transfers || !res.transfers.length) {
      panel.innerHTML = '<div class="callout success">All settled. No one owes anyone.</div>';
      return;
    }
    const trip = await apiRequest(`/trips/${tripId}`, 'GET');
    const members = [trip.host, ...trip.participants.map(p => p.user)];
    const name = (id) => {
      const u = members.find(m => (m._id || m).toString() === id.toString());
      return escapeHtml(u?.fullName || u?.username || 'User');
    };
    panel.innerHTML = res.transfers.map(t => `
      <div class="list-item"><div>${name(t.from)} ➜ ${name(t.to)}</div><strong>${t.amount.toFixed(2)}</strong></div>
    `).join('');
  } catch (e) {
    toast('Unable to compute settlement', 'error');
  }
}

async function parseReceiptText() {
  const note = document.getElementById('expNote').value.trim();
  if (!note) return toast('Paste receipt text into Note first', 'error');
  try {
    const prompt = `Extract total amount and title from this receipt text. Reply as JSON {title, amount}. Text: ${note}`;
    const res = await apiRequest('/hf/text', 'POST', { prompt, maxTokens: 80, temperature: 0.2 });
    const txt = (res && res.text) ? res.text.trim() : '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) {
      const data = JSON.parse(m[0]);
      if (data.title) document.getElementById('expTitle').value = data.title;
      if (data.amount) document.getElementById('expAmount').value = Number(data.amount);
      toast('Receipt parsed');
    } else {
      toast('AI could not parse receipt, fill manually', 'error');
    }
  } catch (e) {
    toast('Parse failed', 'error');
  }
}

// --- AI Magic Plan ---
window.openMagicPlan = async (tripId) => {
  try {
    const trip = await apiRequest(`/trips/${tripId}`, 'GET');
    if (Array.isArray(trip.highlights) && trip.highlights.length) {
      const ok = confirm('Are you sure? This will overwrite your existing itinerary.');
      if (!ok) return;
    }
    const theme = prompt('Describe your vibe (e.g., Art & Food, Adventure)');
    const days = trip.startDate && trip.endDate ? Math.max(1, Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24))) : 3;
    const promptText = `Create a ${days}-day itinerary for ${trip.destination?.city || ''}, ${trip.destination?.country || ''}. Theme: ${theme || 'balanced'}. Use the format: Day N: Label - Details. Keep it concise.`;
    const ai = await apiRequest('/hf/text', 'POST', { prompt: promptText, maxTokens: 400, temperature: 0.7 });
    const text = (ai && ai.text) ? ai.text.trim() : '';
    let highlights = [];
    text.split(/\n+/).forEach(line => {
      const m = line.match(/Day\s*(\d+)\s*:\s*(.+?)\s*-\s*(.+)/i);
      if (m) highlights.push({ day: Number(m[1]), label: m[2].trim(), details: m[3].trim() });
    });
    if (!highlights.length) {
      // Fallback: generate a simple structured plan
      const baseCity = (trip.destination?.city || 'City');
      const d = days;
      highlights = Array.from({ length: d }).map((_, i) => ({
        day: i + 1,
        label: i === 0 ? `Arrive in ${baseCity}` : i === d - 1 ? `Farewell ${baseCity}` : `Explore ${baseCity}`,
        details: i === 0 ? `Check-in and gentle walk near the center.` : i === d - 1 ? `Brunch and souvenirs.` : `Museums, old town and local food.`
      }));
    }
    await apiRequest(`/trips/${tripId}/itinerary`, 'POST', { highlights });
    try { await apiRequest(`/trips/${tripId}/geocode-highlights`, 'POST'); } catch { }
    toast('Itinerary saved');
    loadTrips();
  } catch (e) {
    toast('Magic Plan failed', 'error');
  }
};

// --- Map View ---

window.openComposer = openComposer;
window.openEditProfile = openEditProfile;
window.closeEditProfile = closeEditProfile;

window.deleteCurrentStory = async function () {
  if (!state.storySession) return;
  const group = state.stories.find(g => g.user._id === state.storySession.groupId);
  if (!group) return;
  const story = group.stories[state.storySession.index];
  if (!story) return;

  if (!confirm('Delete this story?')) return;

  try {
    await apiRequest(`/stories/${story._id}`, 'DELETE');
    toast('Story deleted');
    closeStoryViewer();
    loadStories();
  } catch (e) {
    toast(e.message || 'Failed to delete story', 'error');
  }
};

window.deletePost = async function (postId) {
  if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

  // INSTANT: Remove from DOM immediately for instant feedback
  const postCards = document.querySelectorAll(`.post-card[data-post-id="${postId}"]`);
  const removedElements = [];
  postCards.forEach(card => {
    removedElements.push({ element: card, parent: card.parentElement, nextSibling: card.nextSibling });
    card.style.transition = 'opacity 0.15s, transform 0.15s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => card.remove(), 150);
  });

  // Remove from cache immediately
  if (state.feedCache) {
    state.feedCache = state.feedCache.filter(p => p._id !== postId && p._id?.toString() !== postId.toString());
  }

  toast('Post deleted');

  // Send request in background
  try {
    await apiRequest(`/posts/${postId}`, 'DELETE');
  } catch (e) {
    // Revert on error - restore elements
    removedElements.forEach(({ element, parent, nextSibling }) => {
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
      if (parent) {
        if (nextSibling && nextSibling.parentElement === parent) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      }
    });
    toast(e.message || 'Failed to delete post', 'error');
    // Reload to restore cache
    if (state.view === 'home') {
      await loadFeed();
    } else if (state.view === 'profile') {
      await loadProfile(state.profileId);
    }
  }
};

// Track login attempts to prevent rapid-fire requests
let loginAttempts = {
  count: 0,
  lastAttempt: 0,
  cooldownUntil: 0
};

async function handleAuth(e, endpoint) {
  e.preventDefault();

  // Prevent multiple simultaneous requests
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn && submitBtn.disabled) {
    return; // Already processing
  }

  // Check cooldown period
  const now = Date.now();
  if (loginAttempts.cooldownUntil > now) {
    const waitSeconds = Math.ceil((loginAttempts.cooldownUntil - now) / 1000);
    toast(`Please wait ${waitSeconds} second${waitSeconds > 1 ? 's' : ''} before trying again`, 'error');
    return;
  }

  // Prevent rapid-fire attempts
  if (now - loginAttempts.lastAttempt < 1000) {
    toast('Please wait a moment before trying again', 'error');
    return;
  }

  loginAttempts.lastAttempt = now;

  // Disable submit button
  if (submitBtn) {
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing...';
    submitBtn.style.opacity = '0.6';
  }

  const formData = new FormData(form);
  let body = Object.fromEntries(formData);

  // Handle register endpoint - map form fields
  if (endpoint === '/auth/register') {
    body = {
      username: body.username,
      email: body.email,
      password: body.password,
      fullName: body.fullName
    };
  }

  try {
    const res = await apiRequest(endpoint, 'POST', body);
    // Reset login attempts on success
    loginAttempts = { count: 0, lastAttempt: 0, cooldownUntil: 0 };

    if (res.token && res.user) {
      establishSession(res);
    } else if (res.message) {
      toast(res.message, 'success');
      // If it's register, switch to login tab after 1.5s
      if (endpoint === '/auth/register') {
        setTimeout(() => {
          const signinTab = document.querySelector('[data-auth-tab="signin"]');
          if (signinTab) signinTab.click();
        }, 1500);
      }
    }
  } catch (err) {
    loginAttempts.count++;

    // Handle rate limiting specifically
    if (err.message.includes('Too many requests') || err.message.includes('429')) {
      // Set cooldown period (30 seconds)
      loginAttempts.cooldownUntil = now + 30000;
      toast('Too many login attempts. Please wait 30 seconds before trying again.', 'error');
    } else {
      toast(err.message || 'Authentication failed', 'error');
    }

    // If multiple failures, increase cooldown
    if (loginAttempts.count >= 3) {
      loginAttempts.cooldownUntil = now + 60000; // 1 minute cooldown
    }
  } finally {
    // Re-enable submit button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.textContent.includes('Processing') ?
        (endpoint === '/auth/register' ? 'Create Account' : 'Login') : submitBtn.textContent;
      submitBtn.style.opacity = '1';
    }
  }
}

function establishSession(res) {
  if (!res || !res.token) {
    throw new Error('Invalid auth response');
  }
  state.token = res.token;
  state.user = res.user || res;
  localStorage.setItem('authToken', res.token);
  // Persist token scoped to current API base
  saveTokenForBase(API_URL, res.token);
  const username = res.user?.username || res.username || 'Creator';
  toast(`Welcome ${username}!`);
  initApp();
}

async function requestOtpCode() {
  const input = document.querySelector('#formOtp [name="email"]');
  if (!input) return;
  const email = input.value.trim();
  if (!email) return toast('Enter email address', 'error');

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return toast('Please enter a valid email address', 'error');
  }

  try {
    const res = await apiRequest('/auth/request-otp', 'POST', { email, purpose: 'login' });
    if (res.emailConfigured === false) {
      toast('Email not configured. Check server console for OTP code.', 'error');
      console.log('📧 OTP code should be visible in server console');
    } else {
      toast('OTP sent. Check your inbox (and spam folder).');
    }
    const firstSlot = document.querySelector('.otp-inputs input');
    if (firstSlot) firstSlot.focus();
  } catch (err) {
    toast(err.message || 'Failed to request OTP', 'error');
    console.error('OTP request error:', err);
  }
}

async function handleOtpLogin(e) {
  e.preventDefault();
  const emailInput = document.querySelector('#formOtp [name="email"]');
  const email = emailInput ? emailInput.value.trim() : '';
  const digits = Array.from(document.querySelectorAll('.otp-inputs input'))
    .map(input => input.value.trim())
    .join('');
  if (!email || digits.length < 6) {
    toast('Enter email and 6-digit OTP code.', 'error');
    return;
  }
  try {
    const res = await apiRequest('/auth/login-otp', 'POST', { email, code: digits });
    establishSession(res);
  } catch (err) {
    toast(err.message || 'OTP verification failed', 'error');
  }
}

function openEditProfile() {
  if (!state.profileDraft) return;
  const modal = document.getElementById('editProfileModal');
  const form = document.getElementById('editProfileForm');
  if (!modal || !form) return;
  form.displayName.value = state.profileDraft.fullName || state.profileDraft.username || '';
  form.handle.value = `@${state.profileDraft.username || ''}`;
  form.bio.value = state.profileDraft.bio || '';
  form.currentPassword.value = '';
  form.newPassword.value = '';
  state.profileAvatarData = null;
  setEditAvatarPreview(state.profileDraft.avatar || state.profileDraft.profilePicture || '');
  modal.classList.remove('hidden');
}

function closeEditProfile() {
  const modal = document.getElementById('editProfileModal');
  if (!modal) return;
  modal.classList.add('hidden');
  setEditAvatarPreview(state.profileDraft?.avatar || state.profileDraft?.profilePicture || '');
}

function setEditAvatarPreview(src) {
  const preview = document.getElementById('editAvatarPreview');
  if (!preview) return;
  if (src) {
    preview.style.backgroundImage = `url('${src}')`;
    preview.classList.add('has-image');
    preview.textContent = '';
  } else {
    preview.style.backgroundImage = '';
    preview.classList.remove('has-image');
    preview.textContent = '+';
  }
}

function handleEditAvatar(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_UPLOAD_BYTES) {
    toast('Image too large. Max 6MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.profileAvatarData = reader.result;
    setEditAvatarPreview(reader.result);
  };
  reader.readAsDataURL(file);
}

async function submitProfileEdit(e) {
  e.preventDefault();
  if (!state.profileDraft) return;
  const form = e.target;
  // Map form fields to API expected keys
  const payload = {
    fullName: form.displayName.value.trim(),
    username: form.handle.value.trim().replace(/^@/, ''),
    bio: form.bio.value.trim()
  };
  payload.username = payload.username || state.profileDraft.username;
  if (state.profileAvatarData) payload.profilePicture = state.profileAvatarData;

  const currentPassword = form.currentPassword.value.trim();
  const newPassword = form.newPassword.value.trim();

  try {
    // Close modal and show toast immediately
    closeEditProfile();
    toast('Profile updated');

    // Update profile fields in background
    const updatedUser = await apiRequest('/users/profile', 'PUT', payload);

    // If passwords provided, call password endpoint separately
    if (currentPassword && newPassword) {
      try {
        await apiRequest('/users/password', 'PUT', { currentPassword, newPassword });
        toast('Password updated');
      } catch (pwErr) {
        toast(pwErr.message || 'Failed to update password', 'error');
      }
    }

    // Update local state and UI
    state.user = updatedUser || state.user;
    loadProfile(state.user._id);
    refreshPrimaryAvatars();
  } catch (err) {
    toast(err.message || 'Failed to update profile', 'error');
  }
}

// Enhanced request system with caching and deduplication
const pendingRequests = new Map();
const perfCache = window.FrontendPerformance?.cache;
const perfMon = window.FrontendPerformance?.monitor;

async function apiRequest(url, method, body, retries = 0) {
  const startTime = Date.now();
  
  // For GET requests, try cache first
  if (method === 'GET' && perfCache) {
    const cacheKey = `api:${url}`;
    const cached = perfCache.get(cacheKey);
    
    if (cached) {
      if (perfMon) perfMon.recordCacheHit();
      console.log(`[Cache HIT] ${url}`);
      return cached;
    }
    
    if (perfMon) perfMon.recordCacheMiss();
    
    // Deduplicate concurrent requests
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    // Create new request promise
    const requestPromise = _executeApiRequest(url, method, body, retries)
      .then(data => {
        // Aggressive caching: 10s for feeds (server-side cached), 30s for single items
        const ttl = url.includes('/posts?') || url.includes('/user/') ? 10000 : 30000;
        perfCache.set(cacheKey, data, ttl);
        
        if (perfMon) perfMon.recordAPICall(Date.now() - startTime);
        return data;
      });
    
    pendingRequests.set(cacheKey, requestPromise);
    
    requestPromise.finally(() => {
      setTimeout(() => pendingRequests.delete(cacheKey), 100);
    });
    
    return requestPromise;
  }

  // For non-GET requests, clear relevant caches
  if (method !== 'GET' && perfCache) {
    if (url.includes('/posts')) {
      perfCache.clearPattern('api:/posts');
    } else if (url.includes('/users')) {
      perfCache.clearPattern('api:/users');
    }
  }

  const data = await _executeApiRequest(url, method, body, retries);
  if (perfMon) perfMon.recordAPICall(Date.now() - startTime);
  return data;
}

async function _executeApiRequest(url, method, body, retries = 0) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
  } catch (networkError) {
    console.error('API network error:', networkError);
    // Check if it's a DNS/connection error
    if (networkError.message.includes('Failed to fetch') || networkError.message.includes('ERR_NAME_NOT_RESOLVED')) {
      const alt = API_URL.includes(':5001') ? API_URL.replace(':5001', ':5000') : (API_URL.includes(':5000') ? API_URL.replace(':5000', ':5001') : null);
      if (alt) {
        try {
          res = await fetch(`${alt}${url}`, { method, headers, body: body ? JSON.stringify(body) : null });
          API_URL = alt;
          // Reload token for new base; avoid sending stale tokens across servers
          state.token = loadTokenForBase(API_URL) || null;
        } catch (e2) {
          // Try same-origin '/api' as final fallback
          const originApi = `${window.location.origin}/api`;
          if (originApi !== API_URL && originApi !== alt) {
            try {
              res = await fetch(`${originApi}${url}`, { method, headers, body: body ? JSON.stringify(body) : null });
              API_URL = originApi;
              state.token = loadTokenForBase(API_URL) || null;
            } catch (e3) {
              throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
            }
          } else {
            throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
          }
        }
      } else {
        throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      }
    } else {
      throw new Error('Unable to reach SocioSphere servers. Please check your connection or backend status.');
    }
  }

  if (!res) {
    throw new Error('Unable to reach SocioSphere servers. Please check your connection or backend status.');
  }

  let data;
  const contentType = res.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { message: text } : {};
    }
    try { localStorage.setItem('api_base', API_URL); } catch (_) { }
  } catch (parseError) {
    console.error('Response parse error:', parseError);
    throw new Error('Invalid response from server');
  }

  // Handle rate limiting (429)
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') || res.headers.get('X-RateLimit-Reset');
    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, retries), 30000);

    if (retries < 2) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return apiRequest(url, method, body, retries + 1);
    }

    const errorMsg = data.message || `Too many requests. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`;
    throw new Error(errorMsg);
  }

  // Handle unauthorized: clear token and surface a friendly message
  if (res.status === 401) {
    try { localStorage.removeItem('authToken'); } catch (_) { }
    // Also clear base-scoped token
    clearTokenForBase(API_URL);
    try { localStorage.removeItem('currentUserId'); } catch (_) { }
    state.token = null;
    state.user = null;
    if (perfCache) perfCache.clearPattern('api:');
    const errorMsg = data.message || 'Token is not valid. Please log in again.';
    throw new Error(errorMsg);
  }

  if (!res.ok) {
    const errorMsg = data.message || data.error || data.reason || `Request failed (${res.status})`;
    throw new Error(errorMsg);
  }
  return data;
}

function fetchUser() {
  return apiRequest('/users/me', 'GET').then(u => {
    state.user = u;
    rememberCurrentUserId(u?._id);
    return u;
  });
}

function showAuth() {
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('authShell').classList.remove('hidden');
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav) mobileNav.classList.add('hidden');
  const fab = document.getElementById('composeFab');
  if (fab) fab.classList.add('hidden');
  // Hide AI FAB and ensure AI modal is closed on login page
  const aiFab = document.getElementById('aiFab');
  if (aiFab) aiFab.classList.add('hidden');
  const aiModal = document.getElementById('hfAiModal');
  if (aiModal) aiModal.classList.add('hidden');
  setLiveStatus(false);
  if (state.tickerInterval) {
    clearInterval(state.tickerInterval);
    state.tickerInterval = null;
  }
}

function logout() {
  localStorage.removeItem('authToken');
  clearTokenForBase(API_URL);
  try { localStorage.removeItem('currentUserId'); } catch (_) { }
  state.token = null;
  state.user = null;
  if (state.socket) state.socket.disconnect();
  showAuth();
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast-notification ${type}`;
  
  const iconClass = type === 'error' ? 'fa-circle-xmark' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-check-circle';
  
  el.innerHTML = `
    <i class="fas ${iconClass} toast-icon"></i>
    <span class="toast-message">${escapeHtml(msg)}</span>
    <button class="toast-close" aria-label="Close notification">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  el.querySelector('.toast-close').addEventListener('click', () => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });

  container.appendChild(el);
  
  // Auto-remove after 4 seconds
  const timeout = setTimeout(() => {
    if (el && el.parentElement) {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    }
  }, 4000);
  
  el.addEventListener('mouseenter', () => clearTimeout(timeout));
}

function toastWithAction(msg, actionLabel, actionCallback, duration = 5000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const el = document.createElement('div');
  el.className = 'toast-notification success';
  
  el.innerHTML = `
    <i class="fas fa-check-circle toast-icon"></i>
    <span class="toast-message">${escapeHtml(msg)}</span>
  `;
  
  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn ghost-icon';
  actionBtn.style.cssText = 'font-size: 0.85rem; padding: 6px 12px; margin-left: 8px;';
  actionBtn.textContent = actionLabel;
  actionBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await actionCallback();
    } catch (err) {
      console.warn('Action callback error', err);
    }
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  
  el.appendChild(actionBtn);
  container.appendChild(el);

  const timeout = setTimeout(() => {
    if (el && el.parentElement) {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    }
  }, duration);
  
  el.addEventListener('mouseenter', () => clearTimeout(timeout));
}

function connectSocket() {
  if (!window.io || !state.token) return;
  state.socket = io(API_URL.replace('/api', ''), {
    auth: { token: state.token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    timeout: 10000,
    withCredentials: true,
    path: '/socket.io'
  });

  state.socket.on('connect', () => {
    setLiveStatus(true);
    try {
      if (state.user?._id) {
        state.socket.emit('user-online', state.user._id);
        state.socket.emit('join-room', state.user._id);
      }
    } catch (e) { }
  });
  state.socket.on('disconnect', () => {
    setLiveStatus(false);
    try { resetCallState(); } catch (e) { }
  });

  state.socket.on('receive-message', (msg) => {
    const senderId = (msg.sender?._id || msg.sender || '').toString();
    const currentChatId = (state.activeChatId || '').toString();
    // Update active thread in real-time
    if (currentChatId && currentChatId === senderId) {
      const area = document.getElementById('msgArea');
      if (area) {
        const msgEl = document.createElement('div');
        msgEl.className = 'msg theirs';
        const content = msg.content || '';
        const hasMedia = msg.mediaUrl || (msg.messageType && msg.messageType !== 'text');
        let mediaHtml = '';
        if (hasMedia && msg.mediaUrl) {
          if (msg.messageType === 'image') {
            mediaHtml = `<img src="${msg.mediaUrl}" style="max-width:100%; max-height:300px; border-radius:12px; margin-bottom:8px; object-fit:contain;" alt="Shared image" onerror="this.style.display='none';">`;
          } else if (msg.messageType === 'video') {
            mediaHtml = `<video src="${msg.mediaUrl}" controls style="max-width:100%; max-height:300px; border-radius:12px; margin-bottom:8px;" alt="Shared video"></video>`;
          } else {
            const fileName = content || 'File';
            mediaHtml = `<div style="padding:12px; background:var(--bg-card); border-radius:8px; margin-bottom:8px; display:flex; align-items:center; gap:10px;"><i class="fas fa-file" style="font-size:1.5rem;"></i><span>${escapeHtml(fileName)}</span></div>`;
          }
        }
        const sharedPostId = (!hasMedia) ? extractSharedPostId(content) : '';
        const textHtml = (!hasMedia || msg.messageType === 'text') ? `<div class="msg-content">${escapeHtml(content.replace(/https?:\/\/[^\s]+/g, '').trim())}</div>` : '';
        const actionHtml = sharedPostId ? `<div style="margin-top:8px;"><button class="btn secondary" data-open-post="${sharedPostId}"><i class="fas fa-external-link-alt"></i> Open Post</button></div>` : '';
        msgEl.innerHTML = `${mediaHtml}${textHtml}${actionHtml}<small class="msg-time">just now</small>`;
        area.appendChild(msgEl);
        requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
        try { msgEl.querySelectorAll('button[data-open-post]').forEach(btn => btn.addEventListener('click', () => openPostPreview(btn.dataset.openPost))); } catch (_) { }
        updateChatSubline('Last message just now');
      }
    }
    // Update thread list snippet/time and move to top
    const list = document.getElementById('chatList');
    if (list && senderId) {
      const item = list.querySelector(`.chat-item[data-id="${senderId}"]`);
      if (item) {
        const snippetEl = item.querySelector('div:nth-child(2) > div:nth-child(2)');
        const timeEl = item.querySelector('div:nth-child(2) > div:nth-child(1) small');
        if (snippetEl) snippetEl.textContent = msg.content || (msg.mediaUrl ? 'Shared a file' : '');
        if (timeEl) timeEl.textContent = 'just now';
        list.prepend(item);
      }
    }
  });

  state.socket.on('new-notification', () => {
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'block';
    toast('New activity');
  });

  registerCallSocketEvents();
}

async function resolveDeeplinkPost() {
  try {
    const params = new URLSearchParams(window.location.search);
    let postId = params.get('post');
    if (!postId && state.pendingPostId) postId = state.pendingPostId;
    if (!postId) {
      const path = window.location.pathname || '';
      const match = path.match(/\/posts\/([a-f0-9]{24})/i);
      if (match && match[1]) postId = match[1];
    }
    if (!postId) return;
    const post = await apiRequest(`/posts/${postId}`, 'GET');
    const exists = Array.isArray(state.feedCache) && state.feedCache.some(p => (p._id?.toString() || p._id) === postId.toString());
    if (!exists) state.feedCache.unshift(post);
    navigate('home');
    refreshFeedView();
    requestAnimationFrame(() => {
      const el = document.querySelector(`.post-card[data-post-id="${postId}"]`);
      if (el) {
        el.classList.add('ring');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { el.classList.remove('ring'); }, 1500);
      }
    });
    const url = new URL(window.location.href);
    url.searchParams.delete('post');
    if (url.pathname.startsWith('/posts/')) url.pathname = '/';
    window.history.replaceState({}, document.title, url.toString());
  } catch (e) {
    toast('Post not available', 'error');
  }
}

async function refreshUnreadNotifications() {
  try {
    const badge = document.getElementById('notifBadge');
    const res = await apiRequest('/notifications/unread/count', 'GET');
    if (badge) badge.style.display = (res?.count || 0) > 0 ? 'block' : 'none';
  } catch (e) { }
}

function initMobileNav() {
  const nav = document.getElementById('mobileNav');
  if (!nav) return;
  const buttons = nav.querySelectorAll('.mobile-nav-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.target) navigate(btn.dataset.target);
    });
  });
  const syncNav = () => {
    const authVisible = !document.getElementById('authShell')?.classList.contains('hidden');
    if (authVisible) {
      nav.classList.add('hidden');
      return;
    }
    if (window.innerWidth <= 920) {
      nav.classList.remove('hidden');
    } else {
      nav.classList.add('hidden');
    }
  };
  syncNav();
  window.addEventListener('resize', debounce(syncNav, 200));
}

function syncMobileNavActive(target) {
  const nav = document.getElementById('mobileNav');
  if (!nav) return;
  nav.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === target);
  });
}

// Inline CSS Animation injection
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
`;
document.head.appendChild(styleSheet);
// --- Translator ---
let translatorState = {
  targetLang: 'en',
  targetLabel: 'English',
  recognition: null
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'te-Latn', label: 'Telugu (Latin)' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese' }
];

function openTranslator() {
  const modal = document.getElementById('translatorModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  initTranslator();
}

function closeTranslator() {
  const modal = document.getElementById('translatorModal');
  if (!modal) return;
  modal.classList.add('hidden');
  stopVoiceInput();
}

function initTranslator() {
  const closeBtn = document.getElementById('translatorClose');
  if (closeBtn) closeBtn.addEventListener('click', closeTranslator);
  const listEl = document.getElementById('translatorLangList');
  const searchEl = document.getElementById('translatorLangSearch');
  const micBtn = document.getElementById('translatorMicBtn');
  const speakBtn = document.getElementById('translatorSpeakBtn');
  const translateBtn = document.getElementById('translatorTranslateBtn');
  const swapBtn = document.getElementById('translatorSwapBtn');
  const inputEl = document.getElementById('translatorInput');
  const outputEl = document.getElementById('translatorOutput');

  function renderLangs(filter = '') {
    const q = filter.trim().toLowerCase();
    const items = LANGUAGES.filter(l => l.label.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
    listEl.innerHTML = items.map(l => `
      <div class="search-result-item" data-code="${l.code}" data-label="${l.label}">
        <i class="fas fa-language"></i>
        <div>
          <strong>${l.label}</strong>
          <small style="display:block; color:var(--text-muted);">${l.code}</small>
        </div>
      </div>
    `).join('');
    listEl.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        translatorState.targetLang = item.dataset.code;
        translatorState.targetLabel = item.dataset.label;
        searchEl.value = translatorState.targetLabel;
        listEl.classList.add('hidden');
        toast(`Language: ${translatorState.targetLabel}`);
      });
    });
  }
  renderLangs('');
  searchEl?.addEventListener('input', (e) => {
    renderLangs(e.target.value);
    listEl.classList.toggle('hidden', !(e.target.value?.length >= 1));
  });
  searchEl?.addEventListener('focus', () => {
    if (searchEl.value.length >= 1) listEl.classList.remove('hidden');
  });
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('translatorModal');
    if (wrapper && !wrapper.contains(e.target)) return; // ignore clicks outside modal entirely
    const field = searchEl.closest('.input-field');
    if (field && !field.contains(e.target)) listEl.classList.add('hidden');
  });

  micBtn?.addEventListener('click', () => {
    if (translatorState.recognition) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  });

  speakBtn?.addEventListener('click', () => {
    const text = outputEl?.value?.trim();
    if (text) speak(text, translatorState.targetLang);
  });

  swapBtn?.addEventListener('click', () => {
    const text = outputEl.value;
    outputEl.value = inputEl.value;
    inputEl.value = text;
  });

  translateBtn?.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if (!text) return toast('Type or speak something first', 'error');
    const translated = await translateText(text, translatorState.targetLabel);
    outputEl.value = translated || '';
  });
}

async function translateText(text, targetLabel) {
  try {
    const prompt = `Translate to ${targetLabel}. Only output the translation.\nText: "${text}"`;
    const res = await apiRequest('/hf/text', 'POST', { prompt, maxTokens: 180, temperature: 0.2 });
    return (res && res.text) ? res.text.trim() : '';
  } catch (e) {
    console.warn('Translate error', e);
    return '';
  }
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast('Voice input not supported in this browser', 'error');
    return;
  }
  const rec = new SpeechRecognition();
  rec.lang = (state.user?.locale || 'en-US');
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = async (event) => {
    const inputEl = document.getElementById('translatorInput');
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript + ' ';
      }
    }
    if (finalText) {
      inputEl.value = (inputEl.value + ' ' + finalText).trim();
    }
  };
  rec.onend = () => { translatorState.recognition = null; };
  rec.onerror = () => { translatorState.recognition = null; };
  rec.start();
  translatorState.recognition = rec;
  toast('Listening…');
}

function stopVoiceInput() {
  if (translatorState.recognition) {
    try { translatorState.recognition.stop(); } catch (_) { }
    translatorState.recognition = null;
    toast('Stopped');
  }
}

function speak(text, langCode = 'en') {
  try {
    const utter = new SpeechSynthesisUtterance(text);
    const locale = mapLangToLocale(langCode);
    ensureVoicesReady().then((voices) => {
      const match = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(locale.toLowerCase()));
      if (match) utter.voice = match;
      utter.lang = match ? match.lang : locale;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
  } catch (e) { }
}

function ensureVoicesReady() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) return resolve(voices);
    const handler = () => {
      const v = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = null;
      resolve(v);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // Fallback timeout
    setTimeout(handler, 800);
  });
}

function mapLangToLocale(code = 'en') {
  const map = {
    en: 'en-US', hi: 'hi-IN', te: 'te-IN', 'te-latn': 'te-IN', ta: 'ta-IN', ml: 'ml-IN', kn: 'kn-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN', ur: 'ur-PK', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', zh: 'zh-CN'
  };
  const key = (code || '').toLowerCase();
  return map[key] || 'en-US';
}

// --- Trip Dashboard ---
window.openTripDashboard = async (tripId) => {
  state.currentTripId = tripId;
  const modal = document.getElementById('tripDashboardModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // Reset UI
  document.getElementById('dashWeather').innerHTML = 'Loading weather...';
  document.getElementById('dashDetails').innerHTML = 'Loading details...';
  document.getElementById('dashPollsList').innerHTML = '';
  document.getElementById('dashAlbumGrid').innerHTML = '';
  document.getElementById('dashChatMessages').innerHTML = '';

  try {
    const trip = await apiRequest(`/trips/${tripId}`, 'GET');
    document.getElementById('tripDashTitle').textContent = trip.title || 'Trip Dashboard';
    
    // Details
    const start = trip.startDate ? new Date(trip.startDate).toLocaleDateString() : 'TBD';
    const end = trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'TBD';
    document.getElementById('dashDetails').innerHTML = `
      <strong>Destination:</strong> ${trip.destination?.city || ''}, ${trip.destination?.country || ''}<br>
      <strong>Dates:</strong> ${start} - ${end}<br>
      <strong>Host:</strong> ${trip.host?.username || 'Unknown'}<br>
      <strong>Members:</strong> ${trip.participants?.length || 0}
    `;

    // Load initial tab data
    loadTripWeather(trip.destination?.city);
    loadTripPolls(tripId);
    loadTripAlbum(tripId);
    loadTripChat(tripId);

    // Close handler
    document.getElementById('closeTripDash').onclick = () => modal.classList.add('hidden');

  } catch (e) {
    toast('Failed to load dashboard', 'error');
  }
};

window.switchDashTab = async (tabName) => {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dash-tab-content').forEach(c => c.classList.add('hidden'));
  
  const btn = document.querySelector(`.dash-tab[onclick="switchDashTab('${tabName}')"]`);
  if (btn) btn.classList.add('active');
  
  const content = document.getElementById(`dash${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (content) content.classList.remove('hidden');
  
  // Load data for the selected tab
  if (state.currentTripId) {
    if (tabName === 'polls') {
      loadTripPolls(state.currentTripId);
    } else if (tabName === 'album') {
      loadTripAlbum(state.currentTripId);
    } else if (tabName === 'chat') {
      loadTripChat(state.currentTripId);
    }
  }
};

async function loadTripWeather(city) {
  if (!city) return;
  try {
    // Mock weather data for demo
    const weather = [
      { day: 'Mon', icon: 'sun', temp: '24°' },
      { day: 'Tue', icon: 'cloud-sun', temp: '22°' },
      { day: 'Wed', icon: 'cloud', temp: '19°' },
      { day: 'Thu', icon: 'cloud-rain', temp: '18°' },
      { day: 'Fri', icon: 'sun', temp: '25°' }
    ];
    
    const container = document.getElementById('dashWeather');
    container.innerHTML = weather.map(w => `
      <div class="weather-day">
        <span style="font-size:0.9rem; color:var(--text-muted);">${w.day}</span>
        <i class="fas fa-${w.icon}" style="font-size:1.5rem; margin:8px 0; color:var(--primary);"></i>
        <span style="font-weight:bold;">${w.temp}</span>
      </div>
    `).join('');
  } catch (e) {
    console.error('Weather load error', e);
  }
}

async function loadTripPolls(tripId) {
  try {
    const polls = await apiRequest(`/trips/${tripId}/polls`, 'GET');
    const container = document.getElementById('dashPollsList');
    if (!polls || !polls.length) {
      container.innerHTML = '<div class="empty-state">No polls active</div>';
      return;
    }
    container.innerHTML = polls.map(p => `
      <div class="card" style="border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between;">
          <h4>${escapeHtml(p.question)}</h4>
          <small class="status-badge ${p.status}">${p.status}</small>
        </div>
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
          ${p.options.map(opt => `
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="flex:1; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; position:relative; overflow:hidden;">
                <div style="position:absolute; left:0; top:0; bottom:0; width:${opt.votes?.length ? (opt.votes.length / p.totalVotes * 100) : 0}%; background:rgba(29,155,240,0.1);"></div>
                <span style="position:relative; z-index:1;">${escapeHtml(opt.text)}</span>
              </div>
              <span style="font-size:0.9rem; color:var(--text-muted);">${opt.votes?.length || 0}</span>
              <button class="btn ghost-icon" onclick="votePoll('${tripId}', '${p._id}', '${opt._id}')">
                <i class="far fa-check-circle"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Polls load error', e);
  }
}

window.openCreatePollModal = () => {
  document.getElementById('createPollModal').classList.remove('hidden');
  document.getElementById('pollQuestion').value = '';
  document.getElementById('pollOptionsList').innerHTML = `
    <input type="text" class="input poll-option" placeholder="Option 1" style="margin-bottom:8px;">
    <input type="text" class="input poll-option" placeholder="Option 2" style="margin-bottom:8px;">
  `;
};

window.addPollOption = () => {
  const div = document.createElement('input');
  div.type = 'text';
  div.className = 'input poll-option';
  div.placeholder = `Option ${document.querySelectorAll('.poll-option').length + 1}`;
  div.style.marginBottom = '8px';
  document.getElementById('pollOptionsList').appendChild(div);
};

window.votePoll = async (tripId, pollId, optionId) => {
  try {
    // Check if this is a double click
    const now = Date.now();
    const lastClick = window.lastPollClick || {};
    const clickKey = `${tripId}-${pollId}-${optionId}`;
    
    if (lastClick[clickKey] && (now - lastClick[clickKey]) < 300) {
      // Double click - clear the response
      await apiRequest(`/trips/${tripId}/polls/${pollId}/vote`, 'POST', { optionId, clear: true });
      toast('Vote cleared');
    } else {
      // Single click - vote
      await apiRequest(`/trips/${tripId}/polls/${pollId}/vote`, 'POST', { optionId });
      toast('Vote recorded');
    }
    
    lastClick[clickKey] = now;
    window.lastPollClick = lastClick;
    loadTripPolls(tripId);
  } catch (e) {
    toast('Failed to vote', 'error');
  }
};

window.submitPoll = async () => {
  const question = document.getElementById('pollQuestion').value.trim();
  const options = Array.from(document.querySelectorAll('.poll-option'))
    .map(i => i.value.trim())
    .filter(v => v);
    
  if (!question || options.length < 2) return toast('Question and at least 2 options required', 'error');
  
  try {
    // Close modal and show toast immediately
    document.getElementById('createPollModal').classList.add('hidden');
    toast('Poll created');

    // Create poll in background
    await apiRequest(`/trips/${state.currentTripId}/polls`, 'POST', { question, options });
    loadTripPolls(state.currentTripId);
  } catch (e) {
    toast('Failed to create poll', 'error');
  }
};

async function loadTripAlbum(tripId) {
  try {
    const media = await apiRequest(`/trips/${tripId}/media`, 'GET');
    const grid = document.getElementById('dashAlbumGrid');
    if (!media || !media.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No memories shared yet</div>';
      return;
    }
    grid.innerHTML = media.map(m => `
      <div style="aspect-ratio:1; border-radius:12px; overflow:hidden; position:relative; cursor:pointer;">
        ${m.type === 'video' 
          ? `<video src="${m.url}" style="width:100%; height:100%; object-fit:cover;"></video>`
          : `<img src="${m.url}" style="width:100%; height:100%; object-fit:cover;">`
        }
      </div>
    `).join('');
  } catch (e) {
    console.error('Album load error', e);
  }
}

window.uploadAlbumMedia = async (input) => {
  const file = input.files?.[0];
  if (!file) return;
  
  // In a real app, upload to server/cloud
  // For demo, we'll use FileReader
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await apiRequest(`/trips/${state.currentTripId}/media`, 'POST', {
        url: reader.result,
        type: file.type.startsWith('video') ? 'video' : 'image'
      });
      toast('Uploaded to album');
      loadTripAlbum(state.currentTripId);
    } catch (e) {
      toast('Upload failed', 'error');
    }
  };
  reader.readAsDataURL(file);
};

async function loadTripChat(tripId) {
  try {
    const messages = await apiRequest(`/trips/${tripId}/chat`, 'GET');
    const container = document.getElementById('dashChatMessages');
    container.innerHTML = messages.map(m => `
      <div class="msg ${m.sender._id === state.user._id ? 'mine' : 'theirs'}">
        <div class="msg-content">
          <small style="display:block; opacity:0.7; margin-bottom:4px;">${escapeHtml(m.sender.username)}</small>
          ${escapeHtml(m.content)}
        </div>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    console.error('Chat load error', e);
  }
}

window.sendTripMessage = async () => {
  const input = document.getElementById('dashChatInput');
  const content = input.value.trim();
  if (!content) return;
  
  try {
    await apiRequest(`/trips/${state.currentTripId}/chat`, 'POST', { content });
    input.value = '';
    loadTripChat(state.currentTripId);
  } catch (e) {
    toast('Failed to send', 'error');
  }
};
