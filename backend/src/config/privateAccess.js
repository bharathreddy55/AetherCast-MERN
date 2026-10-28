// The owner must be configured explicitly; never claim ownership from a login
// request, an email address, or user-editable authentication metadata.
const getOwnerId = () => (process.env.OWNER_SUPABASE_USER_ID || '').trim();

const requireOwnerIdentity = (claims) => {
  const ownerId = getOwnerId();
  if (!ownerId) {
    const error = new Error('Private library owner is not configured.');
    error.status = 503;
    throw error;
  }
  if (!claims.sub || claims.sub !== ownerId || !claims.email) {
    const error = new Error('This library is private. Owner access is required.');
    error.status = 403;
    throw error;
  }
};

const registrationClosed = (_req, res) => res.status(403).json({
  success: false,
  message: 'This is a private library. Public registration is disabled.',
});

module.exports = { requireOwnerIdentity, registrationClosed };
