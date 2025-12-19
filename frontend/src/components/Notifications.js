import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import './Notifications.css';

const Notifications = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Initialize socket connection (only when user changes, not when isOpen changes)
  useEffect(() => {
    if (!user) {
      // Clean up if user logs out
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('Notifications: No token found, skipping socket connection');
      return;
    }
    
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
    console.log('Notifications: Creating socket connection to:', socketUrl, 'with token:', token ? 'present' : 'missing');
    socketRef.current = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // Force new connection to prevent reusing existing connection
      forceNew: true,
      // Add unique query parameter to prevent connection reuse
      query: { timestamp: Date.now(), component: 'notifications' },
      autoConnect: true
    });

    const socket = socketRef.current;

    socket.on('connect_error', (error) => {
      console.error('Notifications socket connection error:', error);
      if (error.message && error.message.includes('Authentication')) {
        console.warn('Notifications socket authentication failed');
      }
    });

    socket.on('notification_count', (data) => {
      setUnreadCount(data.count);
    });

    socket.on('new_notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    fetchUnreadCount();

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]); // Only depend on user, not isOpen

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const res = await axios.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/notifications?limit=20');
      setNotifications(res.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.put(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification._id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'message':
        navigate('/chats');
        break;
      case 'chat_invite':
        navigate('/chats');
        break;
      case 'comment':
        navigate(`/post/${notification.metadata.postId}`);
        break;
      case 'vote':
        navigate(`/post/${notification.relatedId}`);
        break;
      case 'follow':
        navigate(`/profile/${notification.fromUser._id}`);
        break;
      case 'new_post':
        navigate(`/post/${notification.relatedId}`);
        break;
      default:
        break;
    }
    setIsOpen(false);
  };

  const getNotificationText = (notification) => {
    const fromUser = notification.fromUser?.username || 'Someone';
    
    switch (notification.type) {
      case 'message':
        return `${fromUser} sent you a message`;
      case 'chat_invite':
        return `${fromUser} invited you to join "${notification.metadata.chatName || 'a chat'}"`;
      case 'comment':
        return `${fromUser} commented on your post`;
      case 'vote':
        const voteType = notification.metadata.voteType === 'upvote' ? 'upvoted' : 'downvoted';
        return `${fromUser} ${voteType} your post`;
      case 'follow':
        return `${fromUser} started following you`;
      case 'new_post':
        return `New post in r/${notification.metadata.communityName || 'community'}`;
      default:
        return 'New notification';
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!user) return null;

  return (
    <div className="notifications-container" ref={dropdownRef}>
      <button className="notifications-button" onClick={handleToggle}>
        <span className="notifications-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notifications-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={handleMarkAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notifications-list">
            {loading ? (
              <div className="notifications-loading">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notifications-empty">No notifications</div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification._id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-content">
                    <div className="notification-text">{getNotificationText(notification)}</div>
                    <div className="notification-time">{getTimeAgo(notification.createdAt)}</div>
                  </div>
                  {!notification.read && <div className="notification-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;

