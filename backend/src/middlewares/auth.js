const User = require('../models/User');
const crypto = require('crypto');
const { requireOwnerIdentity } = require('../config/privateAccess');

const { verifySupabaseToken } = require('../utils/supabaseTokens');

const protect = async (req, res, next) => {
  if (req.user) return next();
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
    requireOwnerIdentity(decoded);
    
    // Supabase payload contains email in decoded.email
    const email = decoded.email;

    if (!email) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    // Prefer the immutable provider identity. Email lookup is only a migration
    // path for an existing profile which has not been bound to Supabase yet.
    let user = await User.findOne({ supabaseUserId: decoded.sub });
    if (!user) user = await User.findOne({ email });

    if (user?.supabaseUserId && user.supabaseUserId !== decoded.sub) {
      return res.status(403).json({ success: false, message: 'This profile belongs to a different account' });
    }

    if (user && user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended' });
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
        return res.status(403).json({ success: false, message: 'Unable to link this owner profile' });
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

    req.user = user;
    next();
  } catch (error) {
    const status = error.status || 401;
    return res.status(status).json({ success: false, message: error.status ? error.message : 'Not authorized, token failed' });
  }
};

const optionalProtect = async (req, res, next) => {
  if (req.user) return next();
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
    requireOwnerIdentity(decoded);
    
    const email = decoded.email;
    if (email) {
      const user = await User.findOne({ email });
      if (user && user.accountStatus !== 'suspended') {
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
