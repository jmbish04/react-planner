/**
 * Container Server for React Planner
 * Runs a headless browser with the planner and exposes an API for command execution
 */

const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());

let browser = null;
let page = null;
let isReady = false;

// Valid item types from the react-planner catalog
const VALID_ITEM_TYPES = [
  'sofa', 'chair', 'table', 'desk', 'bed', 'bookcase', 'wardrobe', 'fridge',
  'sink', 'tv', 'kitchen', 'balcony', 'column', 'column-square', 'cube',
  'armchairs', 'bench', 'blackboard', 'camera', 'canteen-table', 'canteencart',
  'chairdesk', 'child-chair-desk', 'cleaningcart', 'coat-hook', 'deskdouble',
  'deskoffice', 'electrical-panel', 'fire-extinguisher', 'hanger', 'hiroos',
  'hub', 'image', 'lim', 'metal-detector', 'monitor-pc', 'naspo', 'projector',
  'radiator-modern-style', 'radiator-old-style', 'recycling-bins', 'router-wifi',
  'schneider', 'school-desk-double', 'school-desk', 'simple-stair', 'smoke-detector',
  'teaching-post', 'text-3d', 'three-phase-panel', 'trash', 'umbrella-stand',
  'air-conditioner'
];

// Authentication middleware for sensitive endpoints
function requireAuth(req, res, next) {
  const apiKey = process.env.WORKER_API_KEY;

  // If no WORKER_API_KEY is set, allow requests (development mode only)
  // Production mode enforces WORKER_API_KEY at server startup
  if (!apiKey) {
    console.warn('Warning: No WORKER_API_KEY set. Authentication bypassed for development.');
    return next();
  }

  // Validate Bearer token
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header. Use: Authorization: Bearer <api-key>'
    });
  }

  const token = authHeader.substring(7);

  // Constant-time comparison to prevent timing attacks
  const providedHash = crypto.createHash('sha256').update(token).digest('hex');
  const validHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  if (providedHash !== validHash) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  next();
}

// Validation helper for item types
function validateItemType(itemType) {
  if (!itemType) {
    return { valid: false, error: 'itemType is required' };
  }

  if (typeof itemType !== 'string') {
    return { valid: false, error: 'itemType must be a string' };
  }

  const normalizedType = itemType.toLowerCase().trim();

  if (!VALID_ITEM_TYPES.includes(normalizedType)) {
    return {
      valid: false,
      error: `Invalid itemType: "${itemType}". Must be one of: ${VALID_ITEM_TYPES.join(', ')}`
    };
  }

  return { valid: true, normalizedType };
}

// Initialize headless browser with react-planner
async function initBrowser() {
  console.log('Initializing headless browser...');

  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Serve planner files statically
  const plannerPath = path.join(__dirname, 'planner-dist', 'index.html');
  await page.goto(`file://${plannerPath}`, { waitUntil: 'networkidle0' });

  // Wait for React to mount
  await page.waitForSelector('#app', { timeout: 10000 });

  // Expose helper function to dispatch Redux actions
  await page.exposeFunction('serverLog', (message) => {
    console.log('[Browser]', message);
  });

  // Wait a bit more for full initialization
  await page.waitForFunction(() => window.__PLANNER_API__, { timeout: 5000 });

  // Inject store exposer script
  const fs = require('fs');
  const storeExposerScript = fs.readFileSync(
    path.join(__dirname, 'store-exposer.js'),
    'utf8'
  );
  await page.evaluateOnNewDocument(storeExposerScript);
  await page.evaluate(storeExposerScript);

  // Verify store is accessible
  const storeCheck = await page.evaluate(() => {
    const hasReduxStore = typeof window.__REDUX_STORE__ !== 'undefined';
    const hasPlannerAPI = typeof window.__PLANNER_API__ !== 'undefined';
    const windowKeys = Object.keys(window).filter(k => k.includes('REDUX') || k.includes('PLANNER'));

    return {
      hasReduxStore,
      hasPlannerAPI,
      windowKeys,
      accessible: hasReduxStore || hasPlannerAPI
    };
  });

  if (!storeCheck.accessible) {
    console.error('ERROR: Redux store is not accessible!');
    console.error('Available window keys:', storeCheck.windowKeys);
    console.error('');
    console.error('To fix this issue:');
    console.error('1. Apply the patch from container/renderer-patch.js to demo/src/renderer.jsx');
    console.error('2. Rebuild: npm run build-demo');
    console.error('3. Rebuild Docker container');
    console.error('');
    console.error('See README.md "Troubleshooting > Redux Store Not Accessible" for details.');
    throw new Error('Redux store not accessible. Cannot control planner without exposed store.');
  } else {
    console.log('✓ Redux store successfully exposed');
    if (storeCheck.hasReduxStore) console.log('  - window.__REDUX_STORE__ found');
    if (storeCheck.hasPlannerAPI) console.log('  - window.__PLANNER_API__ found');
  }

  console.log('Browser initialized and planner loaded');
  isReady = true;
}

