import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import './Search.css';

const Search = ({ user }) => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState({ communities: [], users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery) => {
    try {
      setLoading(true);
      const response = await axios.get(`/search?q=${encodeURIComponent(searchQuery)}&type=${activeTab}`);
      setResults(response.data);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [activeTab]);

  return (
    <div className="container">
      <div className="main-content">
        <div className="search-header">
          <h1>Search Results for "{query}"</h1>
        </div>

        <div className="search-tabs">
          <button
            className={activeTab === 'all' ? 'active' : ''}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={activeTab === 'communities' ? 'active' : ''}
            onClick={() => setActiveTab('communities')}
          >
            Communities
          </button>
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={activeTab === 'posts' ? 'active' : ''}
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </button>
        </div>

        {loading ? (
          <div className="loading">Searching...</div>
        ) : (
          <div className="search-results">
            {(activeTab === 'all' || activeTab === 'communities') && (
              <div className="results-section">
                <h2>Communities</h2>
                {results.communities && results.communities.length > 0 ? (
                  <div className="results-list">
                    {results.communities.map(community => (
                      <Link
                        key={community._id}
                        to={`/r/${community.name}`}
                        className="result-item community-item"
                      >
                        <div className="result-content">
                          <h3>r/{community.name}</h3>
                          <p>{community.displayName}</p>
                          {community.description && (
                            <p className="result-description">{community.description}</p>
                          )}
                          <span className="result-meta">{community.memberCount} members</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="no-results">No communities found</p>
                )}
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'users') && (
              <div className="results-section">
                <h2>Users</h2>
                {results.users && results.users.length > 0 ? (
                  <div className="results-list">
                    {results.users.map(userResult => (
                      <Link
                        key={userResult._id}
                        to={`/profile/${userResult._id}`}
                        className="result-item user-item"
                      >
                        <div className="result-content">
                          <h3>u/{userResult.username}</h3>
                          <span className="result-meta">
                            {userResult.karma} karma • Joined {new Date(userResult.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="no-results">No users found</p>
                )}
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'posts') && (
              <div className="results-section">
                <h2>Posts</h2>
                {results.posts && results.posts.length > 0 ? (
                  <div className="results-list">
                    {results.posts.map(post => (
                      <Link
                        key={post._id}
                        to={`/post/${post._id}`}
                        className="result-item post-item"
                      >
                        <div className="result-content">
                          <div className="post-result-header">
                            <span>r/{post.community?.name || 'Unknown'}</span>
                            <span>•</span>
                            <span>u/{post.author?.username || 'Unknown'}</span>
                          </div>
                          <h3>{post.title}</h3>
                          {post.content && (
                            <p className="result-description">{post.content.substring(0, 150)}...</p>
                          )}
                          <span className="result-meta">
                            {post.score} points • {post.commentCount} comments
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="no-results">No posts found</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;

