export const credentialAuthOptions = { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true };

export function clearLegacyLogin(storage, projectUrl) {
  try {
    const key = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const item of keys) if (item === 'token' || item === key || item?.startsWith(`${key}-`)) storage.removeItem(item);
  } catch { /* Blocked browser storage cannot restore a memory-only session. */ }
}

export function createCredentialGate() {
  let subject = null;
  let generation = 0;
  return {
    approve(session) {
      if (!session?.user?.id || !session.access_token) throw new Error('A verified sign-in session is required.');
      subject = session.user.id;
    },
    lock() { subject = null; ++generation; },
    accepts(session) { return !!subject && session?.user?.id === subject && !!session.access_token; },
    async accessToken(auth) {
      if (!subject) throw new Error('Please sign in with your email and password.');
      const expected = subject;
      const expectedGeneration = generation;
      const { data, error } = await auth.getSession();
      if (error) throw error;
      if (!subject || generation !== expectedGeneration || subject !== expected || !this.accepts(data.session)) throw new Error('Please sign in again.');
      return data.session.access_token;
    },
  };
}
export const credentialGate = createCredentialGate();

// Only login() can initially approve a session. SDK restoration, recovery and
// unsolicited SIGNED_IN events never grant library access.
export function createCredentialSession({ auth, gate, fetchProfile, onState, onSessionEnd = () => {} }) {
  let revision = 0;
  let disposed = false;
  let controller;
  let ownerId = null;
  const emit = value => { if (!disposed) onState(value); };
  const clear = (message = '') => {
    ++revision;
    controller?.abort();
    gate.lock();
    const previous = ownerId;
    ownerId = null;
    emit({ user: null, token: null, loading: false, authError: message });
    if (previous) onSessionEnd(previous);
  };
  const verify = async (session, current, signal) => {
    if (!session?.access_token || !session.user?.id) throw new Error('Please sign in with your email and password.');
    const response = await fetchProfile(session.access_token, signal);
    const data = await response.json();
    if (!response.ok || !data.success || !data.user) throw new Error(data.message || 'Unable to authorize your private library.');
    if (data.user.supabaseUserId !== session.user.id) throw new Error('The library profile does not match your sign-in account.');
    if (disposed || current !== revision || signal.aborted) return false;
    const user = { ...data.user, id: data.user.id || data.user._id, _id: data.user._id || data.user.id };
    gate.approve(session);
    ownerId = user.id;
    emit({ user, token: session.access_token, loading: false, authError: '' });
    return true;
  };
  return {
    async login(email, password) {
      clear();
      const current = revision;
      controller = new AbortController();
      const signal = controller.signal;
      emit({ user: null, token: null, loading: true, authError: '' });
      try {
        if (!email?.trim() || !password) throw new Error('Enter your email and password.');
        const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (disposed || current !== revision) return { success: false, message: 'Sign-in was cancelled.' };
        if (error) throw error;
        const success = await verify(data.session, current, signal);
        return success ? { success: true } : { success: false, message: 'Sign-in was cancelled.' };
      } catch (error) {
        if (!disposed && current === revision) clear(error.message || 'Unable to sign in.');
        return { success: false, message: error.message || 'Unable to sign in.' };
      }
    },
    handleEvent(event, session) {
      if (disposed) return;
      if (event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') { clear(); return; }
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event) && ownerId && !gate.accepts(session)) { clear(); return; }
      if (event !== 'TOKEN_REFRESHED' || !gate.accepts(session)) return;
      const current = ++revision;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      // Leave Supabase's auth callback synchronously; avoid SDK lock deadlocks.
      queueMicrotask(() => {
        if (disposed || current !== revision) return;
        void verify(session, current, signal).catch(() => {
          if (!disposed && current === revision) clear('Your session could not be verified. Please sign in again.');
        });
      });
    },
    lock: clear,
    async logout() {
      clear();
      try { await auth.signOut({ scope: 'local' }); }
      catch { /* Access stays locked even when remote sign-out is unavailable. */ }
    },
    dispose() { disposed = true; ++revision; controller?.abort(); gate.lock(); },
  };
}
