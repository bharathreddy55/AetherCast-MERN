const { resolveOwnerProfile } = require('../services/ownerProfile');
const { requireOwnerIdentity } = require('../config/privateAccess');
const { verifySupabaseToken } = require('../utils/supabaseTokens');

const accessError = (status, message) => Object.assign(new Error(message), { status });
const authenticateOwnerToken = async token => {
  if (typeof token !== 'string' || !token || token.length > 16384) throw accessError(401, 'Not authorized, token missing');
  let decoded;
  try { decoded = await verifySupabaseToken(token); }
  catch (error) {
    const reason = error.code === 'AUTH_CONFIGURATION' ? 'server_configuration'
      : error.code === 'AUTH_PROVIDER_UNAVAILABLE' ? 'signing_keys_unavailable'
      : error.name === 'TokenExpiredError' ? 'expired_token'
      : error.name === 'JsonWebTokenError' ? 'invalid_token_claims_or_signature' : 'unsupported_token_or_key';
    console.warn('Owner authentication failed', { stage: 'token_verification', reason });
    if (error.code === 'AUTH_CONFIGURATION') throw accessError(503, 'Server sign-in configuration is incomplete. Check the backend Supabase project and signing settings.');
    if (error.code === 'AUTH_PROVIDER_UNAVAILABLE') throw accessError(503, 'Sign-in verification is temporarily unavailable. Please try again shortly.');
    throw accessError(401, 'Your sign-in session could not be verified. Sign in again; if this continues, check the backend Supabase signing settings.');
  }
  requireOwnerIdentity(decoded);

  // Supabase payload contains email in decoded.email
  const email = decoded.email;

  if (typeof email !== 'string' || !email.trim()) {
    throw accessError(401, 'Invalid token payload');
  }

  // Prefer the immutable provider identity. Email lookup is only a migration
  // path for an existing profile which has not been bound to Supabase yet.
  try {
    const user = await resolveOwnerProfile(decoded);

    return { user, expiresAt: decoded.exp * 1000 };
  } catch (error) {
    if (error.status) throw error;
    const reason = error.code === 11000 ? 'duplicate_profile' : error.name === 'ValidationError' ? 'invalid_profile'
      : ['MongoServerSelectionError', 'MongoNetworkError', 'MongooseServerSelectionError'].includes(error.name) ? 'database_unavailable' : 'profile_storage_error';
    const fields = error.code === 11000 ? Object.keys(error.keyPattern || error.keyValue || {}).map(field => ['username', 'email', 'supabaseUserId', 'googleId'].includes(field) ? field : 'other') : [];
    console.error('Owner authentication failed', { stage: 'profile_sync', reason, ...(fields.length ? { fields } : {}) });
    throw accessError(503, 'You signed in successfully, but your library profile could not be loaded. Check the backend database and profile setup.');
  }
};

const requestToken = req => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  return match?.[1] || req.cookies?.accessToken;
};

const protect = async (req, res, next) => {
  if (req.user) return next();
  try {
    const session = await authenticateOwnerToken(requestToken(req));
    req.user = session.user;
    next();
  } catch (error) {
    return res.status(error.status || 401).json({ success: false,
      message: error.status ? error.message : 'Not authorized, token failed' });
  }
};

const optionalProtect = async (req, _res, next) => {
  if (req.user) return next();
  try { req.user = (await authenticateOwnerToken(requestToken(req))).user; }
  catch { /* Public compatibility routes are protected by the application gate. */ }
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

module.exports = { protect, authorize, optionalProtect, authenticateOwnerToken };
