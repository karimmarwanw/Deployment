const mongoose = require('mongoose');
require('dotenv').config();

const Vote = require('../models/Vote');

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/reddit');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('votes');

    // Drop existing indexes
    console.log('Dropping existing indexes...');
    try {
      await collection.dropIndex('user_1_post_1');
      console.log('Dropped user_1_post_1 index');
    } catch (e) {
      console.log('Index user_1_post_1 does not exist or already dropped');
    }

    try {
      await collection.dropIndex('user_1_comment_1');
      console.log('Dropped user_1_comment_1 index');
    } catch (e) {
      console.log('Index user_1_comment_1 does not exist or already dropped');
    }

    // Create new partial indexes
    console.log('Creating new partial indexes...');
    await collection.createIndex(
      { user: 1, post: 1 },
      {
        unique: true,
        partialFilterExpression: { post: { $ne: null } },
        name: 'user_1_post_1'
      }
    );
    console.log('Created user_1_post_1 partial index');

    await collection.createIndex(
      { user: 1, comment: 1 },
      {
        unique: true,
        partialFilterExpression: { comment: { $ne: null } },
        name: 'user_1_comment_1'
      }
    );
    console.log('Created user_1_comment_1 partial index');

    console.log('Indexes fixed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixIndexes();

