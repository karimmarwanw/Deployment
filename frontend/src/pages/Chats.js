import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './Chats.css';

const Chats = ({ user }) => {
  const [chats, setChats] = useState([]);
  const [invites, setInvites] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', inviteUsernames: '' });
  const [typingUsers, setTypingUsers] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);
  const messageSentHandlerRef = useRef(null);
  const selectedChatIdRef = useRef(selectedChatId);
  const isConnectingRef = useRef(false);

  // Initialize socket connection (only once when component mounts or user changes)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      // Clean up if no user/token
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      isConnectingRef.current = false;
      return;
    }

    // Prevent duplicate connections (important for React StrictMode)
    if (isConnectingRef.current || (socketRef.current && socketRef.current.connected)) {
      console.log('Socket already connecting or connected, skipping...');
      return;
    }

    // Disconnect existing socket if any (prevent duplicates)
    if (socketRef.current) {
      console.log('Cleaning up existing socket connection');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    isConnectingRef.current = true;

    // Use environment variable or default to localhost:5001 (backend port)
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
    console.log('Creating new socket connection to:', socketUrl, 'with token:', token ? 'present' : 'missing');
    
    if (!token) {
      console.error('Cannot create socket connection: No token found');
      isConnectingRef.current = false;
      return;
    }
    
    socketRef.current = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // Force new connection to prevent reusing existing connection
      forceNew: true,
      // Add unique query parameter to prevent connection reuse
      query: { timestamp: Date.now(), component: 'chats' },
      // Don't auto-connect if auth fails
      autoConnect: true
    });

    const socket = socketRef.current;

    // Socket event listeners
    socket.on('connect', () => {
      console.log('Socket connected');
      isConnectingRef.current = false;
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      isConnectingRef.current = false;
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      isConnectingRef.current = false;
      // Log the error but don't show alert for auth errors (user might not be logged in)
      if (error.message && error.message.includes('Authentication')) {
        console.warn('Socket authentication failed - user may need to log in');
      } else {
        console.error('Socket connection failed:', error.message);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      isConnectingRef.current = false;
    });

    // Real-time message events
    socket.on('new_message', (message) => {
      setMessages(prev => {
        // Remove temporary message if exists (optimistic update)
        const filtered = prev.filter(m => !m._id.startsWith('temp-'));
        
        // Avoid duplicates
        if (filtered.some(m => m._id === message._id)) {
          return filtered;
        }
        return [...filtered, message];
      });
      
      // Refresh chats to update ordering
      fetchChats();
    });

    socket.on('message_sent', () => {
      setSending(false);
    });

    // Chat update events
    socket.on('chat_created', (chat) => {
      setChats(prev => {
        // Avoid duplicates
        if (prev.some(c => c._id === chat._id)) {
          return prev;
        }
        return [chat, ...prev];
      });
    });

    socket.on('chat_invite_received', (data) => {
      fetchInvites();
    });

    socket.on('chat_invite_accepted', (data) => {
      fetchChats();
      fetchInvites();
      if (data.chat) {
        setChats(prev => {
          const exists = prev.find(c => c._id === data.chat._id);
          if (exists) {
            return prev.map(c => c._id === data.chat._id ? data.chat : c);
          }
          return [data.chat, ...prev];
        });
      }
    });

    socket.on('chat_member_joined', (data) => {
      if (data.chat) {
        setChats(prev => prev.map(c => 
          c._id === data.chat._id ? data.chat : c
        ));
        
        // Update selected chat if it's the one that was updated
        if (selectedChatId === data.chat._id) {
          setChats(prev => {
            const updated = prev.find(c => c._id === data.chat._id);
            return prev;
          });
        }
      }
    });

    socket.on('chat_member_left', (data) => {
      if (data.chat) {
        setChats(prev => prev.map(c => 
          c._id === data.chat._id ? data.chat : c
        ));
      }
    });

    socket.on('chat_left', (data) => {
      // Remove chat from list if user left it
      setChats(prev => prev.filter(c => c._id !== data.chatId));
      
      // If the left chat was selected, clear selection
      if (selectedChatId === data.chatId) {
        setSelectedChatId(null);
        setMessages([]);
        setReplyingTo(null);
      }
    });

    socket.on('joined_chat', (data) => {
      console.log('Joined chat:', data.chatId);
    });

    // Typing indicators - use ref to get current selectedChatId
    socket.on('user_typing', (data) => {
      const userId = user._id || user.id;
      // Use ref to get current selectedChatId value
      if (data.chatId === selectedChatIdRef.current && data.userId !== userId) {
        setTypingUsers(prev => ({
          ...prev,
          [data.userId]: data.username
        }));
      }
    });

    socket.on('user_stop_typing', (data) => {
      if (data.chatId === selectedChatIdRef.current) {
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[data.userId];
          return updated;
        });
      }
    });

    // Cleanup function: remove all listeners and disconnect
    return () => {
      isConnectingRef.current = false;
      if (socketRef.current) {
        console.log('Cleaning up socket on unmount');
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]); // Only depend on user, not selectedChatId

  useEffect(() => {
    fetchChats();
    fetchInvites();
  }, []);

  useEffect(() => {
    // Update ref whenever selectedChatId changes
    selectedChatIdRef.current = selectedChatId;
    
    if (selectedChatId && socketRef.current) {
      // Join the chat room
      socketRef.current.emit('join_chat', selectedChatId);
      fetchMessages(selectedChatId);
      // Clear reply state when switching chats
      setReplyingTo(null);
    } else {
      setMessages([]);
      setReplyingTo(null);
    }

    return () => {
      if (selectedChatId && socketRef.current) {
        socketRef.current.emit('leave_chat', selectedChatId);
      }
    };
  }, [selectedChatId]);

  const fetchChats = async () => {
    try {
      const res = await axios.get('/chats/my');
      setChats(res.data || []);
      if (!selectedChatId && res.data && res.data.length > 0) {
        setSelectedChatId(res.data[0]._id);
      }
    } catch (err) {
      console.error('Error fetching chats', err);
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await axios.get('/chats/invites?direction=incoming');
      setInvites(res.data || []);
    } catch (err) {
      console.error('Error fetching invites', err);
    }
  };

  const fetchMessages = async (chatId) => {
    setLoadingMessages(true);
    try {
      const res = await axios.get(`/chats/${chatId}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error('Error fetching messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const inviteUsernames = createForm.inviteUsernames
        .split(',')
        .map(u => u.trim())
        .filter(Boolean);
      await axios.post('/chats', {
        name: createForm.name.trim(),
        inviteUsernames
      });
      setCreateForm({ name: '', inviteUsernames: '' });
      await fetchChats();
      await fetchInvites();
    } catch (err) {
      console.error('Error creating chat', err);
      alert(err.response?.data?.message || 'Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChatId || !socketRef.current) return;
    
    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');
    
    // Stop typing indicator
    if (socketRef.current) {
      socketRef.current.emit('stop_typing', { chatId: selectedChatId });
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    try {
      // Send via socket for real-time delivery
      socketRef.current.emit('send_message', {
        chatId: selectedChatId,
        content: messageContent,
        replyTo: replyingTo?._id || null
      });
      
      // Optimistically add message (will be replaced by server response)
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        chat: selectedChatId,
        sender: { _id: user._id || user.id, username: user.username },
        content: messageContent,
        replyTo: replyingTo || null,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempMessage]);
      
      // Clear reply selection
      setReplyingTo(null);
      
      // Clear any existing fallback timeout
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
      
      // Remove any existing message_sent handler
      if (messageSentHandlerRef.current) {
        socketRef.current?.off('message_sent', messageSentHandlerRef.current);
      }
      
      // The message_sent event will set sending to false
      // If no response after 5 seconds, fallback to REST API
      fallbackTimeoutRef.current = setTimeout(() => {
        axios.post(`/chats/${selectedChatId}/messages`, { 
          content: messageContent,
          replyTo: replyingTo?._id || null
        })
          .then(() => {
            fetchMessages(selectedChatId);
            fetchChats();
            setSending(false);
          })
          .catch(err => {
            console.error('Error sending message via REST', err);
            alert(err.response?.data?.message || 'Failed to send message');
            setSending(false);
          });
        fallbackTimeoutRef.current = null;
      }, 5000);
      
      // Clear fallback if message_sent is received
      messageSentHandlerRef.current = () => {
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
          fallbackTimeoutRef.current = null;
        }
        setSending(false);
        if (socketRef.current && messageSentHandlerRef.current) {
          socketRef.current.off('message_sent', messageSentHandlerRef.current);
          messageSentHandlerRef.current = null;
        }
      };
      socketRef.current?.on('message_sent', messageSentHandlerRef.current);
    } catch (err) {
      console.error('Error sending message', err);
      alert('Failed to send message');
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!socketRef.current || !selectedChatId) return;
    
    socketRef.current.emit('typing', { chatId: selectedChatId });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('stop_typing', { chatId: selectedChatId });
      }
    }, 3000);
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      await axios.post(`/chats/invites/${inviteId}/accept`);
      await fetchInvites();
      await fetchChats();
    } catch (err) {
      console.error('Error accepting invite', err);
    }
  };

  const handleRejectInvite = async (inviteId) => {
    try {
      await axios.post(`/chats/invites/${inviteId}/reject`);
      await fetchInvites();
    } catch (err) {
      console.error('Error rejecting invite', err);
    }
  };

  const handleLeaveChat = async (chatId) => {
    if (!window.confirm('Are you sure you want to leave this chat? You will no longer receive messages from this chat.')) {
      return;
    }

    try {
      // Leave the socket room
      if (socketRef.current) {
        socketRef.current.emit('leave_chat', chatId);
      }
      
      await axios.post(`/chats/${chatId}/leave`);
      await fetchChats();
      
      // If the left chat was selected, clear selection
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setMessages([]);
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('Error leaving chat', err);
      alert(err.response?.data?.message || 'Failed to leave chat');
    }
  };

  const selectedChat = chats.find(c => c._id === selectedChatId);

  return (
    <div className="container">
      <div className="main-content chats-layout">
        <div className="chats-sidebar">
          <div className="chats-header">
            <h1>Chats</h1>
            <p className="chats-subtitle">Start a group chat and invite other users by username.</p>
          </div>

          <form className="create-chat-form" onSubmit={handleCreateChat}>
            <input
              type="text"
              placeholder="Chat name"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Invite usernames (comma separated)"
              value={createForm.inviteUsernames}
              onChange={(e) => setCreateForm({ ...createForm, inviteUsernames: e.target.value })}
            />
            <button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Chat'}
            </button>
          </form>

          <div className="invites-section">
            <div className="section-title">Requests</div>
            {invites.length === 0 ? (
              <div className="empty-state">No requests</div>
            ) : (
              invites.map(invite => (
                <div key={invite._id} className="invite-item">
                  <div>
                    <div className="invite-chat">{invite.chat?.name || 'Chat'}</div>
                    <div className="invite-meta">from {invite.fromUser?.username || 'User'}</div>
                  </div>
                  {invite.status === 'pending' ? (
                    <div className="invite-actions">
                      <button onClick={() => handleAcceptInvite(invite._id)}>Accept</button>
                      <button className="secondary" onClick={() => handleRejectInvite(invite._id)}>Reject</button>
                    </div>
                  ) : (
                    <div className="invite-status">{invite.status}</div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="section-title">Threads</div>
          <div className="chat-list">
            {chats.length === 0 && <div className="empty-state">No chats yet</div>}
            {chats.map(chat => (
              <button
                key={chat._id}
                className={`chat-item ${selectedChatId === chat._id ? 'active' : ''}`}
                onClick={() => setSelectedChatId(chat._id)}
              >
                <div className="chat-name">{chat.name}</div>
                <div className="chat-members">
                  {chat.members?.map(m => m.username).join(', ')}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="chats-panel">
          {selectedChat ? (
            <>
              <div className="messages-header">
                <div>
                  <div className="chat-title">{selectedChat.name}</div>
                  <div className="chat-members-line">
                    Members: {selectedChat.members?.map(m => m.username).join(', ')}
                  </div>
                </div>
                <button 
                  className="leave-chat-button"
                  onClick={() => handleLeaveChat(selectedChat._id)}
                  title="Leave this chat"
                >
                  Leave Chat
                </button>
              </div>

              <div className="messages-list">
                {loadingMessages ? (
                  <div className="loading">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">No messages yet</div>
                ) : (
                  messages.map(msg => (
                    <div key={msg._id} className="message-item">
                      {msg.replyTo && (
                        <div className="message-reply-context">
                          <span className="reply-to-label">Replying to {msg.replyTo.sender?.username || 'User'}:</span>
                          <span className="reply-to-content">{msg.replyTo.content}</span>
                        </div>
                      )}
                      <div className="message-header">
                        <div className="message-meta">
                          <span className="message-sender">{msg.sender?.username || 'User'}</span>
                          <span className="message-time">{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <button 
                          className="reply-button"
                          onClick={() => setReplyingTo(msg)}
                          title="Reply to this message"
                        >
                          Reply
                        </button>
                      </div>
                      <div className="message-content">{msg.content}</div>
                    </div>
                  ))
                )}
              </div>

              {Object.keys(typingUsers).length > 0 && (
                <div className="typing-indicator">
                  {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
              {replyingTo && (
                <div className="reply-preview">
                  <div className="reply-preview-content">
                    <span className="reply-preview-label">Replying to {replyingTo.sender?.username || 'User'}:</span>
                    <span className="reply-preview-text">{replyingTo.content}</span>
                  </div>
                  <button 
                    className="reply-preview-cancel"
                    onClick={() => setReplyingTo(null)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              )}
              <form className="message-input" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder={replyingTo ? `Reply to ${replyingTo.sender?.username || 'message'}...` : "Message"}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !newMessage.trim()}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="empty-state">Select or create a chat</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chats;
