import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PostCard from '../components/PostCard';
import Sidebar from '../components/Sidebar';
import './Home.css';

const Home = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('new');

  useEffect(() => {
    fetchPosts();
  }, [sortBy, user]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      // If user has interests, filter by interests; otherwise show all posts
      const filterByInterests = user && user.interests && user.interests.length > 0 ? 'true' : 'false';
      const response = await axios.get(`/posts?sort=${sortBy}&filterByInterests=${filterByInterests}`);
      // Filter out hidden posts
      const filteredPosts = response.data.filter(post => !post.hidden);
      setPosts(filteredPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostHide = (postId) => {
    // Remove the hidden post from the list
    if (postId) {
      setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
    }
  };

  const handlePostUpdate = () => {
    // General update handler (for saves, etc.) - no action needed
  };

  return (
    <div className="container">
      <div className="main-content">
        <div className="feed-header">
          <h2>Home</h2>
          <div className="sort-options">
            <button
              className={sortBy === 'new' ? 'active' : ''}
              onClick={() => setSortBy('new')}
            >
              New
            </button>
            <button
              className={sortBy === 'hot' ? 'active' : ''}
              onClick={() => setSortBy('hot')}
            >
              Hot
            </button>
            <button
              className={sortBy === 'top' ? 'active' : ''}
              onClick={() => setSortBy('top')}
            >
              Top
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-posts">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="no-posts">
            <p>No posts yet. Be the first to create one!</p>
            {user && (
              <Link to="/create-community" className="create-link">
                Create a Community
              </Link>
            )}
          </div>
        ) : (
          <div className="posts-list">
            {posts
              .filter(post => !post.hidden) // Additional filter for safety
              .map(post => (
                <PostCard 
                  key={post._id} 
                  post={post} 
                  user={user} 
                  onUpdate={handlePostUpdate}
                  onHide={handlePostHide}
                />
              ))}
          </div>
        )}
      </div>
      <Sidebar user={user} />
    </div>
  );
};

export default Home;

