// Render terminates requests at its reverse proxy. Trust its nearest hop,
// leaving arbitrary earlier X-Forwarded-For entries untrusted.
function trustedProxyHops(env = process.env) {
  if (env.TRUST_PROXY_HOPS === undefined || env.TRUST_PROXY_HOPS === '') return env.RENDER === 'true' ? 1 : 0;
  if (!/^[0-5]$/.test(env.TRUST_PROXY_HOPS)) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5');
  return Number(env.TRUST_PROXY_HOPS);
}
module.exports = { trustedProxyHops };