// Execute a Redux action in the planner
async function dispatchAction(action) {
  if (!page) throw new Error('Browser not initialized');

  console.log('Dispatching action:', action.type);

  return await page.evaluate((actionToDispatch) => {
    // Try using Planner API first
    if (window.__PLANNER_API__) {
      window.__PLANNER_API__.dispatch(actionToDispatch);
      return { success: true, state: window.__PLANNER_API__.getState() };
    }

    // Fallback: Access the Redux store directly
    if (window.__REDUX_STORE__) {
      window.__REDUX_STORE__.dispatch(actionToDispatch);
      const state = window.__REDUX_STORE__.getState();
      return { success: true, state: state.toJS ? state.toJS() : state };
    }

    throw new Error('Redux store not accessible. Please ensure store-exposer.js is loaded.');
  }, action);
}

// Get current planner state
async function getState() {
  if (!page) throw new Error('Browser not initialized');

  return await page.evaluate(() => {
    // Try using Planner API first
    if (window.__PLANNER_API__) {
      return window.__PLANNER_API__.getState();
    }

    // Fallback: Access store directly
    if (window.__REDUX_STORE__) {
      const state = window.__REDUX_STORE__.getState();
      // Return serializable version
      return JSON.parse(JSON.stringify(state.toJS ? state.toJS() : state));
    }

    throw new Error('Redux store not accessible. Please ensure store-exposer.js is loaded.');
  });
}

// Execute custom JavaScript in the browser
async function executeScript(script) {
  if (!page) throw new Error('Browser not initialized');
  return await page.evaluate(script);
}

// Take a screenshot
async function takeScreenshot() {
  if (!page) throw new Error('Browser not initialized');
  return await page.screenshot({ encoding: 'base64', fullPage: false });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    uptime: process.uptime()
  });
});

// Get current state
app.get('/state', async (req, res) => {
  try {
    const state = await getState();
    res.json({ success: true, state });
  } catch (error) {
    console.error('Error getting state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dispatch action
app.post('/action', async (req, res) => {
  try {
    const { action } = req.body;

    if (!action || !action.type) {
      return res.status(400).json({
        success: false,
        error: 'Action must have a type property'
      });
    }

    const result = await dispatchAction(action);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error dispatching action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute custom script (PROTECTED - requires authentication)
app.post('/execute', requireAuth, async (req, res) => {
  try {
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({
        success: false,
        error: 'Script is required'
      });
    }

    const result = await executeScript(script);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error executing script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Take screenshot
app.get('/screenshot', async (req, res) => {
  try {
    const screenshot = await takeScreenshot();
    res.json({ success: true, screenshot });
  } catch (error) {
    console.error('Error taking screenshot:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process structured commands (high-level API)
app.post('/command', async (req, res) => {
  try {
    const { command, params } = req.body;

    console.log('Processing command:', command, params);

    // Map commands to Redux actions
    let action = null;

    switch (command) {
      case 'ADD_ITEM':
        // Validate item type against catalog
        const itemType = params.itemType || params.type;
        const validation = validateItemType(itemType);

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: validation.error,
            availableTypes: VALID_ITEM_TYPES
          });
        }

        action = {
          type: 'SELECT_TOOL_DRAWING_ITEM',
          sceneComponentType: 'items',
          itemType: validation.normalizedType
        };
        // Note: This is a two-step process - first select the tool, then add the item
        // The actual placement would require more complex interaction
        break;

      case 'ADD_WALL':
        action = {
          type: 'SELECT_TOOL_DRAWING_LINE',
          sceneComponentType: 'lines',
          lineType: 'wall'
        };
        break;

      case 'MODE_2D':
        action = { type: 'MODE_2D_VIEW' };
        break;

      case 'MODE_3D':
        action = { type: 'MODE_3D_VIEW' };
        break;

      case 'LOAD_PROJECT':
        action = {
          type: 'LOAD_PROJECT',
          sceneJSON: params.sceneJSON
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown command: ${command}`
        });
    }

    const result = await dispatchAction(action);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error processing command:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 8080;

// CRITICAL: Enforce WORKER_API_KEY in production before starting server
if (process.env.NODE_ENV === 'production' && !process.env.WORKER_API_KEY) {
  console.error('CRITICAL: WORKER_API_KEY environment variable must be set in production!');
  console.error('The server will not start without proper authentication configured.');
  console.error('Set WORKER_API_KEY in your environment or use NODE_ENV=development for testing.');
  process.exit(1);
}

initBrowser()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Container server running on port ${PORT}`);
      console.log('Ready to accept commands');
      if (process.env.NODE_ENV === 'production') {
        console.log('Running in PRODUCTION mode with authentication enabled');
      } else {
        console.warn('Running in DEVELOPMENT mode - authentication is BYPASSED');
      }
    });
  })
  .catch(error => {
    console.error('Failed to initialize browser:', error);
    process.exit(1);
  });
