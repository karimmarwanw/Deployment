import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Sidebar.css';

const Sidebar = ({ user }) => {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      const response = await axios.get('/communities');
      setCommunities(response.data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-card">
        <div className="sidebar-header">
          <h3>Top Communities</h3>
        </div>
        {loading ? (
          <div className="sidebar-loading">Loading...</div>
        ) : (
          <div className="sidebar-content">
            {communities.map((community, index) => (
              <Link
                key={community._id}
                to={`/r/${community.name}`}
                className="sidebar-item"
              >
                <span className="sidebar-number">{index + 1}</span>
                <div className="sidebar-item-content">
                  <span className="sidebar-item-name">r/{community.name}</span>
                  <span className="sidebar-item-meta">
                    {community.memberCount} members
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {user && (
          <div className="sidebar-footer">
            <Link to="/create-community" className="sidebar-button">
              Create Community
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;

