jest.mock('../models/MusicImport', () => ({ findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../services/musicImportStorage', () => ({ storeImportAsset: jest.fn() }));
const MusicImport = require('../models/MusicImport');
const { storeImportAsset } = require('../services/musicImportStorage');
const controller = require('../controllers/musicImportController');
const wav = require('./fixtures/wav');
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const request = () => ({ user: { _id: 'owner' }, params: { id: 'job' }, file: { originalname: 'Song.wav', buffer: wav() } });
beforeEach(() => {
  jest.clearAllMocks();
  MusicImport.findOne.mockReturnValue({ lean: async () => null });
  MusicImport.countDocuments.mockResolvedValue(0);
  MusicImport.create.mockImplementation(async data => ({ _id: 'job', ...data }));
  storeImportAsset.mockResolvedValue({ _id: 'asset' });
});

test('uploads validated originals into an owner-scoped queued job', async () => {
  const res = response();
  await controller.upload(request(), res);
  expect(res.status).toHaveBeenCalledWith(202);
  expect(storeImportAsset.mock.calls[0][0]).toBe('owner');
  expect(MusicImport.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner', assetId: 'asset', status: 'queued', checksum: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  expect(res.json.mock.calls[0][0].import.ownerId).toBeUndefined();
});

test('identical uploads reuse the existing job before touching storage', async () => {
  MusicImport.findOne.mockReturnValue({ lean: async () => ({ _id: 'existing', status: 'completed', originalName: 'Original.wav' }) });
  const res = response();
  await controller.upload(request(), res);
  expect(res.json.mock.calls[0][0].duplicate).toBe(true);
  expect(storeImportAsset).not.toHaveBeenCalled();
});

test('queue limits and forged audio signatures are rejected before storage writes', async () => {
  MusicImport.countDocuments.mockResolvedValueOnce(20);
  const full = response(); await controller.upload(request(), full);
  expect(full.status).toHaveBeenCalledWith(409);
  const forged = request(); forged.file.buffer = Buffer.from('not actual audio');
  const invalid = response(); await controller.upload(forged, invalid);
  expect(invalid.status).toHaveBeenCalledWith(400);
  expect(storeImportAsset).not.toHaveBeenCalled();
});

test('retry and cancellation are owner-scoped status transitions that invalidate old leases', async () => {
  MusicImport.findOneAndUpdate.mockResolvedValue({ _id: 'job', status: 'queued' });
  await controller.retry(request(), response());
  expect(MusicImport.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: 'job', ownerId: 'owner', status: { $in: ['failed', 'cancelled'] } });
  expect(MusicImport.findOneAndUpdate.mock.calls[0][1].$unset).toEqual({ leaseToken: '' });
  await controller.cancel(request(), response());
  expect(MusicImport.findOneAndUpdate.mock.calls[1][0].ownerId).toBe('owner');
  expect(MusicImport.findOneAndUpdate.mock.calls[1][1].$set.status).toBe('cancelled');
});

test('retry respects the same pending-work limit as new uploads', async () => {
  MusicImport.countDocuments.mockResolvedValueOnce(20);
  const res = response(); await controller.retry(request(), res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(MusicImport.findOneAndUpdate).not.toHaveBeenCalled();
});
