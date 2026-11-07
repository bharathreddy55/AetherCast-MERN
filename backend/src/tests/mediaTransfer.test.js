const { Writable } = require('node:stream');
const { transferPrivateMedia } = require('../utils/mediaTransfer');

const flush = () => new Promise(setImmediate);
beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }));
afterEach(() => jest.useRealTimers());
function fixture(write) {
  let input;
  const cancel = jest.fn(), chunks = [], controller = new AbortController();
  const body = new ReadableStream({ start(value) { input = value; }, cancel });
  const output = new Writable({ write: write || ((chunk, encoding, done) => { chunks.push(chunk); done(); }) });
  const result = transferPrivateMedia(body, output, controller).then(() => null, error => error);
  return { input, cancel, chunks, controller, output, result };
}

test('a response with headers but no first byte is cancelled after thirty seconds', async () => {
  const f = fixture(); await flush();
  await jest.advanceTimersByTimeAsync(29999); expect(f.controller.signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  expect((await f.result).name).toBe('AbortError');
  expect(f.cancel).toHaveBeenCalledTimes(1); expect(f.output.destroyed).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('healthy long transfers reset the inactivity deadline and preserve exact bytes', async () => {
  const f = fixture(); await flush();
  for (let i = 0; i < 12; i++) {
    await jest.advanceTimersByTimeAsync(20000);
    f.input.enqueue(Buffer.from(String(i))); await flush();
    expect(f.controller.signal.aborted).toBe(false);
  }
  f.input.close(); expect(await f.result).toBeNull();
  expect(Buffer.concat(f.chunks).toString()).toBe('01234567891011');
  expect(f.cancel).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});

test('a mid-song stall cancels storage and destroys the partial destination', async () => {
  const f = fixture(); f.input.enqueue(Buffer.from('first')); await flush();
  await jest.advanceTimersByTimeAsync(20000);
  f.input.enqueue(Buffer.from('second')); await flush();
  await jest.advanceTimersByTimeAsync(29999); expect(f.controller.signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1); expect((await f.result).name).toBe('AbortError');
  expect(Buffer.concat(f.chunks).toString()).toBe('firstsecond');
  expect(f.cancel).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});

test('client cancellation stops a pending body immediately and removes the watchdog', async () => {
  const f = fixture(); await flush(); f.controller.abort();
  expect((await f.result).name).toBe('AbortError');
  expect(f.cancel).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});

test('upstream failure ends the destination without retaining a watchdog', async () => {
  const f = fixture(); await flush(); f.input.error(new Error('storage interrupted'));
  expect((await f.result).message).toBe('storage interrupted');
  expect(f.output.destroyed).toBe(true); expect(jest.getTimerCount()).toBe(0);
});

test('destination failure cancels the storage body and removes the watchdog', async () => {
  const f = fixture((chunk, encoding, done) => done(new Error('client disconnected')));
  f.input.enqueue(Buffer.from('audio'));
  expect((await f.result).message).toBe('client disconnected');
  expect(f.cancel).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});

test('a blocked downstream write cannot keep a transfer alive indefinitely', async () => {
  const f = fixture(() => {}); f.input.enqueue(Buffer.alloc(128 * 1024)); await flush();
  await jest.advanceTimersByTimeAsync(30000);
  expect((await f.result).name).toBe('AbortError');
  expect(f.cancel).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});
