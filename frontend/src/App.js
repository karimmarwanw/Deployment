import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Community from './pages/Community';
import CreateCommunity from './pages/CreateCommunity';
import CreatePost from './pages/CreatePost';
import EditPost from './pages/EditPost';
import PostDetail from './pages/PostDetail';
import Search from './pages/Search';
import Chats from './pages/Chats';
import SelectCommunity from './pages/SelectCommunity';
import './App.css';

// Set axios default base URL
// In development, use proxy from package.json (relative URLs)
// In production, use full URL from env variable
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Navbar user={user} logout={logout} />
          <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <Login login={login} />} 
          />
          <Route 
            path="/register" 
            element={user ? <Navigate to="/" /> : <Register login={login} />} 
          />
          <Route 
            path="/profile/:id" 
            element={<Profile user={user} />} 
          />
          <Route 
            path="/r/:name" 
            element={<Community user={user} />} 
          />
          <Route 
            path="/create-community" 
            element={user ? <CreateCommunity user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/chats" 
            element={user ? <Chats user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/create-post" 
            element={user ? <SelectCommunity user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/r/:name/submit" 
            element={user ? <CreatePost user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/post/:id" 
            element={<PostDetail user={user} />} 
          />
          <Route 
            path="/post/:id/edit" 
            element={user ? <EditPost user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/search" 
            element={<Search user={user} />} 
          />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
