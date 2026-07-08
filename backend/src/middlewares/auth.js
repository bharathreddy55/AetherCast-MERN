const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');

let cachedJWKS = null;
let lastJWKSFetch = 0;

const getSupabaseJWKS = async () => {
  const now = Date.now();
  if (cachedJWKS && (now - lastJWKSFetch < 3600000)) {
    return cachedJWKS;
  }

  try {
    const rawUrl = process.env.SUPABASE_URL || 'https://qapyqxqdswrocuoutdfs.supabase.co';
    const jwksUrl = `${rawUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
    const anonKey = process.env.SUPABASE_ANON_KEY || '';

    const headers = {};
    if (anonKey) {
      headers['apikey'] = anonKey;
      headers['Authorization'] = `Bearer ${anonKey}`;
    }

    const res = await fetch(jwksUrl, { headers });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data && data.keys) {
      cachedJWKS = data.keys;
      lastJWKSFetch = now;
      return cachedJWKS;
    }
    throw new Error('Invalid JWKS response');
  } catch (err) {
    console.error('Failed to fetch Supabase JWKS:', err.message);
    if (cachedJWKS) return cachedJWKS;
    throw err;
  }
};

const verifySupabaseToken = async (token) => {
  const decodedToken = jwt.decode(token, { complete: true });
  if (!decodedToken) {
    throw new Error('Invalid token format');
  }

  const { alg, kid } = decodedToken.header;
  
  // Whitelist algorithms to prevent algorithm confusion/signature bypass attacks
  if (alg !== 'ES256' && alg !== 'HS256') {
    throw new Error(`Unsupported JWT algorithm: ${alg}`);
  }

  let secretOrPublicKey;

  if (alg === 'ES256') {
    const keys = await getSupabaseJWKS();
    const jwk = keys.find(k => k.kid === kid);
    if (!jwk) {
      throw new Error(`JWK for kid ${kid} not found`);
    }
    secretOrPublicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } else {
    const rawSecret = process.env.SUPABASE_JWT_SECRET || 'your-supabase-jwt-secret-here';
    
    // Prevent fallback secret in production
    if (process.env.NODE_ENV === 'production' && rawSecret === 'your-supabase-jwt-secret-here') {
      throw new Error('SUPABASE_JWT_SECRET environment variable is missing in production!');
    }

    secretOrPublicKey = rawSecret.length > 40 ? Buffer.from(rawSecret, 'base64') : rawSecret;
  }

  return jwt.verify(token, secretOrPublicKey, { algorithms: [alg] });
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
  }

  try {
    const decoded = await verifySupabaseToken(token);
    
    // Supabase payload contains email in decoded.email
    const email = decoded.email;

    if (!email) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    // Lookup user in MongoDB by email
    let user = await User.findOne({ email });

    // If user profile doesn't exist in MongoDB (first-time Supabase sign up / Google login), sync it
    if (!user) {
      const username = decoded.user_metadata?.username || email.split('@')[0] + Math.floor(100 + Math.random() * 900);
      const name = decoded.user_metadata?.full_name || decoded.user_metadata?.name || email.split('@')[0];
      const avatar = decoded.user_metadata?.avatar_url || '';
      const role = decoded.user_metadata?.role || 'listener';
      const bio = decoded.user_metadata?.bio || '';

      user = await User.create({
        username,
        name,
        email,
        password: Math.random().toString(36).slice(-10), // Random password placeholder
        role,
        bio,
        avatar,
        isVerified: true, // Supabase handles verification
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Supabase JWT Verification Error:', error.message, 'Token preview:', token ? `${token.substring(0, 15)}... (len: ${token.length})` : 'none');
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const optionalProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token || token === 'null' || token === 'undefined') {
    return next();
  }

  try {
    const decoded = await verifySupabaseToken(token);
    
    const email = decoded.email;
    if (email) {
      const user = await User.findOne({ email });
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Token is invalid or expired; proceed as guest
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize, optionalProtect };
