const mongoose = require('mongoose');
const { retentionOptions } = require('../utils/mediaRetention');
const usage = 'Read-only media retention report\nUsage: npm run --silent media:retention -- [--limit=50] [--after=<asset-id>] [--retention-days=30]\nLimits: 1–100 records/page; 30–3650 retention days. No apply/delete mode.';
function parseArguments(args) {
  if (args.length === 1 && args[0] === '--help') return null;
  const options = {}, seen = new Set();
  for (const arg of args) {
    const match = /^--(limit|after|retention-days)=(.+)$/.exec(arg);
    if (!match || seen.has(match[1])) throw new Error('Invalid command options');
    seen.add(match[1]);
    const key = match[1] === 'retention-days' ? 'retentionDays' : match[1];
    if (key !== 'after' && !/^\d+$/.test(match[2])) throw new Error('Invalid numeric option');
    options[key] = key === 'after' ? match[2] : Number(match[2]);
  }
  return retentionOptions(options);
}
async function runCli(args, { env = process.env, db = mongoose, output = console.log, error = console.error,
  ownerLookup = async uid => require('../models/User').findOne({ supabaseUserId: uid, accountStatus: { $ne: 'suspended' } }).select('_id').maxTimeMS(5000).lean(),
  report = (...values) => require('../services/mediaRetentionReport').mediaRetentionReport(...values) } = {}) {
  let attemptedConnection = false;
  try {
    const options = parseArguments(args);
    if (!options) { output(usage); return 0; }
    if (!env.MONGO_URI || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(env.OWNER_SUPABASE_USER_ID || '')) {
      error('Set MONGO_URI and the configured OWNER_SUPABASE_USER_ID before running this report.'); return 1;
    }
    attemptedConnection = true;
    // Prevent model initialization from creating collections/indexes during this
    // maintenance read. Do not use the application's connection logger here.
    await db.connect(env.MONGO_URI, { autoIndex: false, autoCreate: false, bufferCommands: false, maxPoolSize: 2, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 10000 });
    const owner = await ownerLookup(env.OWNER_SUPABASE_USER_ID);
    if (!owner) { error('The configured active library owner was not found.'); return 1; }
    const result = await report(owner._id, options);
    await db.disconnect(); attemptedConnection = false;
    output(JSON.stringify(result, null, 2)); return 0;
  } catch {
    error('Unable to produce the retention report. Check command options, database access and owner configuration. No cleanup was performed.'); return 1;
  } finally {
    if (attemptedConnection) { try { await db.disconnect(); } catch { /* Do not expose connection details. */ } }
  }
}
if (require.main === module) {
  require('dotenv').config();
  void runCli(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
module.exports = { parseArguments, runCli };
