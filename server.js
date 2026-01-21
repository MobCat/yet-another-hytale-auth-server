const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configuration via environment variables
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'sanasol.ws';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const ASSETS_PATH = process.env.ASSETS_PATH || '/app/assets/Assets.zip';

// File path for persisted user data
const USER_DATA_FILE = path.join(DATA_DIR, 'user_data.json');

// Cache for cosmetics loaded from Assets.zip
let cachedCosmetics = null;

// Cache for full cosmetic configs (with model paths)
let cachedCosmeticConfigs = null;

// Cache for gradient sets
let cachedGradientSets = null;

// Cache for eye colors
let cachedEyeColors = null;

// Ed25519 key pair for JWT signing - persisted to survive restarts
const KEY_ID = '2025-10-01';
const KEY_FILE = path.join(DATA_DIR, 'jwt_keys.json');

let privateKey, publicKey, publicKeyJwk;

function loadOrGenerateKeys() {
  try {
    // Try to load existing keys
    if (fs.existsSync(KEY_FILE)) {
      const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      privateKey = crypto.createPrivateKey({
        key: Buffer.from(keyData.privateKey, 'base64'),
        format: 'der',
        type: 'pkcs8'
      });
      publicKey = crypto.createPublicKey({
        key: Buffer.from(keyData.publicKey, 'base64'),
        format: 'der',
        type: 'spki'
      });
      publicKeyJwk = publicKey.export({ format: 'jwk' });
      console.log('Loaded existing Ed25519 key pair from disk');
      return;
    }
  } catch (e) {
    console.log('Could not load existing keys:', e.message);
  }

  // Generate new keys
  const keyPair = crypto.generateKeyPairSync('ed25519');
  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;
  publicKeyJwk = publicKey.export({ format: 'jwk' });

  // Save keys to disk
  try {
    const dir = path.dirname(KEY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const keyData = {
      privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
      publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(KEY_FILE, JSON.stringify(keyData, null, 2));
    console.log('Generated and saved new Ed25519 key pair');
  } catch (e) {
    console.log('Could not save keys:', e.message);
    console.log('Generated Ed25519 key pair (not persisted)');
  }
}

loadOrGenerateKeys();

// Load persisted user data
function loadUserData() {
  try {
    if (fs.existsSync(USER_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.log('Notice: Could not load user data:', e.message);
  }
  return {};
}

// Save user data to disk
function saveUserData(data) {
  try {
    // Ensure data directory exists
    const dir = path.dirname(USER_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Notice: Could not save user data:', e.message);
  }
}

// In-memory cache, loaded from file on startup
let userData = loadUserData();

// Cache for UUID -> username mapping (to persist usernames across requests)
// This ensures we always use the correct player name even when server tokens are involved
const uuidUsernameCache = new Map();

// Load cosmetics from Assets.zip
function loadCosmeticsFromAssets() {
  if (cachedCosmetics) {
    return cachedCosmetics;
  }

  if (!fs.existsSync(ASSETS_PATH)) {
    console.log('Assets.zip not found at:', ASSETS_PATH);
    return null;
  }

  console.log('Loading cosmetics from:', ASSETS_PATH);

  // Map of JSON file names to cosmetic category names
  const categoryMap = {
    'BodyCharacteristics.json': 'bodyCharacteristic',
    'Capes.json': 'cape',
    'EarAccessory.json': 'earAccessory',
    'Ears.json': 'ears',
    'Eyebrows.json': 'eyebrows',
    'Eyes.json': 'eyes',
    'Faces.json': 'face',
    'FaceAccessory.json': 'faceAccessory',
    'FacialHair.json': 'facialHair',
    'Gloves.json': 'gloves',
    'Haircuts.json': 'haircut',
    'HeadAccessory.json': 'headAccessory',
    'Mouths.json': 'mouth',
    'Overpants.json': 'overpants',
    'Overtops.json': 'overtop',
    'Pants.json': 'pants',
    'Shoes.json': 'shoes',
    'SkinFeatures.json': 'skinFeature',
    'Undertops.json': 'undertop',
    'Underwear.json': 'underwear',
  };

  const cosmetics = {};

  for (const [fileName, categoryName] of Object.entries(categoryMap)) {
    const entryPath = `Cosmetics/CharacterCreator/${fileName}`;

    try {
      // Use unzip -p to extract file content to stdout
      const content = execSync(`unzip -p "${ASSETS_PATH}" "${entryPath}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });

      const items = JSON.parse(content);
      const ids = items
          .filter(item => item && item.Id)
          .map(item => item.Id);

      if (ids.length > 0) {
        cosmetics[categoryName] = ids;
        console.log(`  Loaded ${ids.length} ${categoryName} items`);
      }
    } catch (e) {
      // File might not exist or parse error - silently skip
    }
  }

  if (Object.keys(cosmetics).length > 0) {
    cachedCosmetics = cosmetics;
    console.log('Cosmetics loaded successfully from Assets.zip');
    return cosmetics;
  }

  console.log('No cosmetics loaded from Assets.zip');
  return null;
}

// Load full cosmetic configs with model paths for avatar rendering
function loadCosmeticConfigs() {
  if (cachedCosmeticConfigs) {
    return cachedCosmeticConfigs;
  }

  if (!fs.existsSync(ASSETS_PATH)) {
    return null;
  }

  const categoryFiles = {
    'Haircuts.json': 'haircut',
    'Pants.json': 'pants',
    'Overtops.json': 'overtop',
    'Undertops.json': 'undertop',
    'Shoes.json': 'shoes',
    'HeadAccessory.json': 'headAccessory',
    'FaceAccessory.json': 'faceAccessory',
    'EarAccessory.json': 'earAccessory',
    'Eyebrows.json': 'eyebrows',
    'Eyes.json': 'eyes',
    'Faces.json': 'face',
    'FacialHair.json': 'facialHair',
    'Gloves.json': 'gloves',
    'Capes.json': 'cape',
    'Overpants.json': 'overpants',
    'Mouths.json': 'mouth',
    'Ears.json': 'ears',
    'Underwear.json': 'underwear',
    'BodyCharacteristics.json': 'bodyCharacteristic',
  };

  const configs = {};

  for (const [fileName, category] of Object.entries(categoryFiles)) {
    try {
      const content = execSync(`unzip -p "${ASSETS_PATH}" "Cosmetics/CharacterCreator/${fileName}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      const items = JSON.parse(content);
      configs[category] = {};
      for (const item of items) {
        if (item && item.Id) {
          configs[category][item.Id] = item;
        }
      }
    } catch (e) {
      // Skip if file doesn't exist
    }
  }

  cachedCosmeticConfigs = configs;
  return configs;
}

// Load gradient sets for color tinting
function loadGradientSets() {
  if (cachedGradientSets) {
    return cachedGradientSets;
  }

  if (!fs.existsSync(ASSETS_PATH)) {
    return null;
  }

  try {
    const content = execSync(`unzip -p "${ASSETS_PATH}" "Cosmetics/CharacterCreator/GradientSets.json"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    cachedGradientSets = JSON.parse(content);
    return cachedGradientSets;
  } catch (e) {
    return null;
  }
}

// Load eye colors
function loadEyeColors() {
  if (cachedEyeColors) {
    return cachedEyeColors;
  }

  if (!fs.existsSync(ASSETS_PATH)) {
    return null;
  }

  try {
    const content = execSync(`unzip -p "${ASSETS_PATH}" "Cosmetics/CharacterCreator/EyeColors.json"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    const colors = JSON.parse(content);
    // Convert to map for easy lookup
    cachedEyeColors = {};
    for (const color of colors) {
      if (color.Id) {
        cachedEyeColors[color.Id] = color;
      }
    }
    return cachedEyeColors;
  } catch (e) {
    return null;
  }
}

// Extract asset from Assets.zip
function extractAsset(assetPath) {
  if (!fs.existsSync(ASSETS_PATH)) {
    return null;
  }

  // Normalize path - try Common/ prefix if not found
  const pathsToTry = [
    assetPath,
    `Common/${assetPath}`,
    assetPath.replace(/^Common\//, '')
  ];

  for (const tryPath of pathsToTry) {
    try {
      const content = execSync(`unzip -p "${ASSETS_PATH}" "${tryPath}"`, {
        maxBuffer: 50 * 1024 * 1024
      });
      return content;
    } catch (e) {
      // Try next path
    }
  }

  return null;
}

// Resolve skin part to model/texture paths
function resolveSkinPart(category, partValue, configs, gradientSets) {
  if (!partValue || !configs || !configs[category]) {
    return null;
  }

  // Parse "PartId.ColorId" or "PartId.ColorId.Variant" format
  const parts = partValue.split('.');
  const partId = parts[0];
  const colorId = parts.length > 1 ? parts[1] : null;
  const variantId = parts.length > 2 ? parts[2] : null;

  const partConfig = configs[category][partId];
  if (!partConfig) {
    return null;
  }

  const result = {
    id: partId,
    colorId: colorId,
    name: partConfig.Name
  };

  // Handle items with Variants (like capes)
  if (partConfig.Variants) {
    const variant = variantId ? partConfig.Variants[variantId] : partConfig.Variants['Neck_Piece'] || Object.values(partConfig.Variants)[0];
    if (variant) {
      result.model = variant.Model;
      result.greyscaleTexture = variant.GreyscaleTexture;

      // Handle variant-specific textures
      if (variant.Textures && colorId && variant.Textures[colorId]) {
        result.texture = variant.Textures[colorId].Texture;
        result.baseColor = variant.Textures[colorId].BaseColor;
      } else if (variant.GreyscaleTexture && partConfig.GradientSet) {
        result.gradientSet = partConfig.GradientSet;
        // Resolve gradient color
        if (colorId && gradientSets) {
          const gradientSetConfig = gradientSets.find(g => g.Id === partConfig.GradientSet);
          if (gradientSetConfig && gradientSetConfig.Gradients && gradientSetConfig.Gradients[colorId]) {
            result.gradientTexture = gradientSetConfig.Gradients[colorId].Texture;
            result.baseColor = gradientSetConfig.Gradients[colorId].BaseColor;
          }
        }
      }
    }
    return result;
  }

  // Standard item without variants
  result.model = partConfig.Model;

  // Handle textures - either specific color texture or greyscale + gradient
  if (partConfig.Textures && colorId && partConfig.Textures[colorId]) {
    result.texture = partConfig.Textures[colorId].Texture;
    result.baseColor = partConfig.Textures[colorId].BaseColor;
  } else if (partConfig.GreyscaleTexture) {
    result.greyscaleTexture = partConfig.GreyscaleTexture;
    result.gradientSet = partConfig.GradientSet;

    // Resolve gradient color
    if (colorId && partConfig.GradientSet && gradientSets) {
      const gradientSetConfig = gradientSets.find(g => g.Id === partConfig.GradientSet);
      if (gradientSetConfig && gradientSetConfig.Gradients && gradientSetConfig.Gradients[colorId]) {
        result.gradientTexture = gradientSetConfig.Gradients[colorId].Texture;
        result.baseColor = gradientSetConfig.Gradients[colorId].BaseColor;
      }
    }
  }

  return result;
}

// Generate a JWT token with proper Ed25519 signing
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({
    alg: 'EdDSA',
    kid: KEY_ID,
    typ: 'JWT'
  })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${body}`;

  // Sign with Ed25519 private key
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString('base64url')}`;
}

// Generate identity token for the game client/server
function generateIdentityToken(uuid, name, entitlements = ['game.base']) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 36000; // 10 hours

  return generateToken({
    sub: uuid,
    name: name,
    username: name,
    entitlements: entitlements,
    scope: 'hytale:server hytale:client',
    iat: now,
    exp: exp,
    iss: `https://sessions.${DOMAIN}`,
    jti: crypto.randomUUID()
  });
}

// Generate session token for the game server
function generateSessionToken(uuid) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 36000; // 10 hours

  return generateToken({
    sub: uuid,
    scope: 'hytale:server',
    iat: now,
    exp: exp,
    iss: `https://sessions.${DOMAIN}`,
    jti: crypto.randomUUID()
  });
}

function handleRequest(req, res) {
  const timestamp = new Date().toISOString();
  // Skip logging for telemetry endpoints (too noisy)
  if (!req.url.includes('/telemetry')) {
    console.log(`${timestamp} ${req.method} ${req.url}`);
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Collect body for POST requests
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const jsonBody = body ? JSON.parse(body) : {};
      routeRequest(req, res, url, jsonBody, req.headers);
    } catch (e) {
      routeRequest(req, res, url, {}, req.headers);
    }
  });
}

function routeRequest(req, res, url, body, headers) {
  const urlPath = url.pathname;

  // Extract UUID and name from body first
  let uuid = body.uuid || crypto.randomUUID();
  let name = body.name || null;
  let tokenScope = null;

  // If we have a valid name from body (not 'Player'), cache it immediately
  if (uuid && name && name !== 'Player') {
    uuidUsernameCache.set(uuid, name);
    console.log(`Cached username from body for UUID ${uuid}: ${name}`);
  }

  // Extract UUID and name from Authorization header
  if (headers && headers.authorization) {
    try {
      const token = headers.authorization.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.sub) uuid = payload.sub;
        if (payload.scope) tokenScope = payload.scope;
        
        // Extract name from token
        let tokenName = null;
        if (payload.username) tokenName = payload.username;
        else if (payload.name) tokenName = payload.name;
        
        // Cache token name if it's valid and from a player token
        if (uuid && tokenName && tokenName !== 'Player' && tokenScope && 
            (tokenScope.includes('hytale:client') || tokenScope.includes('hytale:editor'))) {
          uuidUsernameCache.set(uuid, tokenName);
          console.log(`Cached username from token for UUID ${uuid}: ${tokenName}`);
          name = tokenName;
        }
      }
    } catch (e) {}
  }
  
  // If we don't have a valid name yet, try the cache
  if (!name || name === 'Player') {
    const cachedName = uuidUsernameCache.get(uuid);
    if (cachedName) {
      name = cachedName;
      console.log(`Using cached username for UUID ${uuid}: ${name}`);
    }
  }
  
  // Final fallback
  if (!name) name = 'Player';

  // Avatar viewer routes
  if (urlPath.startsWith('/avatar/')) {
    handleAvatarRoutes(req, res, urlPath, body);
    return;
  }

  // Customizer route
  if (urlPath.startsWith('/customizer')) {
    handleCustomizerRoute(req, res, urlPath);
    return;
  }

  // Cosmetics list API
  if (urlPath === '/cosmetics/list') {
    handleCosmeticsList(req, res);
    return;
  }

  // Single cosmetic item data API (for 3D thumbnail rendering)
  if (urlPath.startsWith('/cosmetics/item/')) {
    handleCosmeticItem(req, res, urlPath);
    return;
  }

  // Static assets route
  if (urlPath.startsWith('/assets/')) {
    handleStaticAssets(req, res, urlPath);
    return;
  }

  // Asset extraction route
  if (urlPath.startsWith('/asset/')) {
    handleAssetRoute(req, res, urlPath);
    return;
  }

  // Health check
  if (urlPath === '/health' || urlPath === '/') {
    sendJson(res, 200, { status: 'ok', server: 'hytale-auth', domain: DOMAIN });
    return;
  }

  // Ignore favicon requests
  if (urlPath === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // JWKS endpoint for JWT signature verification
  if (urlPath === '/.well-known/jwks.json' || urlPath === '/jwks.json') {
    sendJson(res, 200, {
      keys: [{
        kty: publicKeyJwk.kty,
        crv: publicKeyJwk.crv,
        x: publicKeyJwk.x,
        kid: KEY_ID,
        use: 'sig',
        alg: 'EdDSA'
      }]
    });
    return;
  }

  // Game session endpoints
  if (urlPath === '/game-session/new') {
    handleGameSessionNew(req, res, body, uuid, name);
    return;
  }

  if (urlPath === '/game-session/refresh') {
    handleGameSessionRefresh(req, res, body, uuid, name, headers);
    return;
  }

  if (urlPath === '/game-session/child' || urlPath.includes('/game-session/child')) {
    handleGameSessionChild(req, res, body, uuid, name);
    return;
  }

  // Authorization grant endpoint - server requests this to authorize a client connection
  if (urlPath === '/game-session/authorize' || urlPath.includes('/authorize') || urlPath.includes('/auth-grant')) {
    handleAuthorizationGrant(req, res, body, uuid, name, headers);
    return;
  }

  // Token exchange endpoint - client exchanges auth grant for access token
  if (urlPath === '/server-join/auth-token' || urlPath === '/game-session/exchange' || urlPath.includes('/auth-token')) {
    handleTokenExchange(req, res, body, uuid, name, headers);
    return;
  }

  // Session/Auth endpoints
  if (urlPath.includes('/session') || urlPath.includes('/child')) {
    handleSession(req, res, body, uuid, name);
    return;
  }

  if (urlPath.includes('/auth')) {
    handleAuth(req, res, body, uuid, name);
    return;
  }

  if (urlPath.includes('/token')) {
    handleToken(req, res, body, uuid, name);
    return;
  }

  if (urlPath.includes('/validate') || urlPath.includes('/verify')) {
    handleValidate(req, res, body, uuid, name);
    return;
  }

  if (urlPath.includes('/refresh')) {
    handleRefresh(req, res, body, uuid, name);
    return;
  }

  // Account data endpoints
  if (urlPath === '/my-account/game-profile' || urlPath.includes('/game-profile')) {
    handleGameProfile(req, res, body, uuid, name);
    return;
  }

  if (urlPath === '/my-account/skin') {
    handleSkin(req, res, body, uuid, name);
    return;
  }

  if (urlPath === '/my-account/cosmetics' || urlPath.includes('/my-account/cosmetics')) {
    handleCosmetics(req, res, body, uuid, name);
    return;
  }

  if (urlPath === '/my-account/get-launcher-data') {
    handleLauncherData(req, res, body, uuid, name);
    return;
  }

  if (urlPath === '/my-account/get-profiles') {
    handleGetProfiles(req, res, body, uuid, name);
    return;
  }

  // Bug reports and feedback
  if (urlPath === '/bugs/create' || urlPath === '/feedback/create') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Game session delete (logout/cleanup)
  if (urlPath === '/game-session' && req.method === 'DELETE') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Profile endpoint
  if (urlPath.includes('/profile') || urlPath.includes('/user') || urlPath.includes('/me')) {
    handleProfile(req, res, body, uuid, name);
    return;
  }

  // Cosmetics endpoint
  if (urlPath.includes('/cosmetic') || urlPath.includes('/unlocked') || urlPath.includes('/inventory')) {
    handleCosmetics(req, res, body, uuid, name);
    return;
  }

  // Telemetry endpoint
  if (urlPath.includes('/telemetry') || urlPath.includes('/analytics') || urlPath.includes('/event')) {
    sendJson(res, 200, { success: true, received: true });
    return;
  }

  // Catch-all - return comprehensive response that might satisfy various requests
  console.log(`Unknown endpoint: ${urlPath}`);
  const authGrant = generateAuthorizationGrant(uuid, name, crypto.randomUUID());
  const accessToken = generateIdentityToken(uuid, name);
  sendJson(res, 200, {
    success: true,
    identityToken: accessToken,
    sessionToken: generateSessionToken(uuid),
    authorizationGrant: authGrant,
    accessToken: accessToken,
    tokenType: 'Bearer',
    user: { uuid, name, premium: true }
  });
}

// Generate authorization grant token for server connection
function generateAuthorizationGrant(uuid, name, audience) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 36000; // 10 hours

  return generateToken({
    sub: uuid,
    name: name,
    username: name,
    aud: audience,
    scope: 'hytale:server hytale:client',
    iat: now,
    exp: exp,
    iss: `https://sessions.${DOMAIN}`,
    jti: crypto.randomUUID()
  });
}

function handleAuthorizationGrant(req, res, body, uuid, name, headers) {
  console.log('Authorization grant request:', uuid, name, 'body:', JSON.stringify(body));

  // Extract user info from identity token if present in request
  if (body.identityToken) {
    try {
      const parts = body.identityToken.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.sub) uuid = payload.sub;
        if (payload.name) name = payload.name;
        if (payload.username) name = payload.username;
        console.log('Extracted from identity token - uuid:', uuid, 'name:', name);
      }
    } catch (e) {
      console.log('Failed to parse identity token:', e.message);
    }
  }

  // Extract audience from request (server's unique ID)
  const audience = body.aud || body.audience || body.server_id || crypto.randomUUID();

  const authGrant = generateAuthorizationGrant(uuid, name, audience);
  const expiresAt = new Date(Date.now() + 36000 * 1000).toISOString();

  sendJson(res, 200, {
    authorizationGrant: authGrant,
    expiresAt: expiresAt
  });
}

