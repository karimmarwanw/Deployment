import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './SelectCommunity.css';

const SelectCommunity = ({ user }) => {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      const response = await axios.get('/communities');
      setCommunities(response.data);
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCommunity = (communityName) => {
    navigate(`/r/${communityName}/submit`);
  };

  const filteredCommunities = communities.filter(community =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (community.displayName && community.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container">
      <div className="main-content">
        <div className="select-community-page">
          <h1>Choose a community to post in</h1>
          <p className="select-community-subtitle">Select a community where you'd like to share your post</p>
          
          <div className="community-search">
            <input
              type="text"
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="community-search-input"
            />
          </div>

          {loading ? (
            <div className="loading">Loading communities...</div>
          ) : (
            <div className="communities-list">
              {filteredCommunities.length === 0 ? (
                <div className="empty-state">No communities found</div>
              ) : (
                filteredCommunities.map(community => (
                  <div
                    key={community._id}
                    className="community-item"
                    onClick={() => handleSelectCommunity(community.name)}
                  >
                    <div className="community-item-content">
                      <div className="community-item-name">r/{community.name}</div>
                      {community.displayName && (
                        <div className="community-item-display">{community.displayName}</div>
                      )}
                      {community.description && (
                        <div className="community-item-description">{community.description}</div>
                      )}
                      <div className="community-item-meta">
                        {community.memberCount || 0} members
                      </div>
                    </div>
                    <div className="community-item-arrow">→</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectCommunity;

