const Episode = require('../models/Episode');
const Progress = require('../models/Progress');
const { saveProgress, getProgress } = require('../controllers/episodeController');

jest.mock('../models/Episode', () => ({ exists: jest.fn() }));
jest.mock('../models/Progress', () => ({ findOneAndUpdate: jest.fn(), findOne: jest.fn() }));
const episodeId = '507f1f77bcf86cd799439011';
const ownerId = '507f191e810c19729de860ea';
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
beforeEach(() => { jest.clearAllMocks(); Episode.exists.mockResolvedValue({ _id: episodeId }); });

test('saves the requested episode for the authenticated owner with validation enabled', async () => {
  const res = response();
  Progress.findOneAndUpdate.mockResolvedValue({ position: 42, duration: 100, completed: false });
  await saveProgress({ params: { id: episodeId }, user: { _id: ownerId }, body: { position: 42, duration: 100, userId: 'other-user' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(Progress.findOneAndUpdate).toHaveBeenCalledWith(
    { userId: ownerId, episodeId }, { $set: { position: 42, duration: 100, completed: false } },
    { new: true, upsert: true, runValidators: true },
  );
});

test.each([
  { position: -1, duration: 100 }, { position: 101, duration: 100 },
  { position: 1, duration: 0 }, { position: 1, duration: -1 },
  { position: NaN, duration: 100 }, { position: Infinity, duration: 100 },
  { position: 1, duration: Infinity }, { position: 1, duration: NaN },
  { position: '10', duration: 100 }, { position: 10, duration: '100' },
  { position: null, duration: 100 }, { duration: 100 }, { position: 10 },
])('rejects malformed progress without writing it: %j', async body => {
  const res = response();
  await saveProgress({ params: { id: episodeId }, user: { _id: ownerId }, body }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(Progress.findOneAndUpdate).not.toHaveBeenCalled();
});

test('rejects progress for a deleted or missing episode', async () => {
  Episode.exists.mockResolvedValue(null);
  const res = response();
  await saveProgress({ params: { id: episodeId }, user: { _id: ownerId }, body: { position: 10, duration: 100 } }, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(Progress.findOneAndUpdate).not.toHaveBeenCalled();
});

test.each([0, 94, 95, 100])('derives completion consistently for position %d', async position => {
  const res = response();
  await saveProgress({ params: { id: episodeId }, user: { _id: ownerId }, body: { position, duration: 100 } }, res);
  expect(Progress.findOneAndUpdate.mock.calls[0][1].$set.completed).toBe(position >= 95);
});

test('returns a default resume state if no progress is saved', async () => {
  Progress.findOne.mockResolvedValue(null);
  const res = response();
  await getProgress({ params: { id: episodeId }, user: { _id: ownerId } }, res);
  expect(Progress.findOne).toHaveBeenCalledWith({ userId: ownerId, episodeId });
  expect(res.json).toHaveBeenCalledWith({ success: true, progress: { position: 0, duration: 0, completed: false } });
});

test('invalid episode identifiers return 400 on both progress routes', async () => {
  for (const handler of [saveProgress, getProgress]) {
    const res = response();
    await handler({ params: { id: 'invalid' }, user: { _id: ownerId }, body: { position: 0, duration: 100 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  }
});

test('the schema rejects non-finite or non-positive durations', async () => {
  const ActualProgress = jest.requireActual('../models/Progress');
  for (const duration of [0, -1, Infinity]) {
    const document = new ActualProgress({ userId: ownerId, episodeId, position: 0, duration });
    await expect(document.validate()).rejects.toThrow();
  }
});
