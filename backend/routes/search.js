const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const User = require('../models/User');
const Post = require('../models/Post');
const { calculateUserKarma } = require('../utils/karma');

// @route   GET /api/search
// @desc    Search for communities, users, and posts
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const query = q.trim();
    const results = {};

    if (type === 'all' || type === 'communities') {
      const communities = await Community.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { displayName: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      })
      .limit(10)
      .select('name displayName description memberCount');
      
      results.communities = communities;
    }

    if (type === 'all' || type === 'users') {
      const users = await User.find({
        username: { $regex: query, $options: 'i' }
      })
      .limit(10)
      .select('username createdAt');

      const usersWithKarma = await Promise.all(
        users.map(async (user) => {
          const userObj = user.toObject();
          userObj.karma = await calculateUserKarma(user._id);
          return userObj;
        })
      );

      results.users = usersWithKarma;
    }

    if (type === 'all' || type === 'posts') {
      const posts = await Post.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } }
        ]
      })
      .populate('author', 'username')
      .populate('community', 'name displayName')
      .limit(10)
      .select('title content score commentCount createdAt');
      
      results.posts = posts;
    }

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
