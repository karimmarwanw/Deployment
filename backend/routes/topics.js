const express = require('express');
const router = express.Router();

// Available topics/categories similar to Reddit
const TOPICS = {
  'Anime & Cosplay': {
    icon: '🎌',
    topics: ['Anime & Manga', 'Cosplay']
  },
  'Art': {
    icon: '🎨',
    topics: ['Performing Arts', 'Architecture', 'Design', 'Art', 'Filmmaking', 'Digital Art', 'Photography']
  },
  'Business & Finance': {
    icon: '📈',
    topics: ['Personal Finance', 'Crypto', 'Economics', 'Business News & Discussion', 'Deals & Marketplace', 'Startups & Entrepreneurship', 'Real Estate', 'Stocks & Investing']
  },
  'Collectibles & Other Hobbies': {
    icon: '🧩',
    topics: ['Model Building', 'Collectibles', 'Other Hobbies', 'Toys']
  },
  'Crypto': {
    icon: '₿',
    topics: ['Bitcoin', 'Ethereum', 'Crypto Trading', 'Blockchain', 'NFTs']
  },
  'Food & Drink': {
    icon: '🍔',
    topics: ['Cooking', 'Baking', 'Food', 'Drink', 'Restaurants']
  },
  'Gaming': {
    icon: '🎮',
    topics: ['Video Games', 'PC Gaming', 'Console Gaming', 'Mobile Gaming', 'Game Development']
  },
  'Health & Fitness': {
    icon: '💪',
    topics: ['Fitness', 'Nutrition', 'Mental Health', 'Yoga', 'Running']
  },
  'Learning': {
    icon: '📚',
    topics: ['Education', 'Science', 'History', 'Languages', 'Programming', 'Mathematics']
  },
  'Music': {
    icon: '🎵',
    topics: ['Music', 'Hip Hop', 'Rock', 'Electronic Music', 'Classical Music']
  },
  'News & Politics': {
    icon: '📰',
    topics: ['News', 'Politics', 'World News', 'Local News']
  },
  'Outdoors': {
    icon: '🏕️',
    topics: ['Camping', 'Hiking', 'Fishing', 'Hunting', 'Nature']
  },
  'Programming': {
    icon: '💻',
    topics: ['Web Development', 'Python', 'JavaScript', 'Machine Learning', 'DevOps']
  },
  'Reading & Writing': {
    icon: '📖',
    topics: ['Books', 'Writing', 'Poetry', 'Fan Fiction']
  },
  'Sports': {
    icon: '⚽',
    topics: ['Football', 'Basketball', 'Baseball', 'Soccer', 'Tennis', 'Golf']
  },
  'Technology': {
    icon: '💡',
    topics: ['Technology', 'Software', 'Hardware', 'AI', 'Internet']
  },
  'TV & Movies': {
    icon: '🎬',
    topics: ['Movies', 'TV Shows', 'Streaming', 'Cinema']
  }
};

// @route   GET /api/topics
// @desc    Get all available topics
// @access  Public
router.get('/', (req, res) => {
  res.json(TOPICS);
});

// @route   GET /api/topics/flat
// @desc    Get all topics as a flat array
// @access  Public
router.get('/flat', (req, res) => {
  const flatTopics = [];
  Object.keys(TOPICS).forEach(category => {
    TOPICS[category].topics.forEach(topic => {
      flatTopics.push({
        category,
        icon: TOPICS[category].icon,
        name: topic
      });
    });
  });
  res.json(flatTopics);
});

module.exports = router;