function handleTokenExchange(req, res, body, uuid, name, headers) {
  console.log('Token exchange request:', uuid, name);

  // Extract audience from the authorization grant JWT
  let audience = null;
  if (body.authorizationGrant) {
    try {
      const parts = body.authorizationGrant.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        audience = payload.aud;
        if (payload.sub) uuid = payload.sub;
        if (payload.name) name = payload.name;
        if (payload.username) name = payload.username; // Prefer username over name
        console.log('Extracted from auth grant - aud:', audience, 'sub:', uuid, 'name:', name);
      }
    } catch (e) {
      console.log('Failed to parse auth grant:', e.message);
    }
  }

  // Get certificate fingerprint from request (for mTLS binding)
  const certFingerprint = body.x509Fingerprint || body.certFingerprint || body.fingerprint;
  console.log('Certificate fingerprint:', certFingerprint);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 36000; // 10 hours

  // Generate access token with audience and certificate binding
  const tokenPayload = {
    sub: uuid,
    name: name,
    username: name,
    aud: audience,
    entitlements: ['game.base'],
    scope: 'hytale:server hytale:client',
    iat: now,
    exp: exp,
    iss: `https://sessions.${DOMAIN}`,
    jti: crypto.randomUUID()
  };

  // Add certificate confirmation if fingerprint provided (mTLS binding)
  if (certFingerprint) {
    tokenPayload.cnf = {
      'x5t#S256': certFingerprint
    };
  }

  const accessToken = generateToken(tokenPayload);

  const refreshToken = generateSessionToken(uuid);
  const expiresAt = new Date(Date.now() + 36000 * 1000).toISOString();

  sendJson(res, 200, {
    accessToken: accessToken,
    tokenType: 'Bearer',
    expiresIn: 36000,
    refreshToken: refreshToken,
    expiresAt: expiresAt,
    scope: 'hytale:server hytale:client'
  });
}

// Create new game session (used by official launcher and servers)
function handleGameSessionNew(req, res, body, uuid, name) {
  console.log('game-session/new:', uuid, name);

  // Extract UUID from body if provided
  if (body.uuid) uuid = body.uuid;

  const identityToken = generateIdentityToken(uuid, name);
  const sessionToken = generateSessionToken(uuid);
  const expiresAt = new Date(Date.now() + 36000 * 1000).toISOString();

  sendJson(res, 200, {
    sessionToken: sessionToken,
    identityToken: identityToken,
    expiresAt: expiresAt
  });
}

// Refresh existing game session
function handleGameSessionRefresh(req, res, body, uuid, name, headers) {
  console.log('game-session/refresh:', uuid, name);

  // Extract info from existing session token if provided
  if (body.sessionToken) {
    try {
      const token = body.sessionToken;
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.sub) uuid = payload.sub;
        if (payload.name) name = payload.name;
      }
    } catch (e) {
      console.log('Failed to parse session token:', e.message);
    }
  }

  const identityToken = generateIdentityToken(uuid, name);
  const sessionToken = generateSessionToken(uuid);
  const expiresAt = new Date(Date.now() + 36000 * 1000).toISOString();

  sendJson(res, 200, {
    sessionToken: sessionToken,
    identityToken: identityToken,
    expiresAt: expiresAt
  });
}

function handleGameSessionChild(req, res, body, uuid, name) {
  console.log('game-session/child:', uuid, name);

  const scopes = body.scopes || ['hytale:server'];
  const scopeString = Array.isArray(scopes) ? scopes.join(' ') : scopes;

  const childIdentityToken = generateToken({
    sub: uuid,
    name: name,
    username: name,
    entitlements: ['game.base'],
    scope: scopeString,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    iss: `https://sessions.${DOMAIN}`,
    jti: crypto.randomUUID()
  });

  const sessionToken = generateSessionToken(uuid);
  const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

  sendJson(res, 200, {
    sessionToken: sessionToken,
    identityToken: childIdentityToken,
    expiresAt: expiresAt
  });
}

function handleSession(req, res, body, uuid, name) {
  sendJson(res, 200, {
    success: true,
    session_id: crypto.randomUUID(),
    identityToken: generateIdentityToken(uuid, name),
    identity_token: generateIdentityToken(uuid, name),
    sessionToken: generateSessionToken(uuid),
    session_token: generateSessionToken(uuid),
    expires_in: 86400,
    token_type: 'Bearer',
    user: { uuid, name, premium: true }
  });
}

function handleAuth(req, res, body, uuid, name) {
  sendJson(res, 200, {
    success: true,
    authenticated: true,
    identity_token: generateIdentityToken(uuid, name),
    session_token: generateSessionToken(uuid),
    token_type: 'Bearer',
    expires_in: 86400,
    user: { uuid, name, premium: true }
  });
}

function handleToken(req, res, body, uuid, name) {
  sendJson(res, 200, {
    access_token: generateIdentityToken(uuid, name),
    identity_token: generateIdentityToken(uuid, name),
    session_token: generateSessionToken(uuid),
    token_type: 'Bearer',
    expires_in: 86400,
    refresh_token: generateSessionToken(uuid)
  });
}

function handleValidate(req, res, body, uuid, name) {
  sendJson(res, 200, {
    valid: true,
    success: true,
    user: { uuid, name, premium: true }
  });
}

function handleRefresh(req, res, body, uuid, name) {
  sendJson(res, 200, {
    success: true,
    identity_token: generateIdentityToken(uuid, name),
    session_token: generateSessionToken(uuid),
    token_type: 'Bearer',
    expires_in: 86400
  });
}

function handleProfile(req, res, body, uuid, name) {
  sendJson(res, 200, {
    success: true,
    uuid, name,
    display_name: name,
    premium: true,
    created_at: '2024-01-01T00:00:00Z',
    settings: { language: 'en', notifications: true },
    stats: { playtime: 0, worlds_created: 0 }
  });
}

function handleSkin(req, res, body, uuid, name) {
  console.log('skin update:', uuid);

  if (!userData[uuid]) {
    userData[uuid] = {};
  }
  userData[uuid].skin = body;
  userData[uuid].lastUpdated = new Date().toISOString();
  saveUserData(userData);

  res.writeHead(204);
  res.end();
}

function handleLauncherData(req, res, body, uuid, name) {
  sendJson(res, 200, {
    EulaAcceptedAt: "2024-01-01T00:00:00Z",
    Owner: uuid,
    Patchlines: {
      PreRelease: { BuildVersion: "1.0.0", Newest: 1 },
      Release: { BuildVersion: "1.0.0", Newest: 1 }
    },
    Profiles: [{
      UUID: uuid,
      Username: name,
      Entitlements: ["game.base"]
    }]
  });
}

