import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import Notifications from './Notifications';
import './Navbar.css';

const Navbar = ({ user, logout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="reddit-logo">PostIt</span>
        </Link>
        
        <form className="navbar-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search Reddit"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </form>

        <div className="navbar-actions">
          <button 
            className="theme-toggle-button" 
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user ? (
            <>
              <Notifications user={user} />
              <Link to="/create-post" className="nav-link">Create Post</Link>
              <Link to="/create-community" className="nav-link">Create Community</Link>
              <Link to="/chats" className="nav-link">Open Chat</Link>
              <Link to={`/profile/${user._id}`} className="nav-link">
                {user.username}
              </Link>
              <button onClick={logout} className="nav-button">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Log In</Link>
              <Link to="/register" className="nav-button primary">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
