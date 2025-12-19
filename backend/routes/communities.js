const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Community = require('../models/Community');
const User = require('../models/User');
const FavoriteCommunity = require('../models/FavoriteCommunity');
const { body, validationResult } = require('express-validator');

// @route   POST /api/communities
// @desc    Create a new community
// @access  Private
router.post('/', auth, [
  body('name').trim().isLength({ min: 3, max: 21 }).withMessage('Community name must be between 3 and 21 characters'),
  body('displayName').trim().isLength({ min: 1, max: 100 }).withMessage('Display name is required'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, displayName, description, topics } = req.body;
    const lowerName = name.toLowerCase().trim();

    // Check if community already exists
    const existingCommunity = await Community.findOne({ name: lowerName });
    if (existingCommunity) {
      return res.status(400).json({ message: 'Community already exists' });
    }

    // Create community
    const community = new Community({
      name: lowerName,
      displayName,
      description: description || '',
      topics: topics && Array.isArray(topics) ? topics : [],
      creator: req.user.userId,
      members: [req.user.userId],
      memberCount: 1
    });

    await community.save();

    // Add community to user's joined communities
    await User.findByIdAndUpdate(req.user.userId, {
      $addToSet: { joinedCommunities: community._id }
    });

    res.status(201).json(community);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/communities
// @desc    Get all communities
// @access  Public
router.get('/', async (req, res) => {
  try {
    const communities = await Community.find()
      .populate('creator', 'username')
      .sort({ memberCount: -1, createdAt: -1 });
    res.json(communities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// IMPORTANT: More specific routes must come before the generic :name route
// @route   POST /api/communities/:name/join
// @desc    Join a community
// @access  Private
router.post('/:name/join', auth, async (req, res) => {
  try {
    const community = await Community.findOne({ name: req.params.name.toLowerCase() });
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    if (community.members.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Already a member' });
    }

    community.members.push(req.user.userId);
    community.memberCount += 1;
    await community.save();

    await User.findByIdAndUpdate(req.user.userId, {
      $addToSet: { joinedCommunities: community._id }
    });

    res.json(community);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/communities/:name/leave
// @desc    Leave a community
// @access  Private
router.post('/:name/leave', auth, async (req, res) => {
  try {
    const community = await Community.findOne({ name: req.params.name.toLowerCase() });
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    if (!community.members.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Not a member' });
    }

    community.members = community.members.filter(
      member => member.toString() !== req.user.userId
    );
    community.memberCount = Math.max(0, community.memberCount - 1);
    await community.save();

    await User.findByIdAndUpdate(req.user.userId, {
      $pull: { joinedCommunities: community._id }
    });

    res.json(community);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/communities/:name/favorite
// @desc    Favorite or unfavorite a community
// @access  Private
router.post('/:name/favorite', auth, async (req, res) => {
  try {
    const community = await Community.findOne({ name: req.params.name.toLowerCase() });
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    const userId = req.user.userId;

    // Check if already favorited
    const existingFavorite = await FavoriteCommunity.findOne({ user: userId, community: community._id });

    if (existingFavorite) {
      // Remove favorite
      await FavoriteCommunity.findByIdAndDelete(existingFavorite._id);
      res.json({ favorited: false, message: 'Community unfavorited' });
    } else {
      // Add favorite
      const favoriteCommunity = new FavoriteCommunity({
        user: userId,
        community: community._id
      });
      await favoriteCommunity.save();
      res.json({ favorited: true, message: 'Community favorited' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/communities/:name
// @desc    Get community by name
// @access  Public
// This must be last to avoid matching more specific routes
router.get('/:name', async (req, res) => {
  try {
    const community = await Community.findOne({ name: req.params.name.toLowerCase() })
      .populate('creator', 'username')
      .populate('members', 'username');
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    res.json(community);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