function handleGameProfile(req, res, body, uuid, name) {
  const nextNameChange = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let skin = null;
  if (userData[uuid] && userData[uuid].skin) {
    skin = JSON.stringify(userData[uuid].skin);
  }

  sendJson(res, 200, {
    uuid, username: name,
    entitlements: ["game.base"],
    createdAt: "2024-01-01T00:00:00Z",
    nextNameChangeAt: nextNameChange,
    skin: skin
  });
}

// Get all profiles for the authenticated user (used by hytale-server client)
function handleGetProfiles(req, res, body, uuid, name) {
  console.log('get-profiles:', uuid, name);

  sendJson(res, 200, {
    profiles: [{
      uuid: uuid,
      username: name,
      entitlements: ["game.base"]
    }]
  });
}

function handleCosmetics(req, res, body, uuid, name) {
  // Try to load cosmetics from Assets.zip first
  const assetsCosmetics = loadCosmeticsFromAssets();

  if (assetsCosmetics && Object.keys(assetsCosmetics).length > 0) {
    console.log('Returning cosmetics from Assets.zip');
    sendJson(res, 200, assetsCosmetics);
    return;
  }

  // Fallback to basic cosmetics if Assets.zip not available
  console.log('Using fallback cosmetics');
  sendJson(res, 200, {
    bodyCharacteristic: ["Default", "Muscular"],
    cape: ["Cape_Royal_Emissary", "Cape_New_Beginning", "Cape_Forest_Guardian", "Cape_PopStar"],
    earAccessory: [],
    ears: [],
    eyebrows: [],
    eyes: [],
    face: [],
    faceAccessory: [],
    facialHair: [],
    gloves: [],
    haircut: [],
    headAccessory: [],
    mouth: [],
    overpants: [],
    overtop: [],
    pants: [],
    shoes: [],
    skinFeature: [],
    undertop: [],
    underwear: []
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Handle avatar viewer routes
function handleAvatarRoutes(req, res, urlPath, body = {}) {
  // Parse UUID from path: /avatar/{uuid} or /avatar/{uuid}/model
  const pathParts = urlPath.split('/').filter(p => p);

  if (pathParts.length < 2) {
    sendJson(res, 400, { error: 'UUID required' });
    return;
  }

  const uuid = pathParts[1];
  const action = pathParts[2]; // 'model' or undefined (serve HTML)

  if (action === 'model') {
    // Return model data for Three.js rendering
    handleAvatarModel(req, res, uuid);
  } else if (action === 'preview') {
    // Handle preview with custom skin data (POST)
    handleAvatarPreview(req, res, uuid, body);
  } else {
    // Serve the HTML viewer page
    serveAvatarViewer(req, res, uuid);
  }
}

// Serve avatar viewer HTML page
function serveAvatarViewer(req, res, uuid) {
  const viewerPath = path.join(__dirname, 'assets', 'avatar-viewer.html');

  // Check if custom viewer exists
  if (fs.existsSync(viewerPath)) {
    let html = fs.readFileSync(viewerPath, 'utf8');
    // Inject UUID into the page
    html = html.replace('{{UUID}}', uuid);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // Serve embedded viewer
  const html = generateAvatarViewerHtml(uuid);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// Handle avatar model data request
function handleAvatarModel(req, res, uuid) {
  // Get user skin data
  const userSkin = userData[uuid]?.skin || null;

  if (!userSkin) {
    sendJson(res, 404, { error: 'User skin not found', uuid });
    return;
  }

  // Load configs
  const configs = loadCosmeticConfigs();
  const gradientSets = loadGradientSets();
  const eyeColors = loadEyeColors();

  if (!configs) {
    sendJson(res, 500, { error: 'Could not load cosmetic configs' });
    return;
  }

  // Resolve all skin parts to their model/texture paths
  const resolvedParts = {};
  const categories = [
    'haircut', 'pants', 'overtop', 'undertop', 'shoes',
    'headAccessory', 'faceAccessory', 'earAccessory',
    'eyebrows', 'eyes', 'face', 'facialHair', 'gloves',
    'cape', 'overpants', 'mouth', 'ears', 'underwear'
  ];

  for (const category of categories) {
    if (userSkin[category]) {
      const resolved = resolveSkinPart(category, userSkin[category], configs, gradientSets);
      if (resolved) {
        resolvedParts[category] = resolved;
      }
    }
  }

  // Handle eye color separately (it's stored in 'eyeColor' field)
  if (userSkin.eyeColor && eyeColors) {
    const eyeColorData = eyeColors[userSkin.eyeColor];
    if (eyeColorData && resolvedParts.eyes) {
      // Override the base color for eyes with the eye color
      resolvedParts.eyes.baseColor = eyeColorData.BaseColor;

      // Also resolve the gradient texture from Eyes_Gradient set
      if (resolvedParts.eyes.gradientSet && gradientSets) {
        const eyeGradientSet = gradientSets.find(g => g.Id === resolvedParts.eyes.gradientSet);
        if (eyeGradientSet && eyeGradientSet.Gradients && eyeGradientSet.Gradients[userSkin.eyeColor]) {
          resolvedParts.eyes.gradientTexture = eyeGradientSet.Gradients[userSkin.eyeColor].Texture;
        }
      }
    }
  }

  // Parse bodyCharacteristic for body type and skin tone
  // Format: "BodyType.SkinToneId" e.g., "Muscular.22"
  let bodyType = 'Regular';
  let skinTone = '01'; // Default to light peach

  if (userSkin.bodyCharacteristic) {
    const bodyParts = userSkin.bodyCharacteristic.split('.');
    bodyType = bodyParts[0] || 'Regular';
    if (bodyParts.length > 1) {
      // Pad single digit to two digits (e.g., "22" stays "22", "5" becomes "05")
      skinTone = bodyParts[1].padStart(2, '0');
    }
  }

  // Allow explicit skinTone override
  if (userSkin.skinTone) {
    skinTone = userSkin.skinTone;
  }

  sendJson(res, 200, {
    uuid,
    skinTone,
    bodyType,
    parts: resolvedParts,
    raw: userSkin
  });
}

// Handle avatar preview with custom skin data (POST)
function handleAvatarPreview(req, res, uuid, customSkin = {}) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  // Load configs
  const configs = loadCosmeticConfigs();
  const gradientSets = loadGradientSets();
  const eyeColors = loadEyeColors();

  if (!configs) {
    sendJson(res, 500, { error: 'Could not load cosmetic configs' });
    return;
  }

  // Resolve all skin parts to their model/texture paths
  const resolvedParts = {};
  const categories = [
    'haircut', 'pants', 'overtop', 'undertop', 'shoes',
    'headAccessory', 'faceAccessory', 'earAccessory',
    'eyebrows', 'eyes', 'face', 'facialHair', 'gloves',
    'cape', 'overpants', 'mouth', 'ears', 'underwear'
  ];

  for (const category of categories) {
    if (customSkin[category]) {
      const resolved = resolveSkinPart(category, customSkin[category], configs, gradientSets);
      if (resolved) {
        resolvedParts[category] = resolved;
      }
    }
  }

  // Handle eye color separately
  if (customSkin.eyeColor && eyeColors) {
    const eyeColorData = eyeColors[customSkin.eyeColor];
    if (eyeColorData && resolvedParts.eyes) {
      resolvedParts.eyes.baseColor = eyeColorData.BaseColor;

      if (resolvedParts.eyes.gradientSet && gradientSets) {
        const eyeGradientSet = gradientSets.find(g => g.Id === resolvedParts.eyes.gradientSet);
        if (eyeGradientSet && eyeGradientSet.Gradients && eyeGradientSet.Gradients[customSkin.eyeColor]) {
          resolvedParts.eyes.gradientTexture = eyeGradientSet.Gradients[customSkin.eyeColor].Texture;
        }
      }
    }
  }

  // Parse bodyCharacteristic for body type and skin tone
  let bodyType = 'Regular';
  let skinTone = '01';

  if (customSkin.bodyCharacteristic) {
    const bodyParts = customSkin.bodyCharacteristic.split('.');
    bodyType = bodyParts[0] || 'Regular';
    if (bodyParts.length > 1) {
      skinTone = bodyParts[1].padStart(2, '0');
    }
  }

  if (customSkin.skinTone) {
    skinTone = customSkin.skinTone;
  }

  sendJson(res, 200, {
    uuid,
    skinTone,
    bodyType,
    parts: resolvedParts,
    raw: customSkin
  });
}

// Handle customizer route
function handleCustomizerRoute(req, res, urlPath) {
  // Parse UUID from path: /customizer/{uuid} or just /customizer
  const pathParts = urlPath.split('/').filter(p => p);
  const uuid = pathParts[1] || 'preview';

  const customizerPath = path.join(__dirname, 'assets', 'customizer.html');

  if (fs.existsSync(customizerPath)) {
    let html = fs.readFileSync(customizerPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else {
    // Redirect to avatar viewer if customizer not found
    res.writeHead(302, { 'Location': `/avatar/${uuid}` });
    res.end();
  }
}

// Handle cosmetics list API - returns full cosmetic data with thumbnails
function handleCosmeticsList(req, res) {
  const configs = loadCosmeticConfigs();
  const gradientSets = loadGradientSets();

  if (!configs) {
    sendJson(res, 200, {});
    return;
  }

  // Build response with full item data including thumbnails
  const result = {};

  for (const [category, items] of Object.entries(configs)) {
    result[category] = [];
    for (const [id, item] of Object.entries(items)) {
      const itemData = {
        id: item.Id,
        name: item.Name || item.Id,
        thumbnail: item.GreyscaleTexture || item.Texture || null,
        gradientSet: item.GradientSet || null,
        model: item.Model || null
      };

      // Get available colors for this item
      if (item.GradientSet && gradientSets) {
        const gradientSetConfig = gradientSets.find(g => g.Id === item.GradientSet);
        if (gradientSetConfig && gradientSetConfig.Gradients) {
          itemData.colors = Object.keys(gradientSetConfig.Gradients);
        }
      } else if (item.Textures) {
        itemData.colors = Object.keys(item.Textures);
      }

      result[category].push(itemData);
    }
  }

  sendJson(res, 200, result);
}

// Handle single cosmetic item data request (for 3D thumbnail rendering)
// URL format: /cosmetics/item/{category}/{itemId} or /cosmetics/item/{category}/{itemId}/{colorId}
function handleCosmeticItem(req, res, urlPath) {
  const pathParts = urlPath.split('/').filter(p => p);
  // pathParts: ['cosmetics', 'item', category, itemId, colorId?]

  if (pathParts.length < 4) {
    sendJson(res, 400, { error: 'Category and item ID required' });
    return;
  }

  const category = pathParts[2];
  const itemId = pathParts[3];
  const colorId = pathParts[4] || null;

  // Build the item string (itemId or itemId.colorId)
  const itemString = colorId ? `${itemId}.${colorId}` : itemId;

  // Load configs
  const configs = loadCosmeticConfigs();
  const gradientSets = loadGradientSets();

  if (!configs) {
    sendJson(res, 500, { error: 'Could not load cosmetic configs' });
    return;
  }

  // Resolve the item
  const resolved = resolveSkinPart(category, itemString, configs, gradientSets);

  if (!resolved) {
    sendJson(res, 404, { error: 'Item not found', category, itemId });
    return;
  }

  sendJson(res, 200, {
    category,
    itemId,
    colorId,
    resolved
  });
}

// Handle static assets (avatar.js, etc.)
function handleStaticAssets(req, res, urlPath) {
  const assetPath = urlPath.replace('/assets/', '');
  const filePath = path.join(__dirname, 'assets', assetPath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Determine content type
  let contentType = 'application/octet-stream';
  if (assetPath.endsWith('.js')) {
    contentType = 'application/javascript';
  } else if (assetPath.endsWith('.css')) {
    contentType = 'text/css';
  } else if (assetPath.endsWith('.html')) {
    contentType = 'text/html';
  } else if (assetPath.endsWith('.json')) {
    contentType = 'application/json';
  } else if (assetPath.endsWith('.png')) {
    contentType = 'image/png';
  } else if (assetPath.endsWith('.jpg') || assetPath.endsWith('.jpeg')) {
    contentType = 'image/jpeg';
  }

  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(content);
}

// Handle asset extraction route
function handleAssetRoute(req, res, urlPath) {
  // Extract asset path from URL: /asset/path/to/asset.ext
  const assetPath = urlPath.replace('/asset/', '');

  if (!assetPath) {
    sendJson(res, 400, { error: 'Asset path required' });
    return;
  }

  const content = extractAsset(assetPath);

  if (!content) {
    res.writeHead(404);
    res.end('Asset not found');
    return;
  }

  // Determine content type
  let contentType = 'application/octet-stream';
  if (assetPath.endsWith('.json') || assetPath.endsWith('.blockymodel') || assetPath.endsWith('.blockyanim')) {
    contentType = 'application/json';
  } else if (assetPath.endsWith('.png')) {
    contentType = 'image/png';
  } else if (assetPath.endsWith('.jpg') || assetPath.endsWith('.jpeg')) {
    contentType = 'image/jpeg';
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400'
  });
  res.end(content);
}

// Generate embedded avatar viewer HTML
function generateAvatarViewerHtml(uuid) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Avatar Viewer - ${uuid}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
    }
    .container { display: flex; flex-direction: column; align-items: center; padding: 20px; }
    h1 { margin-bottom: 10px; font-size: 1.5rem; }
    .uuid { font-family: monospace; background: rgba(255,255,255,0.1); padding: 5px 10px; border-radius: 4px; font-size: 0.9rem; margin-bottom: 20px; }
    #canvas-container { width: 100%; max-width: 600px; aspect-ratio: 1; background: rgba(0,0,0,0.3); border-radius: 10px; overflow: hidden; position: relative; }
    #loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error { color: #ff6b6b; padding: 20px; text-align: center; display: none; }
    .controls { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    button { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
    button:hover { background: rgba(255,255,255,0.2); }
    button.active { background: rgba(100,149,237,0.4); border-color: rgba(100,149,237,0.6); }
    .info { margin-top: 20px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; max-width: 600px; width: 100%; }
    .info h3 { margin-bottom: 10px; font-size: 1rem; }
    .parts-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; font-size: 0.85rem; }
    .part-item { background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 4px; }
    .part-name { color: #888; font-size: 0.75rem; }
    .status { position: absolute; bottom: 10px; left: 10px; font-size: 0.7rem; color: rgba(255,255,255,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hytale Avatar Viewer</h1>
    <div class="uuid">${uuid}</div>
    <div id="canvas-container">
      <div id="loading"><div class="spinner"></div><div id="loading-text">Loading avatar...</div></div>
      <div id="error"></div>
      <div class="status" id="status"></div>
    </div>
    <div class="controls">
      <button id="rotate-left">Rotate Left</button>
      <button id="rotate-right">Rotate Right</button>
      <button id="reset">Reset View</button>
      <button id="toggle-wireframe">Wireframe</button>
      <button id="toggle-autorotate" class="active">Auto-Rotate</button>
      <select id="animation-select" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px; border-radius: 5px; cursor: pointer;">
        <option value="">No Animation</option>
        <option value="Default/Idle" selected>Idle</option>
        <option value="Default/Walk">Walk</option>
        <option value="Default/Run">Run</option>
        <option value="Default/Sprint">Sprint</option>
        <option value="Default/Jump">Jump</option>
        <option value="Default/Fall">Fall</option>
        <option value="Default/Crouch">Crouch</option>
        <option value="Emote/Wave">Wave</option>
        <option value="Emote/Dab_Left">Dab Left</option>
        <option value="Emote/Dab_Right">Dab Right</option>
        <option value="Taunt/Laugh">Laugh</option>
        <option value="Taunt/Chicken">Chicken</option>
        <option value="Taunt/Punch">Punch</option>
        <option value="Poses/Sword">Sword Pose</option>
        <option value="Poses/Staff">Staff Pose</option>
        <option value="Poses/Ninja">Ninja Pose</option>
        <option value="Climb/Climb_Idle">Climb Idle</option>
        <option value="Swim/Swim">Swim</option>
        <option value="Glide/Glide">Glide</option>
        <option value="Roll/Roll">Roll</option>
      </select>
    </div>
    <div class="info" id="skin-info" style="display: none;">
      <h3>Equipped Items</h3>
      <div class="parts-list" id="parts-list"></div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    const UUID = '${uuid}';
    const SCALE = 0.01; // BlockyModel units to world units

    let scene, camera, renderer, character, rotationSpeed = 0;
    let modelData = null;
    let wireframeMode = false;
    let autoRotate = true;

    // Animation state
    let currentAnimation = null;
    let animationTime = 0;
    let lastFrameTime = 0;
    let animationEnabled = true;
    let currentAnimationPath = 'Default/Idle';
    const FPS = 60; // Hytale animations run at 60fps

    // Texture cache
    const textureCache = new Map();
    const textureLoader = new THREE.TextureLoader();

    // Body parts that should be hidden when clothing is equipped
    const hiddenBodyParts = new Set();
    // Body parts that should use polygon offset (pushed back in depth buffer)
    // so clothing can render in front without z-fighting
    const polygonOffsetParts = new Set();

    // Load animation by path
    async function loadAnimation(animPath) {
      if (!animPath) return null;
      try {
        const response = await fetch('/asset/Common/Characters/Animations/' + animPath + '.blockyanim');
        if (!response.ok) return null;
        return await response.json();
      } catch (e) {
        console.error('[ANIMATION] Failed to load animation:', animPath, e);
        return null;
      }
    }

    // Reset character to original pose (before animation)
    function resetToOriginalPose() {
      originalTransforms.forEach((transform, nodeName) => {
        const node = character?.getObjectByName(nodeName);
        if (node) {
          node.position.copy(transform.position);
          node.quaternion.copy(transform.quaternion);
        }
      });
    }

    // Change animation
    async function changeAnimation(animPath) {
      currentAnimationPath = animPath;
      animationTime = 0;

      if (!animPath) {
        currentAnimation = null;
        resetToOriginalPose();
        return;
      }

      currentAnimation = await loadAnimation(animPath);
      if (!currentAnimation) {
        console.warn('[ANIMATION] Could not load:', animPath);
      }
    }

    // Catmull-Rom interpolation for smooth keyframes
    function catmullRomInterpolate(p0, p1, p2, p3, t) {
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
      );
    }

    // Find keyframes surrounding the current time for looping animation
    function findKeyframes(keyframes, time, duration) {
      if (!keyframes || keyframes.length === 0) return null;
      if (keyframes.length === 1) {
        return { k1: keyframes[0], k2: keyframes[0], t: 0 };
      }

      // Sort keyframes by time (should already be sorted, but just in case)
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);

      // Find the two keyframes we're between
      let idx1 = -1;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].time <= time) {
          idx1 = i;
        } else {
          break;
        }
      }

      // If time is before first keyframe, interpolate from last to first
      if (idx1 === -1) {
        const k1 = sorted[sorted.length - 1];
        const k2 = sorted[0];
        // Time from last keyframe (wrapping through 0)
        const t1 = k1.time;
        const t2 = k2.time + duration;
        const currentTime = time + duration;
        let t = (t2 - t1) > 0 ? (currentTime - t1) / (t2 - t1) : 0;
        t = Math.max(0, Math.min(1, t));
        return { k1, k2, t, smooth: k1.interpolationType === 'smooth' };
      }

      // If at or after last keyframe, interpolate to first keyframe (loop)
      if (idx1 === sorted.length - 1) {
        const k1 = sorted[idx1];
        const k2 = sorted[0];
        // Time from last keyframe to first (wrapping)
        const timeSpan = (duration - k1.time) + k2.time;
        const elapsed = time - k1.time;
        let t = timeSpan > 0 ? elapsed / timeSpan : 0;
        t = Math.max(0, Math.min(1, t));
        return { k1, k2, t, smooth: k1.interpolationType === 'smooth' };
      }

      // Normal case: between two keyframes
      const k1 = sorted[idx1];
      const k2 = sorted[idx1 + 1];
      const timeSpan = k2.time - k1.time;
      let t = timeSpan > 0 ? (time - k1.time) / timeSpan : 0;
      t = Math.max(0, Math.min(1, t));
      return { k1, k2, t, smooth: k1.interpolationType === 'smooth' };
    }

    // Interpolate quaternion keyframes
    function interpolateQuaternion(keyframes, time, duration) {
      const kf = findKeyframes(keyframes, time, duration);
      if (!kf) return null;

      const { k1, k2, smooth } = kf;
      let t = kf.t;

      const q1 = new THREE.Quaternion(k1.delta.x, k1.delta.y, k1.delta.z, k1.delta.w);
      const q2 = new THREE.Quaternion(k2.delta.x, k2.delta.y, k2.delta.z, k2.delta.w);

      // Apply smoothstep easing for smooth interpolation
      if (smooth) {
        t = t * t * (3 - 2 * t);
      }

      const result = new THREE.Quaternion();
      result.slerpQuaternions(q1, q2, t);
      return result;
    }

    // Interpolate position keyframes
    function interpolatePosition(keyframes, time, duration) {
      const kf = findKeyframes(keyframes, time, duration);
      if (!kf) return null;

      const { k1, k2, smooth } = kf;
      let t = kf.t;

      // Apply smoothstep easing for smooth interpolation
      if (smooth) {
        t = t * t * (3 - 2 * t);
      }

      const v1 = new THREE.Vector3(k1.delta.x, k1.delta.y, k1.delta.z);
      const v2 = new THREE.Vector3(k2.delta.x, k2.delta.y, k2.delta.z);
      const result = new THREE.Vector3();
      result.lerpVectors(v1, v2, t);
      result.multiplyScalar(SCALE);
      return result;
    }

    // Store original transforms for animation blending
    const originalTransforms = new Map();

    // Apply animation to character
    function applyAnimation(animation, time) {
      if (!animation || !animation.nodeAnimations || !character) return;

      const duration = animation.duration;
      // Use modulo for looping, but keep it smooth by using floating point
      const loopTime = ((time % duration) + duration) % duration;

      for (const [nodeName, nodeAnim] of Object.entries(animation.nodeAnimations)) {
        const node = character.getObjectByName(nodeName);
        if (!node) {
          // Only log once per missing bone
          if (!applyAnimation.missingBones) applyAnimation.missingBones = new Set();
          if (!applyAnimation.missingBones.has(nodeName)) {
            console.warn('[ANIMATION] Bone not found:', nodeName);
            applyAnimation.missingBones.add(nodeName);
          }
          continue;
        }

        // Store original transform on first use
        if (!originalTransforms.has(nodeName)) {
          originalTransforms.set(nodeName, {
            position: node.position.clone(),
            quaternion: node.quaternion.clone()
          });
        }
        const original = originalTransforms.get(nodeName);

        // Apply orientation (quaternion) animation
        if (nodeAnim.orientation && nodeAnim.orientation.length > 0) {
          const animQuat = interpolateQuaternion(nodeAnim.orientation, loopTime, duration);
          if (animQuat) {
            // Animation delta is applied on top of original orientation
            node.quaternion.copy(original.quaternion);
            node.quaternion.multiply(animQuat);
          }
        }

        // Apply position animation
        if (nodeAnim.position && nodeAnim.position.length > 0) {
          const animPos = interpolatePosition(nodeAnim.position, loopTime, duration);
          if (animPos) {
            // Animation delta is added to original position
            node.position.copy(original.position);
            node.position.add(animPos);
          }
        }
      }
    }

    async function init() {
      try {
        setLoadingText('Fetching skin data...');
        const response = await fetch('/avatar/' + UUID + '/model');
        if (!response.ok) throw new Error('Failed to load avatar data');
        modelData = await response.json();
        if (modelData.error) throw new Error(modelData.error);

        displaySkinInfo(modelData);
        initThreeJS();

        // Determine which body parts to hide based on equipped cosmetics
        determineHiddenParts(modelData);

        setLoadingText('Building character...');
        await buildCharacter(modelData);

        // Load default animation
        setLoadingText('Loading animation...');
        currentAnimation = await loadAnimation(currentAnimationPath);
        if (currentAnimation) {
          console.log('[ANIMATION] Loaded animation:', currentAnimationPath, 'duration:', currentAnimation.duration, 'frames');
        }

        // Setup animation selector
        document.getElementById('animation-select').addEventListener('change', async function(e) {
          await changeAnimation(e.target.value);
        });

        document.getElementById('loading').style.display = 'none';
        updateStatus('Ready - Drag to rotate');
        lastFrameTime = performance.now();
        animate();
      } catch (err) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = err.message;
        console.error('Error:', err);
      }
    }

    function setLoadingText(text) { document.getElementById('loading-text').textContent = text; }
    function updateStatus(text) { document.getElementById('status').textContent = text; }

    function displaySkinInfo(data) {
      const infoEl = document.getElementById('skin-info');
      const listEl = document.getElementById('parts-list');
      if (!data.parts || Object.keys(data.parts).length === 0) return;
      infoEl.style.display = 'block';
      listEl.innerHTML = '';
      for (const [category, part] of Object.entries(data.parts)) {
        const item = document.createElement('div');
        item.className = 'part-item';
        item.innerHTML = '<div class="part-name">' + category + '</div><div>' + (part.id || category) + (part.colorId ? '.' + part.colorId : '') + '</div>';
        listEl.appendChild(item);
      }
    }

    function determineHiddenParts(data) {
      // Hide body parts covered by clothing
      if (data.parts?.pants || data.parts?.overpants) {
        hiddenBodyParts.add('Pelvis');
        hiddenBodyParts.add('L-Thigh');
        hiddenBodyParts.add('R-Thigh');
        hiddenBodyParts.add('L-Calf');
        hiddenBodyParts.add('R-Calf');
      }
      // Don't hide arms - use polygon offset instead to let clothing cover body naturally
      // Only hide torso parts that are always fully covered
      if (data.parts?.overtop || data.parts?.undertop) {
        hiddenBodyParts.add('Belly');
        hiddenBodyParts.add('Chest');
        // Keep arms visible but push them back in depth buffer
        // so clothing sleeves render in front
        polygonOffsetParts.add('L-Arm');
        polygonOffsetParts.add('R-Arm');
        polygonOffsetParts.add('L-Forearm');
        polygonOffsetParts.add('R-Forearm');
      }
      if (data.parts?.shoes) {
        hiddenBodyParts.add('L-Foot');
        hiddenBodyParts.add('R-Foot');
      }
      // Don't hide hands for gloves - most glove models are accessories (bracelets, etc)
      // that render on top of hands, not full hand replacements
      // if (data.parts?.gloves) {
      //   hiddenBodyParts.add('L-Hand');
      //   hiddenBodyParts.add('R-Hand');
      // }
      // Hide head parts when hair/accessories equipped (but keep face visible)
      if (data.parts?.haircut) {
        hiddenBodyParts.add('HeadTop');
        hiddenBodyParts.add('HairBase');
      }
      console.log('[AVATAR] Hidden body parts:', Array.from(hiddenBodyParts));
      console.log('[AVATAR] Polygon offset parts:', Array.from(polygonOffsetParts));
    }

    function initThreeJS() {
      const container = document.getElementById('canvas-container');
      const width = container.clientWidth, height = container.clientHeight;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0.6, 2.0);
      camera.lookAt(0, 0.5, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      // Better lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
      dirLight.position.set(2, 3, 2);
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(-2, 1, -2);
      scene.add(backLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
      fillLight.position.set(0, -1, 2);
      scene.add(fillLight);

      scene.add(new THREE.GridHelper(2, 10, 0x444444, 0x333333));

      character = new THREE.Group();
      // Rotate character to face camera
      // Hytale character faces +Z, camera is at +Z looking at origin
      // So rotate 180° around Y to face the camera
      character.rotation.y = Math.PI;
      scene.add(character);

      window.addEventListener('resize', () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });

      let isDragging = false, prevX = 0;
      container.addEventListener('mousedown', (e) => { isDragging = true; prevX = e.clientX; autoRotate = false; document.getElementById('toggle-autorotate').classList.remove('active'); });
      window.addEventListener('mouseup', () => isDragging = false);
      window.addEventListener('mousemove', (e) => { if (isDragging) { character.rotation.y += (e.clientX - prevX) * 0.01; prevX = e.clientX; } });
      container.addEventListener('touchstart', (e) => { isDragging = true; prevX = e.touches[0].clientX; autoRotate = false; document.getElementById('toggle-autorotate').classList.remove('active'); });
      container.addEventListener('touchend', () => isDragging = false);
      container.addEventListener('touchmove', (e) => { if (isDragging) { character.rotation.y += (e.touches[0].clientX - prevX) * 0.01; prevX = e.touches[0].clientX; } });

      document.getElementById('rotate-left').onclick = () => { rotationSpeed = -0.05; setTimeout(() => rotationSpeed = 0, 300); };
      document.getElementById('rotate-right').onclick = () => { rotationSpeed = 0.05; setTimeout(() => rotationSpeed = 0, 300); };
      document.getElementById('reset').onclick = () => character.rotation.y = Math.PI; // Face camera (default view)
      document.getElementById('toggle-wireframe').onclick = (e) => {
        wireframeMode = !wireframeMode;
        e.target.classList.toggle('active', wireframeMode);
        character.traverse((c) => { if (c.isMesh) c.material.wireframe = wireframeMode; });
      };
      document.getElementById('toggle-autorotate').onclick = (e) => {
        autoRotate = !autoRotate;
        e.target.classList.toggle('active', autoRotate);
      };
    }

    // Load texture with caching
    async function loadTexture(path) {
      if (textureCache.has(path)) return textureCache.get(path);

      return new Promise((resolve) => {
        const fullPath = path.startsWith('Common/') ? '/asset/' + path : '/asset/Common/' + path;
        textureLoader.load(fullPath,
          (texture) => {
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.generateMipmaps = false;
            textureCache.set(path, texture);
            resolve(texture);
          },
          undefined,
          (err) => {
            const altPath = '/asset/' + path.replace('Common/', '');
            textureLoader.load(altPath,
              (texture) => {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.generateMipmaps = false;
                textureCache.set(path, texture);
                resolve(texture);
              },
              undefined,
              () => resolve(null)
            );
          }
        );
      });
    }

    // Helper to load gradient data
    async function loadGradientData(gradientTexturePath) {
      if (!gradientTexturePath) return null;
      try {
        const gradientTexture = await loadTexture(gradientTexturePath);
        if (gradientTexture && gradientTexture.image) {
          const gradCanvas = document.createElement('canvas');
          gradCanvas.width = gradientTexture.image.width;
          gradCanvas.height = gradientTexture.image.height;
          const gradCtx = gradCanvas.getContext('2d');
          gradCtx.drawImage(gradientTexture.image, 0, 0);
          return gradCtx.getImageData(0, 0, gradCanvas.width, gradCanvas.height);
        }
      } catch (e) {
        console.error('[TINT] Gradient load error:', gradientTexturePath, e);
      }
      return null;
    }

    // Helper to create final texture from canvas
    function createCanvasTexture(canvas) {
      const tintedTexture = new THREE.CanvasTexture(canvas);
      tintedTexture.magFilter = THREE.NearestFilter;
      tintedTexture.minFilter = THREE.NearestFilter;
      tintedTexture.wrapS = THREE.ClampToEdgeWrapping;
      tintedTexture.wrapT = THREE.ClampToEdgeWrapping;
      tintedTexture.generateMipmaps = false;
      tintedTexture.userData = { width: canvas.width, height: canvas.height };
      return tintedTexture;
    }

    /**
     * Hytale-accurate greyscale tinting
     *
     * From BlockyModelFS.glsl:
     *   bool isGreyscale = (texel.r == texel.g) && (texel.g == texel.b);
     *   if(gradientId > 0 && isGreyscale) {
     *     ivec2 coord = ivec2(texel.r * 255, gradientId - 1);
     *     vec3 finalColor = texelFetch(uGradientAtlasTexture, coord, 0).rgb;
     *     outColor0.rgb = finalColor.rgb;
     *   }
     *
     * Rules:
     * 1. ONLY pixels where R == G == B (exactly) are tinted
     * 2. Colored pixels (R != G or G != B) keep their original color
     * 3. The greyscale value (0-255) is used as X coordinate in gradient texture
     */
    async function createTintedTexture(greyscalePath, baseColor, gradientTexturePath = null) {
      const texture = await loadTexture(greyscalePath);
      if (!texture || !texture.image) return null;

      const canvas = document.createElement('canvas');
      const img = texture.image;
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const gradientData = await loadGradientData(gradientTexturePath);
      const color = parseColor(baseColor);

      for (let i = 0; i < data.length; i += 4) {
        const origR = data[i];
        const origG = data[i + 1];
        const origB = data[i + 2];
        const alpha = data[i + 3];

        if (alpha > 0) {
          // Hytale shader: isGreyscale = (texel.r == texel.g) && (texel.g == texel.b)
          // STRICT equality check - only tint true greyscale pixels
          const isGreyscale = (origR === origG) && (origG === origB);

          if (isGreyscale) {
            // Apply gradient tinting using R value as index
            const grey = origR;
            let r, g, b;

            if (gradientData) {
              // Gradient texture lookup: X = greyscale value (0-255)
              const gradX = Math.min(grey, gradientData.width - 1);
              const gradIdx = gradX * 4;
              r = gradientData.data[gradIdx];
              g = gradientData.data[gradIdx + 1];
              b = gradientData.data[gradIdx + 2];
            } else if (color) {
              // Fallback: multiply base color by greyscale intensity
              const t = grey / 255;
              r = Math.round(Math.min(255, color.r * t * 2));
              g = Math.round(Math.min(255, color.g * t * 2));
              b = Math.round(Math.min(255, color.b * t * 2));
            } else {
              // No gradient and no base color - keep as greyscale
              r = grey;
              g = grey;
              b = grey;
            }

            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
          // Non-greyscale pixels (colored): keep original color unchanged
          // This includes fur (blue-tinted), leather (brown), gold buttons, stripes, etc.
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return createCanvasTexture(canvas);
    }

    // Aliases for backward compatibility - all use the same Hytale-accurate tinting
    const createSimpleTintedTexture = createTintedTexture;
    const createCosmeticTintedTexture = createTintedTexture;

    // Create eye shadow texture - converts white eye background to transparent shadow gradient
    // Dark at edges (shadow), fading to transparent in center (where pupil goes)
    async function createEyeShadowTexture(originalTexture) {
      if (!originalTexture || !originalTexture.image) return null;

      const img = originalTexture.image;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw original
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      // Process: convert white areas to shadow gradient
      // Center of each eye region: (1+7, 1+7) = (8, 8) for right eye bg
      const regions = [
        { cx: 8, cy: 8 },   // Right eye background (offset 1,1, size 14x14)
        { cx: 24, cy: 8 },  // Left eye background (offset 17,1, size 14x14) - if exists
      ];

      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // Only process opaque/semi-opaque pixels in the background region (top half)
          if (y < 16 && a > 0) {
            // Determine which eye region this pixel is in
            let localX = -1, localY = -1;
            // Right eye: offset (1,1), size 14x14
            if (x >= 1 && x < 15 && y >= 1 && y < 15) {
              localX = x - 1; // 0-13 within eye region
              localY = y - 1;
            }
            // Left eye: offset (17,1) or similar
            else if (x >= 17 && x < 31 && y >= 1 && y < 15) {
              localX = x - 17;
              localY = y - 1;
            }

            if (localX >= 0 && localY >= 0) {
              // Soft eyelid shadow - very subtle, only at the very top
              const eyeSize = 14;

              // Only shadow in top 4 pixels, fade quickly
              let shadowAlpha = 0;
              if (localY < 4) {
                shadowAlpha = (1 - localY / 4) * 0.25; // max 25% at very top, fades to 0 by row 4
              }

              data[idx] = 0;     // R - black shadow
              data[idx + 1] = 0; // G
              data[idx + 2] = 0; // B
              data[idx + 3] = Math.round(shadowAlpha * 255 * (a / 255));
            } else {
              // Outside eye regions - make transparent
              data[idx + 3] = 0;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return createCanvasTexture(canvas);
    }

    function parseColor(color) {
      if (typeof color === 'number') {
        return {
          r: (color >> 16) & 255,
          g: (color >> 8) & 255,
          b: color & 255
        };
      }
      if (typeof color === 'string') {
        if (color.startsWith('#')) {
          const hex = color.slice(1);
          return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
          };
        }
      }
      if (Array.isArray(color)) {
        return parseColor(color[0]);
      }
      return { r: 200, g: 200, b: 200 };
    }

    async function buildCharacter(data) {
      console.log('[AVATAR] Building character...');
      console.log('[AVATAR] Skin data:', JSON.stringify(data, null, 2));

      const skinColor = getSkinToneColor(data.skinTone);
      const skinColorHex = '#' + skinColor.toString(16).padStart(6, '0');
      const skinToneGradient = getSkinToneGradientPath(data.skinTone);
      console.log('[AVATAR] Skin tone:', data.skinTone, 'color:', skinColorHex, 'gradient:', skinToneGradient);

      // Load base player model
      setLoadingText('Loading player model...');
      try {
        const playerModel = await fetchModel('Common/Characters/Player.blockymodel');
        if (playerModel) {
          const bodyTexturePath = data.bodyType === 'Muscular'
            ? 'Characters/Player_Textures/Player_Muscular_Greyscale.png'
            : 'Characters/Player_Textures/Player_Greyscale.png';

          let bodyTexture = null;
          try {
            console.log('[AVATAR] Loading body texture:', bodyTexturePath);
            console.log('[AVATAR] Tinting with skin color:', skinColorHex, 'gradient:', skinToneGradient);
            bodyTexture = await createTintedTexture(bodyTexturePath, skinColorHex, skinToneGradient);
            console.log('[AVATAR] Body texture created:', bodyTexture ? 'success' : 'null');
          } catch (e) {
            console.error('[AVATAR] Failed to load player body texture:', e);
          }

          await renderPlayerModel(playerModel.nodes, character, skinColor, bodyTexture);
        }
      } catch (e) {
        console.error('[AVATAR] Could not load player model:', e);
      }

      // Cosmetics render order (later = on top)
      const cosmeticOrder = [
        { key: 'underwear', zOffset: 0 },
        { key: 'pants', zOffset: 0.001 },
        { key: 'overpants', zOffset: 0.002 },
        { key: 'shoes', zOffset: 0.001 },
        { key: 'undertop', zOffset: 0.001 },
        { key: 'overtop', zOffset: 0.002 },
        { key: 'gloves', zOffset: 0.001 },
        { key: 'face', zOffset: 0.01 },
        { key: 'mouth', zOffset: 0.015 },
        { key: 'eyes', zOffset: 0.02 },  // In front of face
        { key: 'eyebrows', zOffset: 0.025 },
        { key: 'ears', zOffset: 0 },
        { key: 'haircut', zOffset: 0.005 },
        { key: 'facialHair', zOffset: 0.004 },
        { key: 'headAccessory', zOffset: 0.006 },
        { key: 'faceAccessory', zOffset: 0.005 },
        { key: 'earAccessory', zOffset: 0.001 },
        { key: 'cape', zOffset: -0.001 }
      ];

      for (const { key, zOffset } of cosmeticOrder) {
        const part = data.parts?.[key];
        if (part && part.model) {
          console.log('[COSMETIC]', key, '- model:', part.model);
          setLoadingText('Loading ' + key + '...');

          // Get color for this part
          let color = getPartColor(part);
          if (!color) {
            if (['face', 'ears'].includes(key)) {
              color = skinColor;
            } else {
              color = getDefaultColor(key, skinColor);
            }
          }

          // Determine texture to use
          // Hytale uses strict R==G==B check for greyscale - colored pixels stay unchanged
          let texture = null;

          // Skin parts use skin gradient
          const isSkinPart = part.gradientSet === 'Skin' || ['face', 'ears', 'mouth'].includes(key);

          if (part.texture) {
            // Direct texture - no tinting needed (pre-colored texture)
            try {
              console.log('[COSMETIC]', key, '- loading direct texture:', part.texture);
              texture = await loadTexture(part.texture);
            } catch (e) { console.error('[COSMETIC]', key, '- texture error:', e); }
          } else if (part.greyscaleTexture) {
            // Greyscale texture - apply Hytale-accurate tinting
            // Only pixels where R==G==B are tinted, colored pixels stay unchanged
            try {
              let gradientPath = part.gradientTexture;
              let baseCol = part.baseColor;

              // Skin parts use skin gradient
              if (isSkinPart) {
                gradientPath = skinToneGradient;
                baseCol = skinColorHex;
                color = skinColor;
              }

              // If no color specified, use default color for this part type
              if (!gradientPath && !baseCol) {
                baseCol = '#' + getDefaultColor(key, skinColor).toString(16).padStart(6, '0');
              }

              console.log('[COSMETIC]', key, '- tinting (Hytale-style R==G==B)', gradientPath ? 'with gradient' : 'with color:', baseCol);
              texture = await createTintedTexture(part.greyscaleTexture, baseCol, gradientPath);
            } catch (e) { console.error('[COSMETIC]', key, '- tint error:', e); }
          }

          try {
            let modelPath = part.model;
            if (!modelPath.startsWith('Common/')) modelPath = 'Common/' + modelPath;
            const model = await fetchModel(modelPath);
            if (model) {
              console.log('[COSMETIC]', key, '- loaded, rendering', model.nodes?.length, 'nodes, texture:', texture ? 'yes' : 'no');

              // For eyes, create shadow texture for background
              let shadowTexture = null;
              if (key === 'eyes' && texture) {
                shadowTexture = await createEyeShadowTexture(texture);
              }

              await renderCosmeticModel(model.nodes, character, color, key, texture, zOffset, shadowTexture);
            } else {
              console.error('[COSMETIC]', key, '- model is null for:', modelPath);
            }
          } catch (e) {
            console.error('[COSMETIC]', key, '- error:', e);
          }
        } else if (part) {
          console.log('[COSMETIC]', key, '- skipped (no model):', part);
        }
      }
      console.log('[AVATAR] Character built successfully');
    }

    async function fetchModel(path) {
      const response = await fetch('/asset/' + path);
      if (!response.ok) return null;
      return response.json();
    }

    // Render player body model with skin tone and texture
    async function renderPlayerModel(nodes, parent, skinColor, bodyTexture) {
      if (!nodes) return;
      for (const node of nodes) {
        renderPlayerNode(node, parent, skinColor, bodyTexture, 0);
      }
    }

    function renderPlayerNode(node, parent, skinColor, bodyTexture, depth = 0) {
      const nodeName = node.name || node.id || '';

      // Debug: log when rendering Neck
      if (nodeName === 'Neck') {
        console.log('[DEBUG] Rendering Neck node:', JSON.stringify(node.shape));
        console.log('[DEBUG] Neck has texture:', !!bodyTexture);
      }

      // Skip hidden body parts (but still create group for hierarchy so cosmetics can attach)
      if (hiddenBodyParts.has(nodeName)) {
        const group = new THREE.Group();
        group.name = nodeName;
        applyTransform(group, node);
        parent.add(group);
        if (node.children) {
          for (const child of node.children) {
            renderPlayerNode(child, group, skinColor, bodyTexture, depth + 1);
          }
        }
        return;
      }

      const group = new THREE.Group();
      group.name = nodeName;
      applyTransform(group, node);

      // Create mesh at group origin (offset already included in group position)
      // Use polygon offset for body parts that should render behind clothing
      const usePolygonOffset = polygonOffsetParts.has(nodeName);
      if (node.shape && node.shape.visible !== false && node.shape.type === 'box') {
        const mesh = createBoxMesh(node.shape, skinColor, nodeName, bodyTexture, usePolygonOffset);
        if (mesh) group.add(mesh);
      } else if (node.shape && node.shape.type === 'quad') {
        const mesh = createQuadMesh(node.shape, skinColor, nodeName, bodyTexture);
        if (mesh) group.add(mesh);
      }

      parent.add(group);

      if (node.children) {
        for (const child of node.children) {
          renderPlayerNode(child, group, skinColor, bodyTexture, depth + 1);
        }
      }
    }

    // Render cosmetic model - matches cosmetic bone hierarchy to player bones
    async function renderCosmeticModel(nodes, parent, color, partType, texture, zOffset, shadowTexture = null) {
      if (!nodes) return;
      for (const node of nodes) {
        renderCosmeticNode(node, parent, color, partType, texture, zOffset, 0, shadowTexture);
      }
    }

    // Find a bone by name in the player hierarchy
    function findBoneByName(parent, name) {
      if (!name) return null;

      // Search in the character group
      let found = null;
      parent.traverse((obj) => {
        if (obj.name === name && !found) {
          found = obj;
        }
      });
      return found;
    }

    function renderCosmeticNode(node, parent, color, partType, texture, zOffset, depth = 0, shadowTexture = null) {
      const nodeName = node.name || node.id || '';

      // Try to find matching bone in player skeleton
      let targetParent = parent;
      let attachedToPlayerBone = false;
      if (nodeName) {
        const matchingBone = findBoneByName(character, nodeName);
        if (matchingBone) {
          targetParent = matchingBone;
          attachedToPlayerBone = true;
        }
      }

      const group = new THREE.Group();
      group.name = nodeName + '_cosmetic';

      // When attached to player bone: player bone provides position
      // Don't apply cosmetic's position/offset - it's for cosmetic's own coordinate system
      // When not attached: apply full transform (position + rotation + offset)
      if (attachedToPlayerBone) {
        // Only apply rotation
        if (node.orientation) {
          group.quaternion.set(
            node.orientation.x || 0,
            node.orientation.y || 0,
            node.orientation.z || 0,
            node.orientation.w || 1
          );
        }
      } else {
        applyTransform(group, node);
      }

      // Apply z-offset for layering at group level
      if (zOffset) {
        group.position.z += zOffset;
      }

      // Create mesh at group origin (offset already included in group position)
      if (node.shape && node.shape.visible !== false && node.shape.type !== 'none') {
        let mesh = null;
        if (node.shape.type === 'box') {
          mesh = createBoxMesh(node.shape, color, nodeName, texture);
        } else if (node.shape.type === 'quad') {
          // For eye background, use shadow texture instead of regular texture
          if (partType === 'eyes' && nodeName.includes('Background') && shadowTexture) {
            mesh = createQuadMesh(node.shape, color, nodeName, shadowTexture);
            // Shadow renders behind pupil with transparency
            mesh.renderOrder = 100;
            mesh.material.transparent = true;
            mesh.material.depthWrite = false;
            mesh.material.alphaTest = 0;
            mesh.material.blending = THREE.NormalBlending;
          } else {
            mesh = createQuadMesh(node.shape, color, nodeName, texture);

            // Eye pupil layering
            if (mesh && partType === 'eyes' && nodeName.includes('Eye') && !nodeName.includes('Attachment') && !nodeName.includes('Background')) {
              mesh.renderOrder = 101;
            }
          }

          if (mesh && partType === 'mouth') {
            mesh.renderOrder = 99;
          } else if (mesh && partType === 'face') {
            mesh.renderOrder = 98;
          }
        }
        if (mesh) group.add(mesh);
      }

      targetParent.add(group);

      // Process children
      if (node.children) {
        for (const child of node.children) {
          const childName = child.name || child.id || '';
          const childBone = findBoneByName(character, childName);
          if (childBone) {
            renderCosmeticNode(child, childBone, color, partType, texture, zOffset, depth + 1, shadowTexture);
          } else {
            // No matching bone, add as child of current group
            renderCosmeticNode(child, group, color, partType, texture, 0, depth + 1, shadowTexture);
          }
        }
      }
    }

    function applyTransform(group, node) {
      // Set orientation first (needed for offset transformation)
      if (node.orientation) {
        group.quaternion.set(
          node.orientation.x || 0,
          node.orientation.y || 0,
          node.orientation.z || 0,
          node.orientation.w || 1
        );
      }

      // Set position = node.position + transformed(offset)
      // This follows Hytale pattern: reference.Position += Vector3.Transform(node.Offset, reference.Orientation)
      let posX = (node.position?.x || 0) * SCALE;
      let posY = (node.position?.y || 0) * SCALE;
      let posZ = (node.position?.z || 0) * SCALE;

      if (node.shape && node.shape.offset) {
        const offset = new THREE.Vector3(
          (node.shape.offset.x || 0) * SCALE,
          (node.shape.offset.y || 0) * SCALE,
          (node.shape.offset.z || 0) * SCALE
        );
        offset.applyQuaternion(group.quaternion);
        posX += offset.x;
        posY += offset.y;
        posZ += offset.z;
      }

      group.position.set(posX, posY, posZ);
    }

    // Simple working box mesh - don't overcomplicate with Hytale source matching
    // usePolygonOffset: push body parts back in depth buffer so clothing renders in front
    function createBoxMesh(shape, color, nodeName, texture = null, usePolygonOffset = false) {
      const settings = shape.settings;
      if (!settings || !settings.size) {
        if (nodeName === 'Neck') console.log('[DEBUG] Neck: no settings or size!');
        return null;
      }
      if (nodeName === 'Neck') console.log('[DEBUG] Neck createBoxMesh called, size:', settings.size);

      const stretch = shape.stretch || { x: 1, y: 1, z: 1 };
      const sx = Math.abs(stretch.x || 1);
      const sy = Math.abs(stretch.y || 1);
      const sz = Math.abs(stretch.z || 1);

      // Handle negative stretch by flipping
      const flipX = (stretch.x || 1) < 0;
      const flipY = (stretch.y || 1) < 0;
      const flipZ = (stretch.z || 1) < 0;

      // Size in world units
      const width = settings.size.x * sx * SCALE;
      const height = settings.size.y * sy * SCALE;
      const depth = settings.size.z * sz * SCALE;

      // Size in pixels (for UV calculation)
      const pixelW = settings.size.x;
      const pixelH = settings.size.y;
      const pixelD = settings.size.z;

      const hasTextureLayout = texture && shape.textureLayout && Object.keys(shape.textureLayout).length > 0;
      const geometry = new THREE.BoxGeometry(width, height, depth);

      if (nodeName === 'Neck') {
        console.log('[DEBUG] Neck hasTextureLayout:', hasTextureLayout);
        console.log('[DEBUG] Neck textureLayout:', JSON.stringify(shape.textureLayout));
        console.log('[DEBUG] Neck dimensions (world):', width, height, depth);
        console.log('[DEBUG] Neck pixel sizes:', pixelW, pixelH, pixelD);
        if (texture) {
          console.log('[DEBUG] Neck texture size:', texture.image?.width, texture.image?.height, texture.userData);
        }
      }

      // Apply per-face UV mapping if texture and textureLayout exist
      if (hasTextureLayout) {
        const texW = texture.image?.width || texture.userData?.width;
        const texH = texture.image?.height || texture.userData?.height;

        if (texW && texH) {
          // Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
          // Standard mapping: right, left, top, bottom, front, back
          const faceMap = ['right', 'left', 'top', 'bottom', 'front', 'back'];

          const uvAttr = geometry.getAttribute('uv');
          const uvArray = uvAttr.array;

          for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
            const faceName = faceMap[faceIdx];
            const layout = shape.textureLayout[faceName];

            if (layout && layout.offset) {
              // Match Blockbench Hytale plugin UV calculation exactly
              // https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/blockymodel.ts

              const angle = layout.angle || 0;

              // Get face dimensions (raw pixel size, not stretched)
              // left/right use depth for width, top/bottom use depth for height
              let uv_size = [0, 0];
              if (faceName === 'left' || faceName === 'right') {
                uv_size = [pixelD, pixelH];
              } else if (faceName === 'top' || faceName === 'bottom') {
                uv_size = [pixelW, pixelD];
              } else { // front, back
                uv_size = [pixelW, pixelH];
              }

              // Mirror multipliers: true = -1, false = 1
              let uv_mirror = [
                layout.mirror?.x ? -1 : 1,
                layout.mirror?.y ? -1 : 1
              ];

              const uv_offset = [layout.offset.x, layout.offset.y];

              // Calculate UV result [u1, v1, u2, v2] based on rotation
              // This matches Blockbench plugin's parse() function
              let result;
              switch (angle) {
                case 90: {
                  // Swap size and mirror indices, flip mirror[0]
                  [uv_size[0], uv_size[1]] = [uv_size[1], uv_size[0]];
                  [uv_mirror[0], uv_mirror[1]] = [uv_mirror[1], uv_mirror[0]];
                  uv_mirror[0] *= -1;
                  result = [
                    uv_offset[0],
                    uv_offset[1] + uv_size[1] * uv_mirror[1],
                    uv_offset[0] + uv_size[0] * uv_mirror[0],
                    uv_offset[1]
                  ];
                  break;
                }
                case 180: {
                  uv_mirror[0] *= -1;
                  uv_mirror[1] *= -1;
                  result = [
                    uv_offset[0] + uv_size[0] * uv_mirror[0],
                    uv_offset[1] + uv_size[1] * uv_mirror[1],
                    uv_offset[0],
                    uv_offset[1]
                  ];
                  break;
                }
                case 270: {
                  [uv_size[0], uv_size[1]] = [uv_size[1], uv_size[0]];
                  [uv_mirror[0], uv_mirror[1]] = [uv_mirror[1], uv_mirror[0]];
                  uv_mirror[1] *= -1;
                  result = [
                    uv_offset[0] + uv_size[0] * uv_mirror[0],
                    uv_offset[1],
                    uv_offset[0],
                    uv_offset[1] + uv_size[1] * uv_mirror[1]
                  ];
                  break;
                }
                default: { // 0
                  result = [
                    uv_offset[0],
                    uv_offset[1],
                    uv_offset[0] + uv_size[0] * uv_mirror[0],
                    uv_offset[1] + uv_size[1] * uv_mirror[1]
                  ];
                  break;
                }
              }

              // Convert pixel coords to normalized UV (0-1)
              // Blockbench/Hytale uses Y=0 at top, OpenGL uses Y=0 at bottom
              const u1 = result[0] / texW;
              const v1 = 1.0 - result[1] / texH;
              const u2 = result[2] / texW;
              const v2 = 1.0 - result[3] / texH;

              // Three.js BoxGeometry vertex order per face: TL, TR, BL, BR
              // with default UVs [0,1], [1,1], [0,0], [1,0]
              // Blockbench result is [u1,v1,u2,v2] = [left,top,right,bottom] in image coords
              const baseIdx = faceIdx * 4 * 2;
              uvArray[baseIdx + 0] = u1; uvArray[baseIdx + 1] = v1;  // TL
              uvArray[baseIdx + 2] = u2; uvArray[baseIdx + 3] = v1;  // TR
              uvArray[baseIdx + 4] = u1; uvArray[baseIdx + 5] = v2;  // BL
              uvArray[baseIdx + 6] = u2; uvArray[baseIdx + 7] = v2;  // BR
            }
          }
          uvAttr.needsUpdate = true;
        }
      }

      const needsDoubleSide = flipX || flipY || flipZ;

      let material;
      if (texture) {
        // For body parts, don't use alphaTest - the neck texture region has sparse data
        // but should still render as solid skin-colored mesh
        const isBodyPart = ['Neck', 'Head', 'Chest', 'Belly', 'Pelvis'].includes(nodeName) ||
                           nodeName.includes('Arm') || nodeName.includes('Leg') ||
                           nodeName.includes('Hand') || nodeName.includes('Foot') ||
                           nodeName.includes('Thigh') || nodeName.includes('Calf');
        material = new THREE.MeshLambertMaterial({
          map: texture,
          wireframe: wireframeMode,
          alphaTest: isBodyPart ? 0 : 0.1,
          transparent: !isBodyPart,
          side: needsDoubleSide ? THREE.DoubleSide : THREE.FrontSide,
          depthWrite: true,
          polygonOffset: usePolygonOffset,
          polygonOffsetFactor: usePolygonOffset ? 1 : 0,
          polygonOffsetUnits: usePolygonOffset ? 1 : 0
        });
      } else {
        material = new THREE.MeshLambertMaterial({
          color: color,
          wireframe: wireframeMode,
          side: needsDoubleSide ? THREE.DoubleSide : THREE.FrontSide,
          polygonOffset: usePolygonOffset,
          polygonOffsetFactor: usePolygonOffset ? 1 : 0,
          polygonOffsetUnits: usePolygonOffset ? 1 : 0
        });
      }

      const mesh = new THREE.Mesh(geometry, material);

      // Apply flipping for negative stretch values
      if (flipX) mesh.scale.x = -1;
      if (flipY) mesh.scale.y = -1;
      if (flipZ) mesh.scale.z = -1;

      if (nodeName === 'Neck') {
        console.log('[DEBUG] Neck mesh created successfully');
      }

      return mesh;
    }

    // Simple working quad mesh - use PlaneGeometry like before
    // renderOrder parameter helps with transparent quad layering
    function createQuadMesh(shape, color, nodeName, texture = null, renderOrder = 0) {
      const settings = shape.settings;
      if (!settings || !settings.size) return null;

      const stretch = shape.stretch || { x: 1, y: 1, z: 1 };
      const sx = Math.abs(stretch.x || 1);
      const sy = Math.abs(stretch.y || 1);
      const sz = Math.abs(stretch.z || 1);

      const flipX = (stretch.x || 1) < 0;
      const flipY = (stretch.y || 1) < 0;

      const normal = settings.normal || '+Z';
      const pixelW = settings.size.x;
      const pixelH = settings.size.y;

      // Size in world units
      let width, height;
      if (normal === '+Z' || normal === '-Z') {
        width = pixelW * sx * SCALE;
        height = pixelH * sy * SCALE;
      } else if (normal === '+X' || normal === '-X') {
        width = pixelW * sz * SCALE;
        height = pixelH * sy * SCALE;
      } else { // +Y, -Y
        width = pixelW * sx * SCALE;
        height = pixelH * sz * SCALE;
      }

      const geometry = new THREE.PlaneGeometry(width, height);

      // Apply rotation based on normal direction
      if (normal === '-Z') {
        geometry.rotateY(Math.PI);
      } else if (normal === '+X') {
        geometry.rotateY(Math.PI / 2);
      } else if (normal === '-X') {
        geometry.rotateY(-Math.PI / 2);
      } else if (normal === '+Y') {
        geometry.rotateX(-Math.PI / 2);
      } else if (normal === '-Y') {
        geometry.rotateX(Math.PI / 2);
      }

      // Apply UV mapping if texture and textureLayout exist
      // Match Hytale's SetupQuadUV exactly (ModelRenderer.cs lines 352-386)
      const hasTextureLayout = texture && shape.textureLayout && shape.textureLayout.front;
      if (hasTextureLayout) {
        const texW = texture.image?.width || texture.userData?.width;
        const texH = texture.image?.height || texture.userData?.height;

        if (texW && texH) {
          const layout = shape.textureLayout.front;
          if (layout && layout.offset) {
            const angle = layout.angle || 0;
            const mirrorX = layout.mirror?.x || false;
            const mirrorY = layout.mirror?.y || false;

            // Simple UV calculation: offset is top-left corner in image coords (Y down)
            // Convert to OpenGL coords where V=0 is bottom, V=1 is top
            const x = layout.offset.x;
            const x2 = layout.offset.x + (mirrorX ? -1 : 1) * pixelW;
            // In image coords: offset.y is from top, offset.y + height is bottom
            // In OpenGL: top of region = 1 - offset.y/texH, bottom = 1 - (offset.y + height)/texH
            const vTop = 1.0 - layout.offset.y / texH;
            const vBottom = 1.0 - (layout.offset.y + (mirrorY ? -1 : 1) * pixelH) / texH;

            // UV corners: TL, TR, BL, BR (in screen space, matching PlaneGeometry vertex order)
            let uvs = [
              [x / texW, vTop],           // TL: left edge, top edge
              [x2 / texW, vTop],          // TR: right edge, top edge
              [x / texW, vBottom],        // BL: left edge, bottom edge
              [x2 / texW, vBottom]        // BR: right edge, bottom edge
            ];

            // Apply rotation if needed
            if (angle !== 0) {
              const cx = (x + x2) / 2 / texW;  // center U
              const cy = (vTop + vBottom) / 2;  // center V
              const rad = -angle * Math.PI / 180;  // negative because we rotate UVs opposite to visual rotation
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);
              uvs = uvs.map(function(uv) {
                const du = uv[0] - cx;
                const dv = uv[1] - cy;
                return [cx + du * cos - dv * sin, cy + du * sin + dv * cos];
              });
            }

            // PlaneGeometry vertices: TopLeft(0), TopRight(1), BottomLeft(2), BottomRight(3)
            // Map Hytale order [TR, TL, BL, BR] to PlaneGeometry order [TL, TR, BL, BR]
            // PlaneGeometry vertex order: TL(0), TR(1), BL(2), BR(3)
            // Our uvs array is already in this order: [TL, TR, BL, BR]
            const newUVs = new Float32Array([
              uvs[0][0], uvs[0][1],  // vertex 0: TL
              uvs[1][0], uvs[1][1],  // vertex 1: TR
              uvs[2][0], uvs[2][1],  // vertex 2: BL
              uvs[3][0], uvs[3][1]   // vertex 3: BR
            ]);
            geometry.setAttribute('uv', new THREE.BufferAttribute(newUVs, 2));

          }
        }
      }

      let material;
      if (texture) {
        material = new THREE.MeshLambertMaterial({
          map: texture,
          wireframe: wireframeMode,
          alphaTest: 0.5,
          transparent: false,
          side: THREE.DoubleSide,
          depthWrite: true,
          depthTest: true
        });
      } else {
        material = new THREE.MeshLambertMaterial({
          color: color,
          wireframe: wireframeMode,
          side: THREE.DoubleSide
        });
      }

      const mesh = new THREE.Mesh(geometry, material);

      // Set render order for proper layering
      if (renderOrder !== 0) {
        mesh.renderOrder = renderOrder;
      }

      // Apply flipping for negative stretch
      if (flipX) mesh.scale.x = -1;
      if (flipY) mesh.scale.y = -1;

      return mesh;
    }

    // Official skin tone data from GradientSets.json
    const SKIN_TONES = {
      // Human/realistic skin tones (01-18, 27, 48, 52)
      '01': { color: 0xf4c39a, texture: 'TintGradients/Skin_Tones/01.png' }, // Light peach
      '02': { color: 0xf5c490, texture: 'TintGradients/Skin_Tones/02.png' }, // Warm peach
      '03': { color: 0xe0ae72, texture: 'TintGradients/Skin_Tones/03.png' }, // Light tan
      '04': { color: 0xba7f5b, texture: 'TintGradients/Skin_Tones/04.png' }, // Medium tan
      '05': { color: 0x945d44, texture: 'TintGradients/Skin_Tones/05.png' }, // Brown
      '06': { color: 0x6f3b2c, texture: 'TintGradients/Skin_Tones/06.png' }, // Dark brown
      '07': { color: 0x4f2a24, texture: 'TintGradients/Skin_Tones/07.png' }, // Very dark brown
      '08': { color: 0xdcc7a8, texture: 'TintGradients/Skin_Tones/08.png' }, // Pale olive
      '09': { color: 0xf5bc83, texture: 'TintGradients/Skin_Tones/09.png' }, // Golden
      '10': { color: 0xd98c5b, texture: 'TintGradients/Skin_Tones/10.png' }, // Warm tan
      '11': { color: 0xab7a4c, texture: 'TintGradients/Skin_Tones/11.png' }, // Caramel
      '12': { color: 0x7d432b, texture: 'TintGradients/Skin_Tones/12.png' }, // Chestnut
      '13': { color: 0x513425, texture: 'TintGradients/Skin_Tones/13.png' }, // Dark chestnut
      '14': { color: 0x31221f, texture: 'TintGradients/Skin_Tones/14.png' }, // Near black
      '15': { color: 0xd5a082, texture: 'TintGradients/Skin_Tones/15.png' }, // Rose beige
      '16': { color: 0x63492f, texture: 'TintGradients/Skin_Tones/16.png' }, // Olive brown
      '17': { color: 0x5e3a2f, texture: 'TintGradients/Skin_Tones/17.png' }, // Warm brown
      '18': { color: 0x4d272b, texture: 'TintGradients/Skin_Tones/18.png' }, // Dark reddish
      '27': { color: 0x765e48, texture: 'TintGradients/Skin_Tones/27.png' }, // Taupe
      '48': { color: 0xdcc5b0, texture: 'TintGradients/Skin_Tones/48.png' }, // Light beige
      '52': { color: 0x131111, texture: 'TintGradients/Skin_Tones/52.png' }, // Black
      // Fantasy skin tones - Blue (19, 25, 32, 33, 42)
      '19': { color: 0x8aacfb, texture: 'TintGradients/Skin_Tones/19.png' }, // Light blue
      '25': { color: 0x4354e6, texture: 'TintGradients/Skin_Tones/25.png' }, // Bright blue
      '32': { color: 0x3276c3, texture: 'TintGradients/Skin_Tones/32.png' }, // Medium blue
      '33': { color: 0x092029, texture: 'TintGradients/Skin_Tones/33.png' }, // Dark blue/teal
      '42': { color: 0xa0dfff, texture: 'TintGradients/Skin_Tones/42.png' }, // Pale ice blue
      // Fantasy skin tones - Purple (20, 26, 46, 47, 49)
      '20': { color: 0xa78af1, texture: 'TintGradients/Skin_Tones/20.png' }, // Light purple
      '26': { color: 0x6c2abd, texture: 'TintGradients/Skin_Tones/26.png' }, // Deep purple
      '46': { color: 0xddbfe8, texture: 'TintGradients/Skin_Tones/46.png' }, // Lavender
      '47': { color: 0xf0b9f2, texture: 'TintGradients/Skin_Tones/47.png' }, // Light lavender
      '49': { color: 0xec6ff7, texture: 'TintGradients/Skin_Tones/49.png' }, // Bright pink/purple
      // Fantasy skin tones - Green (22, 30, 35, 45)
      '22': { color: 0x9bc55d, texture: 'TintGradients/Skin_Tones/22.png' }, // Light green
      '30': { color: 0x50843a, texture: 'TintGradients/Skin_Tones/30.png' }, // Dark green (orc)
      '35': { color: 0x5eae37, texture: 'TintGradients/Skin_Tones/35.png' }, // Bright green (goblin)
      '45': { color: 0xd5f0a0, texture: 'TintGradients/Skin_Tones/45.png' }, // Pale green
      // Fantasy skin tones - Red/Pink (21, 31, 36, 38, 41)
      '21': { color: 0xfc8572, texture: 'TintGradients/Skin_Tones/21.png' }, // Coral/salmon
      '31': { color: 0xb22a2a, texture: 'TintGradients/Skin_Tones/31.png' }, // Red (demon)
      '36': { color: 0xff72c2, texture: 'TintGradients/Skin_Tones/36.png' }, // Hot pink
      '38': { color: 0x6c3f40, texture: 'TintGradients/Skin_Tones/38.png' }, // Dark reddish brown
      '41': { color: 0xff95cd, texture: 'TintGradients/Skin_Tones/41.png' }, // Light pink
      // Fantasy skin tones - Other (28, 29, 37, 39, 50, 51)
      '28': { color: 0xf3f3f3, texture: 'TintGradients/Skin_Tones/28.png' }, // White/pale
      '29': { color: 0x998d71, texture: 'TintGradients/Skin_Tones/29.png' }, // Olive/stone
      '37': { color: 0xf4c944, texture: 'TintGradients/Skin_Tones/37.png' }, // Yellow/gold
      '39': { color: 0xff9c5b, texture: 'TintGradients/Skin_Tones/39.png' }, // Orange
      '50': { color: 0x2b2b2f, texture: 'TintGradients/Skin_Tones/50.png' }, // Dark grey
      '51': { color: 0xf06f47, texture: 'TintGradients/Skin_Tones/51.png' }, // Deep orange
    };

    // Friendly aliases for skin tones
    const SKIN_TONE_ALIASES = {
      // Human-readable names
      'LightPeach': '01', 'WarmPeach': '02', 'LightTan': '03', 'MediumTan': '04',
      'Brown': '05', 'DarkBrown': '06', 'VeryDarkBrown': '07', 'PaleOlive': '08',
      'Golden': '09', 'WarmTan': '10', 'Caramel': '11', 'Chestnut': '12',
      'DarkChestnut': '13', 'NearBlack': '14', 'RoseBeige': '15',
      // Legacy names for backwards compatibility
      'Warm1': '01', 'Warm2': '02', 'Warm3': '03', 'Warm4': '04', 'Warm5': '05',
      'Cool1': '06', 'Cool2': '07', 'Cool3': '08', 'Cool4': '09', 'Cool5': '10',
      'Neutral1': '11', 'Neutral2': '12', 'Neutral3': '13', 'Neutral4': '14', 'Neutral5': '15',
      // Fantasy race shortcuts
      'Orc': '30', 'Goblin': '35', 'LightOrc': '22', 'DarkOrc': '30',
      'IceElf': '42', 'DarkElf': '26', 'NightElf': '33', 'HighElf': '46',
      'Demon': '31', 'Tiefling': '21', 'FireDemon': '31',
      'Undead': '50', 'Zombie': '29', 'Ghost': '28', 'Vampire': '52',
      'Fairy': '47', 'Pixie': '49', 'Dryad': '45',
      'Dwarf': '04', 'Gnome': '39',
      // Color-based shortcuts
      'Green': '35', 'LightGreen': '22', 'DarkGreen': '30', 'PaleGreen': '45',
      'Blue': '32', 'LightBlue': '19', 'DarkBlue': '33', 'IceBlue': '42',
      'Purple': '26', 'LightPurple': '20', 'Lavender': '46',
      'Red': '31', 'Pink': '36', 'LightPink': '41',
      'White': '28', 'Grey': '50', 'Black': '52',
      'Yellow': '37', 'Gold': '37', 'Orange': '39',
    };

    function getSkinToneColor(tone) {
      // Check if it's a direct ID (01-52)
      if (SKIN_TONES[tone]) {
        return SKIN_TONES[tone].color;
      }
      // Check aliases
      const aliasId = SKIN_TONE_ALIASES[tone];
      if (aliasId && SKIN_TONES[aliasId]) {
        return SKIN_TONES[aliasId].color;
      }
      // Default to light peach
      return SKIN_TONES['01'].color;
    }

    function getSkinToneGradientPath(tone) {
      // Check if it's a direct ID (01-52)
      if (SKIN_TONES[tone]) {
        return SKIN_TONES[tone].texture;
      }
      // Check aliases
      const aliasId = SKIN_TONE_ALIASES[tone];
      if (aliasId && SKIN_TONES[aliasId]) {
        return SKIN_TONES[aliasId].texture;
      }
      // Default to light peach
      return SKIN_TONES['01'].texture;
    }

    function getPartColor(part) {
      if (!part) return null;
      if (part.baseColor) {
        const bc = Array.isArray(part.baseColor) ? part.baseColor[0] : part.baseColor;
        if (typeof bc === 'string' && bc.startsWith('#')) {
          return parseInt(bc.slice(1), 16);
        }
      }
      return null;
    }

    function getDefaultColor(type, skinColor) {
      const defaults = {
        'haircut': 0x4a3728, 'facialHair': 0x4a3728, 'eyebrows': 0x4a3728,
        'pants': 0x2c3e50, 'overpants': 0x34495e,
        'undertop': 0x5dade2, 'overtop': 0x2980b9,
        'shoes': 0x1a1a1a, 'gloves': 0x8b4513,
        'face': skinColor, 'mouth': 0xc0392b, 'ears': skinColor,
        'eyes': 0x3498db,
        'underwear': 0xecf0f1,
        'cape': 0x8e44ad,
        'headAccessory': 0xf1c40f, 'faceAccessory': 0xbdc3c7, 'earAccessory': 0xf1c40f
      };
      return defaults[type] || 0x888888;
    }

    function animate() {
      requestAnimationFrame(animate);

      // Update animation time
      const now = performance.now();
      const deltaTime = (now - lastFrameTime) / 1000; // seconds
      lastFrameTime = now;

      // Apply current animation
      if (animationEnabled && currentAnimation) {
        // Clamp delta time to prevent large jumps (e.g., when tab is backgrounded)
        const clampedDelta = Math.min(deltaTime, 0.1); // Max 100ms per frame
        animationTime += clampedDelta * FPS; // Convert to frames
        if (currentAnimation.holdLastKeyframe) {
          animationTime = Math.min(animationTime, currentAnimation.duration);
        }
        // applyAnimation handles looping internally with smooth interpolation
        applyAnimation(currentAnimation, animationTime);
      }

      if (autoRotate) character.rotation.y += 0.005;
      else if (rotationSpeed) character.rotation.y += rotationSpeed;
      renderer.render(scene, camera);
    }

    // Debug function - call from console: debugHierarchy()
    window.debugHierarchy = function() {
      console.log('=== CHARACTER HIERARCHY DEBUG ===');
      const bones = ['Origin', 'Pelvis', 'Belly', 'Chest', 'Head', 'L-Shoulder', 'R-Shoulder', 'L-Thigh', 'R-Thigh'];
      bones.forEach(name => {
        const obj = scene.getObjectByName(name);
        if (obj) {
          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          const localPos = obj.position;
          const parent = obj.parent ? obj.parent.name : 'none';
          console.log(name + ':');
          console.log('  local: (' + localPos.x.toFixed(3) + ', ' + localPos.y.toFixed(3) + ', ' + localPos.z.toFixed(3) + ')');
          console.log('  world: (' + worldPos.x.toFixed(3) + ', ' + worldPos.y.toFixed(3) + ', ' + worldPos.z.toFixed(3) + ')');
          console.log('  parent: ' + parent);
        } else {
          console.log(name + ': NOT FOUND');
        }
      });
      console.log('=== END DEBUG ===');
    };

    // Debug function - call from console: debugMeshes()
    window.debugMeshes = function() {
      console.log('=== MESH DEBUG ===');
      character.traverse(obj => {
        if (obj.isMesh) {
          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          const bbox = new THREE.Box3().setFromObject(obj);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          console.log(obj.name || '(unnamed mesh)' + ':');
          console.log('  world pos: (' + worldPos.x.toFixed(3) + ', ' + worldPos.y.toFixed(3) + ', ' + worldPos.z.toFixed(3) + ')');
          console.log('  bbox size: (' + size.x.toFixed(3) + ', ' + size.y.toFixed(3) + ', ' + size.z.toFixed(3) + ')');
        }
      });
      console.log('=== END MESH DEBUG ===');
    };

    // Debug specific bone group (e.g., "Head") to check pivot vs mesh offset
    window.debugBoneGroup = function(boneName = 'Head') {
      console.log('=== DEBUG BONE GROUP: ' + boneName + ' ===');
      const boneGroup = scene.getObjectByName(boneName);
      if (!boneGroup) {
        console.log('Bone not found: ' + boneName);
        return;
      }

      const groupWorldPos = new THREE.Vector3();
      boneGroup.getWorldPosition(groupWorldPos);
      console.log('Group (pivot) world pos:', groupWorldPos.x.toFixed(3), groupWorldPos.y.toFixed(3), groupWorldPos.z.toFixed(3));
      console.log('Group local pos:', boneGroup.position.x.toFixed(3), boneGroup.position.y.toFixed(3), boneGroup.position.z.toFixed(3));

      boneGroup.children.forEach((child, idx) => {
        if (child.isMesh) {
          const meshWorldPos = new THREE.Vector3();
          child.getWorldPosition(meshWorldPos);
          const params = child.geometry.parameters;

          console.log('');
          console.log('Mesh ' + idx + ' (' + (child.parent?.name || 'unnamed') + '):');
          console.log('  Local Pos:', child.position.x.toFixed(3), child.position.y.toFixed(3), child.position.z.toFixed(3));
          console.log('  World Pos:', meshWorldPos.x.toFixed(3), meshWorldPos.y.toFixed(3), meshWorldPos.z.toFixed(3));
          console.log('  Geometry Size:', params?.width?.toFixed(3), params?.height?.toFixed(3), params?.depth?.toFixed(3));
          console.log('  Scale:', child.scale.x.toFixed(2), child.scale.y.toFixed(2), child.scale.z.toFixed(2));

          // Check offset from pivot
          const offsetFromPivot = new THREE.Vector3().subVectors(meshWorldPos, groupWorldPos);
          console.log('  Offset from pivot:', offsetFromPivot.x.toFixed(3), offsetFromPivot.y.toFixed(3), offsetFromPivot.z.toFixed(3));
        } else if (child.isGroup) {
          console.log('');
          console.log('Nested Group: ' + child.name);
        }
      });
      console.log('=== END BONE GROUP DEBUG ===');
    };

    // Debug arm chain specifically
    window.debugArms = function() {
      console.log('=== ARM CHAIN DEBUG ===');
      const armBones = ['L-Shoulder', 'L-Arm', 'L-Forearm', 'L-Hand', 'R-Shoulder', 'R-Arm', 'R-Forearm', 'R-Hand'];
      armBones.forEach(name => {
        const bone = scene.getObjectByName(name);
        if (bone) {
          const worldPos = new THREE.Vector3();
          bone.getWorldPosition(worldPos);
          const euler = new THREE.Euler().setFromQuaternion(bone.quaternion);
          console.log(name + ':');
          console.log('  local: (' + bone.position.x.toFixed(3) + ', ' + bone.position.y.toFixed(3) + ', ' + bone.position.z.toFixed(3) + ')');
          console.log('  world: (' + worldPos.x.toFixed(3) + ', ' + worldPos.y.toFixed(3) + ', ' + worldPos.z.toFixed(3) + ')');
          console.log('  rot(deg): (' + (euler.x * 180/Math.PI).toFixed(1) + ', ' + (euler.y * 180/Math.PI).toFixed(1) + ', ' + (euler.z * 180/Math.PI).toFixed(1) + ')');
          console.log('  parent: ' + (bone.parent?.name || 'none'));
        }
      });
      console.log('=== END ARM DEBUG ===');
    };

    // Debug all cosmetic pieces (find by _cosmetic suffix)
    window.debugCosmetics = function() {
      console.log('=== COSMETIC DEBUG ===');
      character.traverse((obj) => {
        if (obj.name && obj.name.endsWith('_cosmetic')) {
          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          const euler = new THREE.Euler().setFromQuaternion(obj.quaternion);
          console.log(obj.name + ':');
          console.log('  local pos: (' + obj.position.x.toFixed(3) + ', ' + obj.position.y.toFixed(3) + ', ' + obj.position.z.toFixed(3) + ')');
          console.log('  world pos: (' + worldPos.x.toFixed(3) + ', ' + worldPos.y.toFixed(3) + ', ' + worldPos.z.toFixed(3) + ')');
          console.log('  rotation (deg): (' + (euler.x * 180/Math.PI).toFixed(1) + ', ' + (euler.y * 180/Math.PI).toFixed(1) + ', ' + (euler.z * 180/Math.PI).toFixed(1) + ')');
          console.log('  parent: ' + (obj.parent?.name || 'none'));
          // Show meshes in this group
          obj.children.forEach((child, i) => {
            if (child.isMesh) {
              const meshWorld = new THREE.Vector3();
              child.getWorldPosition(meshWorld);
              console.log('  mesh[' + i + '] local: (' + child.position.x.toFixed(3) + ', ' + child.position.y.toFixed(3) + ', ' + child.position.z.toFixed(3) + ')');
              console.log('  mesh[' + i + '] world: (' + meshWorld.x.toFixed(3) + ', ' + meshWorld.y.toFixed(3) + ', ' + meshWorld.z.toFixed(3) + ')');
            }
          });
        }
      });
      console.log('=== END COSMETIC DEBUG ===');
    };

    init();
  </script>
</body>
</html>`;
}

// Start server
console.log('=== Hytale Auth Server ===');
console.log(`Domain: ${DOMAIN}`);
console.log(`Data directory: ${DATA_DIR}`);
console.log(`Assets path: ${ASSETS_PATH}`);

// Pre-load cosmetics on startup
if (fs.existsSync(ASSETS_PATH)) {
  console.log('Assets.zip found, loading cosmetics...');
  loadCosmeticsFromAssets();
} else {
  console.log('Assets.zip not found, using fallback cosmetics');
}

const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  - sessions.${DOMAIN}`);
  console.log(`  - account-data.${DOMAIN}`);
  console.log(`  - telemetry.${DOMAIN}`);
  console.log(`  - Avatar viewer: /avatar/{uuid}`);
  console.log(`  - Avatar customizer: /customizer/{uuid}`);
  console.log(`  - Cosmetics list: /cosmetics/list`);
  console.log(`  - Asset extraction: /asset/{path}`);
});
