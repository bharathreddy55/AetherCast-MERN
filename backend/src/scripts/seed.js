require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Podcast = require('../models/Podcast');
const Episode = require('../models/Episode');
const Comment = require('../models/Comment');
const Review = require('../models/Review');

const seedData = async () => {
  try {
    // Connect to Database
    await connectDB();

    console.log('Clearing old database collections...');
    await Comment.deleteMany({});
    await Review.deleteMany({});
    await Episode.deleteMany({});
    await Podcast.deleteMany({});
    await User.deleteMany({});
    console.log('Database cleared.');

    console.log('Creating users...');
    
    // Create Admin User
    const admin = await User.create({
      username: 'admin',
      name: 'Admin Moderator',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      isVerified: true
    });

    // Create Creator User
    const creator = await User.create({
      username: 'creator',
      name: 'Tech Enthusiast',
      email: 'creator@example.com',
      password: 'password123',
      role: 'creator',
      isVerified: true,
      bio: 'Podcasting about technology, future tech and programming.'
    });

    // Create Listener 1
    const listener1 = await User.create({
      username: 'listener1',
      name: 'Alice Johnson',
      email: 'listener1@example.com',
      password: 'password123',
      role: 'listener',
      isVerified: true
    });

    // Create Listener 2
    const listener2 = await User.create({
      username: 'listener2',
      name: 'Bob Smith',
      email: 'listener2@example.com',
      password: 'password123',
      role: 'listener',
      isVerified: true
    });

    console.log('Users created.');

    console.log('Creating podcast shows...');
    // Create Podcast 1
    const podcast1 = await Podcast.create({
      creatorId: creator._id,
      title: 'The Tech Wave',
      description: 'A deep dive into advanced technology, coding, artificial intelligence, and startup culture.',
      coverImage: '/uploads/defaults/tech_cover.jpg', // Will fallback cleanly if file not found
      category: 'technology',
      status: 'published',
      episodeCount: 2,
      ratingAverage: 3.0,
      ratingCount: 2
    });

    // Create Podcast 2
    const podcast2 = await Podcast.create({
      creatorId: creator._id,
      title: 'Business Talk Daily',
      description: 'Daily insights on marketing strategies, business ventures, seed investing, and startup scaling.',
      coverImage: '/uploads/defaults/business_cover.jpg',
      category: 'business',
      status: 'published',
      episodeCount: 1,
      ratingAverage: 0,
      ratingCount: 0
    });

    console.log('Podcasts created.');

    console.log('Creating podcast episodes...');
    // Create Episode 1 (Tech Wave)
    const episode1 = await Episode.create({
      podcastId: podcast1._id,
      title: 'Episode 1: The Rise of LLMs',
      description: 'Understanding LLMs, transformers, and the future of coding.',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      duration: 372,
      playCount: 45,
      aiSummary: 'This episode covers the origin of Large Language Models (LLMs), how they operate, and their impact on software engineering jobs.',
      aiTags: ['AI', 'LLM', 'Tech', 'Software']
    });

    // Create Episode 2 (Tech Wave)
    const episode2 = await Episode.create({
      podcastId: podcast1._id,
      title: 'Episode 2: Future of Web Development',
      description: 'Discussing frameworks, bundlers, React 19, and Vite advancements.',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      duration: 420,
      playCount: 12
    });

    // Create Episode 3 (Business Talk)
    const episode3 = await Episode.create({
      podcastId: podcast2._id,
      title: 'Episode 1: Navigating Seed Funding',
      description: 'VC pitches, angel investors, valuation, and fundraising basics.',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      duration: 512,
      playCount: 88,
      aiSummary: 'A comprehensive guide for founders to understand seed rounds, venture capitalist pitches, and cap table management.',
      aiTags: ['Business', 'Funding', 'Startups']
    });

    console.log('Episodes created.');

    console.log('Creating comments...');
    // Add normal comment
    await Comment.create({
      userId: listener1._id,
      episodeId: episode1._id,
      content: 'Absolutely loved the explanation of transformer architectures! Keep it up!'
    });

    // Add flagged comment
    await Comment.create({
      userId: listener2._id,
      episodeId: episode1._id,
      content: 'This host is an absolute idiot, posting false information and garbage spam. Ban this creator!!!',
      isFlagged: true
    });

    console.log('Comments created.');

    console.log('Creating reviews...');
    // Add normal review
    await Review.create({
      userId: listener1._id,
      podcastId: podcast1._id,
      rating: 5,
      comment: 'Super informative podcast, very high audio quality!'
    });

    // Add flagged review
    await Review.create({
      userId: listener2._id,
      podcastId: podcast1._id,
      rating: 1,
      comment: 'SCAM SHOW! The host insults listeners and sells fake courses. Do not listen!',
      isFlagged: true
    });

    console.log('Reviews created.');
    console.log('Database Seeding Completed Successfully! 🌱');
    process.exit(0);
  } catch (error) {
    console.error('Seeding database failed:', error.message);
    process.exit(1);
  }
};

seedData();
