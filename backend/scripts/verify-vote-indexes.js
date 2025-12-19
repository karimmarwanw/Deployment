const mongoose = require('mongoose');
require('dotenv').config();

const Vote = require('../models/Vote');

async function verifyIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/reddit-clone');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('votes');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('\n=== Current Vote Indexes ===');
    indexes.forEach((index, i) => {
      console.log(`\nIndex ${i + 1}:`);
      console.log('  Name:', index.name);
      console.log('  Key:', JSON.stringify(index.key));
      if (index.partialFilterExpression) {
        console.log('  Partial Filter:', JSON.stringify(index.partialFilterExpression));
      }
      if (index.unique) {
        console.log('  Unique: true');
      }
    });

    // Check for the specific indexes we need
    const hasPostIndex = indexes.some(idx => 
      idx.key.user === 1 && idx.key.post === 1 && 
      idx.partialFilterExpression && idx.partialFilterExpression.post && 
      idx.partialFilterExpression.post.$ne === null
    );

    const hasCommentIndex = indexes.some(idx => 
      idx.key.user === 1 && idx.key.comment === 1 && 
      idx.partialFilterExpression && idx.partialFilterExpression.comment && 
      idx.partialFilterExpression.comment.$ne === null
    );

    console.log('\n=== Verification ===');
    if (hasPostIndex) {
      console.log('✓ Post index (user_1_post_1) with partial filter: OK');
    } else {
      console.log('✗ Post index (user_1_post_1) with partial filter: MISSING');
    }

    if (hasCommentIndex) {
      console.log('✓ Comment index (user_1_comment_1) with partial filter: OK');
    } else {
      console.log('✗ Comment index (user_1_comment_1) with partial filter: MISSING');
    }

    if (hasPostIndex && hasCommentIndex) {
      console.log('\n✅ All indexes are correctly configured!');
    } else {
      console.log('\n⚠️  Some indexes are missing. Try restarting the server.');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error verifying indexes:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

verifyIndexes();

