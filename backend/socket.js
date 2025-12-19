const jwt = require('jsonwebtoken');
const Chat = require('./models/Chat');
const ChatMessage = require('./models/ChatMessage');
const ChatInvite = require('./models/ChatInvite');
const User = require('./models/User');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    // Get token from auth object or headers
    const token = socket.handshake.auth?.token || 
                  socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                  socket.handshake.query?.token;
    
    if (!token) {
      console.log('Socket connection rejected: No token provided');
      console.log('Handshake auth:', socket.handshake.auth);
      console.log('Handshake headers:', socket.handshake.headers);
      return next(new Error('Authentication error: No token provided'));
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return next(new Error('Server configuration error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    
    // Fetch user info for username
    const user = await User.findById(decoded.userId).select('username');
    if (user) {
      socket.username = user.username;
    } else {
      console.warn(`User not found for socket connection: ${decoded.userId}`);
    }
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication error: Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired'));
    }
    return next(new Error('Authentication error: ' + error.message));
  }
};

const initializeSocket = (io) => {
  // Handle connection errors
  io.engine.on('connection_error', (err) => {
    console.error('Socket.io connection error:', err);
  });

  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Join user to their personal room for notifications
    socket.join(`user:${socket.userId}`);
    
    // Emit current unread notification count
    const Notification = require('./models/Notification');
    Notification.countDocuments({ user: socket.userId, read: false })
      .then(count => {
        socket.emit('notification_count', { count });
      })
      .catch(err => console.error('Error fetching notification count:', err));

    // Join user to all their chat rooms
    Chat.find({ members: socket.userId })
      .then(chats => {
        chats.forEach(chat => {
          socket.join(`chat:${chat._id}`);
        });
      })
      .catch(err => console.error('Error joining chat rooms:', err));

    // Handle sending a message
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, replyTo } = data;

        if (!chatId || !content || !content.trim()) {
          socket.emit('error', { message: 'Chat ID and message content are required' });
          return;
        }

        // Verify user is a member of the chat
        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        const isMember = chat.members.some(m => m.toString() === socket.userId);
        if (!isMember) {
          socket.emit('error', { message: 'Not a member of this chat' });
          return;
        }

        // If replying to a message, verify the replyTo message exists and is in the same chat
        if (replyTo) {
          const replyToMessage = await ChatMessage.findById(replyTo);
          if (!replyToMessage) {
            socket.emit('error', { message: 'Message to reply to not found' });
            return;
          }
          if (replyToMessage.chat.toString() !== chatId) {
            socket.emit('error', { message: 'Cannot reply to message from different chat' });
            return;
          }
        }

        // Create and save message
        const message = new ChatMessage({
          chat: chatId,
          sender: socket.userId,
          content: content.trim(),
          replyTo: replyTo || null
        });
        await message.save();

        // Update chat timestamp
        await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

        // Populate sender and replyTo info
        const populatedMessage = await ChatMessage.findById(message._id)
          .populate('sender', 'username')
          .populate('replyTo', 'content sender createdAt')
          .populate({
            path: 'replyTo',
            populate: { path: 'sender', select: 'username' }
          });

        // Emit to all members of the chat
        io.to(`chat:${chatId}`).emit('new_message', populatedMessage);

        // Create notifications for other members
        const Notification = require('./models/Notification');
        const { createNotification } = require('./routes/notifications');
        for (const memberId of chat.members) {
          if (memberId.toString() !== socket.userId) {
            await createNotification(
              memberId,
              'message',
              message._id,
              'ChatMessage',
              socket.userId,
              { chatId: chatId.toString(), chatName: chat.name },
              io
            );
            
            const count = await Notification.countDocuments({ user: memberId, read: false });
            io.to(`user:${memberId}`).emit('notification_count', { count });
          }
        }

        // Emit confirmation to sender
        socket.emit('message_sent', { messageId: message._id });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle joining a chat room (when user opens a chat)
    socket.on('join_chat', async (chatId) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        const isMember = chat.members.some(m => m.toString() === socket.userId);
        if (!isMember) {
          socket.emit('error', { message: 'Not a member of this chat' });
          return;
        }

        socket.join(`chat:${chatId}`);
        socket.emit('joined_chat', { chatId });
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Handle leaving a chat room (when user closes/navigates away from chat)
    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
      socket.emit('left_chat', { chatId });
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        chatId
      });
    });

    // Handle stop typing
    socket.on('stop_typing', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('user_stop_typing', {
        userId: socket.userId,
        username: socket.username,
        chatId
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);
    });
  });

  return io;
};

// Helper function to emit events from REST routes
const emitChatEvent = (io, event, data) => {
  io.emit(event, data);
};

// Helper function to emit to specific chat room
const emitToChat = (io, chatId, event, data) => {
  io.to(`chat:${chatId}`).emit(event, data);
};

// Helper function to emit to specific user
const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

module.exports = {
  initializeSocket,
  emitChatEvent,
  emitToChat,
  emitToUser
};

