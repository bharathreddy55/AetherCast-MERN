const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

// Mock User Model
jest.mock('../models/User', () => {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => {
      if (!data.username || !data.password || !data.email || !data.name) {
        return Promise.reject(new Error('ValidationError: Missing fields'));
      }
      return Promise.resolve({
        _id: 'mockuser123',
        username: data.username,
        email: data.email
      });
    })
  };
});

// Mock Podcast Model
jest.mock('../models/Podcast', () => {
  const mockPodcast = {
    _id: 'mockpodcast123',
    title: 'Mock Show',
    category: 'technology',
    description: 'Mock Description',
    toObject: function() { return this; }
  };
  return {
    countDocuments: jest.fn().mockResolvedValue(1),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockResolvedValue([mockPodcast])
          })
        })
      })
    })
  };
});

// Mock Episode Model
jest.mock('../models/Episode', () => {
  return {
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            { _id: 'mockepisode123', title: 'Mock Episode', duration: 120, status: 'published' }
          ])
        })
      })
    })
  };
});

// Mock mongoose connection
beforeAll(async () => {
  jest.spyOn(mongoose, 'connect').mockResolvedValue(true);
});

afterAll(async () => {
  jest.restoreAllMocks();
});

describe('AetherCast Backend API Integration Tests', () => {
  
  describe('GET /api/podcasts (Public Catalog Access)', () => {
    it('should successfully return the list of published podcasts', async () => {
      const res = await request(app)
        .get('/api/podcasts')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.podcasts)).toBe(true);
      expect(res.body.podcasts[0].title).toBe('Mock Show');
    });
  });

  describe('GET /api/episodes (Public Search Access)', () => {
    it('should return published episodes list', async () => {
      const res = await request(app)
        .get('/api/episodes')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.episodes)).toBe(true);
      expect(res.body.episodes[0].title).toBe('Mock Episode');
    });
  });

  describe('GET /api/admin/stats (Route Protection checks)', () => {
    it('should return 401 Unauthorized for private endpoints accessed without a JWT token', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Not authorized');
    });
  });

  describe('POST /api/auth/register (Validation Limits)', () => {
    it('should return 500 or 400 Bad Request when mandatory register parameters are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' }) // Missing password/name/username
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });

});
