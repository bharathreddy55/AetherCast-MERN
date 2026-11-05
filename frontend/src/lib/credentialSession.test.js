import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialAuthOptions, clearLegacyLogin, createCredentialGate, createCredentialSession } from './credentialSession.js';

const session = { access_token: 'verified-token', user: { id: 'supabase-owner' } };
const profile = { _id: 'library-owner', supabaseUserId: session.user.id, role: 'listener' };
const reply = (user = profile) => ({ ok: true, json: async () => ({ success: true, user }) });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
  const states = [], calls = [], ended = [];
  const gate = createCredentialGate();
  const auth = { signInWithPassword: async values => { calls.push(values); return { data: { session }, error: null }; },
    getSession: async () => ({ data: { session } }), signOut: async () => {}, ...overrides.auth };
  const manager = createCredentialSession({ auth, gate, fetchProfile: overrides.fetchProfile || (async () => reply()),
    onState: value => states.push(value), onSessionEnd: owner => ended.push(owner) });
  return { manager, gate, auth, states, calls, ended };
}

test('session persistence is disabled and legacy credentials are removed only for this project', () => {
  assert.equal(credentialAuthOptions.persistSession, false);
  const entries = new Map([['token', 'old'], ['sb-project-auth-token', 'cached'], ['sb-project-auth-token-user', 'cached'], ['sb-other-auth-token', 'other'], ['theme', 'dark']]);
  const storage = { get length() { return entries.size; }, key: index => [...entries.keys()][index], removeItem: key => entries.delete(key) };
  clearLegacyLogin(storage, 'https://project.supabase.co');
  assert.deepEqual([...entries.keys()], ['sb-other-auth-token', 'theme']);
  assert.doesNotThrow(() => clearLegacyLogin({ get length() { throw new Error(); } }, 'https://project.supabase.co'));
});

test('initial, restored, recovery and unsolicited sign-in events cannot grant library access', async () => {
  const { manager, gate, auth, states } = fixture({ fetchProfile: async () => assert.fail('Must not fetch an owner profile before password entry') });
  for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'PASSWORD_RECOVERY', 'USER_UPDATED']) manager.handleEvent(event, session);
  await tick();
  await assert.rejects(gate.accessToken(auth), /email and password/);
  assert.equal(states.some(state => state.user), false);
});

test('fresh password verification and backend owner approval must both finish before access', async () => {
  const pending = deferred();
  const { manager, gate, auth, states, calls } = fixture({ fetchProfile: () => pending.promise });
  const login = manager.login(' owner@example.com ', 'test-password');
  await tick();
  await assert.rejects(gate.accessToken(auth), /sign in/);
  assert.equal(states.at(-1).loading, true);
  pending.resolve(reply());
  assert.deepEqual(await login, { success: true });
  assert.deepEqual(calls, [{ email: 'owner@example.com', password: 'test-password' }]);
  assert.equal(await gate.accessToken(auth), session.access_token);
  assert.equal(states.at(-1).user.id, profile._id);
});

test('invalid credentials never call the profile API or authorize an existing SDK session', async () => {
  const { manager, gate, auth } = fixture({ auth: { signInWithPassword: async () => ({ error: new Error('Invalid login credentials') }) },
    fetchProfile: async () => assert.fail('Invalid credentials must not reach profile API') });
  assert.equal((await manager.login('owner@example.com', 'wrong')).success, false);
  await assert.rejects(gate.accessToken(auth), /sign in/);
});

test('denied owner profiles, storage errors and mismatched identity fail closed', async () => {
  for (const response of [{ ok: false, json: async () => ({ success: false, message: 'Private owner only' }) }, reply({ ...profile, supabaseUserId: 'other' })]) {
    const { manager, gate, auth, states } = fixture({ fetchProfile: async () => response });
    assert.equal((await manager.login('owner@example.com', 'password')).success, false);
    assert.equal(states.at(-1).user, null);
    await assert.rejects(gate.accessToken(auth), /sign in/);
  }
});

test('a new page gate cannot reuse a previously verified SDK session', async () => {
  const { manager, gate, auth } = fixture();
  await manager.login('owner@example.com', 'password');
  assert.equal(await gate.accessToken(auth), session.access_token);
  await assert.rejects(createCredentialGate().accessToken(auth), /email and password/);
});

test('logout locks immediately even when remote sign-out fails and clears the old owner', async () => {
  const { manager, gate, auth, states, ended } = fixture({ auth: { signOut: async () => { throw new Error('offline'); } } });
  await manager.login('owner@example.com', 'password');
  await manager.logout();
  assert.equal(states.at(-1).user, null);
  assert.deepEqual(ended, [profile._id]);
  await assert.rejects(gate.accessToken(auth), /sign in/);
});

test('late profile responses cannot unlock after logout, page lock or provider disposal', async () => {
  for (const action of ['logout', 'lock', 'dispose']) {
    const pending = deferred();
    const { manager, gate, auth, states } = fixture({ fetchProfile: () => pending.promise });
    const login = manager.login('owner@example.com', 'password');
    await tick();
    await manager[action]();
    pending.resolve(reply());
    assert.equal((await login).success, false);
    assert.equal(states.some(state => state.user), false);
    await assert.rejects(gate.accessToken(auth), /sign in/);
  }
});

test('refresh keeps access only for an explicitly approved identity and rechecks the owner', async () => {
  let verifications = 0;
  const { manager, gate, auth, states } = fixture({ fetchProfile: async () => { verifications++; return reply(); } });
  await manager.login('owner@example.com', 'password');
  manager.handleEvent('TOKEN_REFRESHED', { ...session, access_token: 'fresh-token' });
  await tick();
  assert.equal(verifications, 2);
  assert.equal(states.at(-1).token, 'fresh-token');
  manager.handleEvent('SIGNED_IN', { access_token: 'other', user: { id: 'other' } });
  await assert.rejects(gate.accessToken(auth), /sign in/);
});

test('recovery sessions and failed refresh checks revoke an already approved library session', async () => {
  for (const event of ['PASSWORD_RECOVERY', 'TOKEN_REFRESHED']) {
    let allow = true;
    const { manager, gate, auth, states } = fixture({ fetchProfile: async () => allow ? reply() : { ok: false, json: async () => ({ message: 'Denied' }) } });
    await manager.login('owner@example.com', 'password');
    allow = false;
    manager.handleEvent(event, session);
    await tick();
    assert.equal(states.at(-1).user, null);
    await assert.rejects(gate.accessToken(auth), /sign in/);
  }
});

test('token reads finishing after a lock cannot send the previous account token', async () => {
  const pending = deferred(), gate = createCredentialGate();
  gate.approve(session);
  const token = gate.accessToken({ getSession: () => pending.promise });
  gate.lock();
  pending.resolve({ data: { session } });
  await assert.rejects(token, /sign in again/);
});

test('re-entering credentials for the same owner does not revive an older pending token read', async () => {
  const pending = deferred(), gate = createCredentialGate();
  gate.approve(session);
  const token = gate.accessToken({ getSession: () => pending.promise });
  gate.lock();
  gate.approve({ ...session, access_token: 'new-login' });
  pending.resolve({ data: { session } });
  await assert.rejects(token, /sign in again/);
});
