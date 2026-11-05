const User = require('../models/User');
const crypto = require('crypto');
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

  if (!email) {
    throw accessError(401, 'Invalid token payload');
  }

  // Prefer the immutable provider identity. Email lookup is only a migration
  // path for an existing profile which has not been bound to Supabase yet.
  try {
    let user = await User.findOne({ supabaseUserId: decoded.sub });
    if (!user) user = await User.findOne({ email });

    if (user?.supabaseUserId && user.supabaseUserId !== decoded.sub) {
      throw accessError(403, 'This profile belongs to a different account');
    }

    if (user && user.accountStatus === 'suspended') {
      throw accessError(403, 'Your account has been suspended');
    }

    if (user && !user.supabaseUserId) {
      user = await User.findOneAndUpdate(
        { _id: user._id, supabaseUserId: { $exists: false } },
        { $set: { supabaseUserId: decoded.sub } },
        { new: true, runValidators: true, overwriteImmutable: true },
      );
      // Concurrent first requests may have already linked the same profile.
      if (!user) user = await User.findOne({ supabaseUserId: decoded.sub });
      if (!user || user.accountStatus === 'suspended') {
        throw accessError(403, 'Unable to link this owner profile');
      }
    }

    // If user profile doesn't exist in MongoDB (first-time Supabase sign up / Google login), sync it
    if (!user) {
      const username = decoded.user_metadata?.username || email.split('@')[0] + Math.floor(100 + Math.random() * 900);
      const name = decoded.user_metadata?.full_name || decoded.user_metadata?.name || email.split('@')[0];
      const avatar = decoded.user_metadata?.avatar_url || '';
      const role = 'listener';
      const bio = decoded.user_metadata?.bio || '';

      user = await User.create({
        supabaseUserId: decoded.sub,
        username,
        name,
        email,
        password: crypto.randomBytes(32).toString('hex'), // Unused by Supabase sign-in
        role,
        bio,
        avatar,
        isVerified: true, // Supabase handles verification
      });
    }

    return { user, expiresAt: decoded.exp * 1000 };
  } catch (error) {
    if (error.status) throw error;
    const reason = error.code === 11000 ? 'duplicate_profile' : error.name === 'ValidationError' ? 'invalid_profile'
      : ['MongoServerSelectionError', 'MongoNetworkError', 'MongooseServerSelectionError'].includes(error.name) ? 'database_unavailable' : 'profile_storage_error';
    console.error('Owner authentication failed', { stage: 'profile_sync', reason });
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
