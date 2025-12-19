import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import InterestsSelection from '../components/InterestsSelection';
import './Auth.css';

const Register = ({ login }) => {
  const [step, setStep] = useState(1); // 1: account info, 2: interests
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [interests, setInterests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Move to interests step
    setStep(2);
  };

  const handleFinalSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        interests: interests
      });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (error) {
      // Handle network errors
      if (!error.response) {
        setError('Cannot connect to server. Make sure the backend is running.');
        return;
      }
      // Handle validation errors
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        setError(errorMessages);
      } else {
        setError(error.response?.data?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Allow skipping interests
    await handleFinalSubmit();
  };

  if (step === 1) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Sign Up</h1>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleAccountSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={20}
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
            <button type="submit" className="auth-button">
              Next
            </button>
          </form>
          <p className="auth-footer">
            Already have an account? <Link to="/login">Log In</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card interests-card">
        {error && <div className="error-message">{error}</div>}
        <InterestsSelection
          selectedInterests={interests}
          onSelectionChange={setInterests}
          maxSelections={3}
        />
        <div className="interests-actions">
          <button
            type="button"
            className="auth-button secondary"
            onClick={() => setStep(1)}
          >
            Back
          </button>
          <button
            type="button"
            className="auth-button secondary"
            onClick={handleSkip}
            disabled={loading}
          >
            Skip
          </button>
          <button
            type="button"
            className="auth-button"
            onClick={handleFinalSubmit}
            disabled={loading}
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </div>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

