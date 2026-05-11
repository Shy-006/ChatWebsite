require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const Message = require('./models/Message');
const Chat = require('./models/Chat');

const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Socket.io authentication middleware
io.use((socket, next) => {
  let token = null;
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, current) => {
      const [name, value] = current.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    token = cookies.accessToken;
  }

  if (!token) return next(new Error("Authentication error: No token provided"));
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return next(new Error("Authentication error: Invalid token"));
    // Add the user object mapping decoded.userId to id for backward compatibility
    socket.user = { id: decoded.userId, ...decoded };
    next();
  });
});

const User = require('./models/User');

const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.user.id;
  console.log(`User connected: ${socket.user.username} (${userId})`);
  
  // Track online status
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    // Broadcast to others that user came online
    socket.broadcast.emit('user_status_change', { userId, status: 'online' });
  }
  onlineUsers.get(userId).add(socket.id);

  socket.join(userId);

  socket.on('check_user_status', (targetUserId) => {
    if (onlineUsers.has(targetUserId)) {
      socket.emit('user_status_change', { userId: targetUserId, status: 'online' });
    }
  });

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('send_message', async (messageData) => {
    try {
      const newMessage = await Message.create({
        sender: socket.user.id,
        content: messageData.text,
        chat: messageData.chatId
      });
      
      const chat = await Chat.findById(messageData.chatId);
      
      // Increment unread counts for all users except sender
      if (chat) {
        chat.users.forEach(uId => {
          const uIdStr = uId.toString();
          if (uIdStr !== socket.user.id) {
            const currentCount = chat.unreadCounts ? (chat.unreadCounts.get(uIdStr) || 0) : 0;
            if (!chat.unreadCounts) chat.unreadCounts = new Map();
            chat.unreadCounts.set(uIdStr, currentCount + 1);
          }
        });
        chat.latestMessage = newMessage._id;
        await chat.save();
      }
      
      const fullMessage = await Message.findById(newMessage._id).populate("sender", "username profilePic");
      
      const msgToClient = {
        id: fullMessage._id,
        chatId: messageData.chatId,
        senderId: socket.user.id,
        text: fullMessage.content,
        time: messageData.time
      };

      socket.to(messageData.chatId).emit('receive_message', msgToClient);
      
      // Also emit a notification to each receiver's personal room for unread counts
      if (chat) {
        chat.users.forEach(uId => {
          const uIdStr = uId.toString();
          if (uIdStr !== socket.user.id) {
            socket.to(uIdStr).emit('new_message_notification', {
              chatId: messageData.chatId,
              message: msgToClient,
              unreadCount: chat.unreadCounts.get(uIdStr)
            });
          }
        });
      }
    } catch(err) {
      console.error(err);
    }
  });

  socket.on('delete_message', async ({ messageId, chatId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;
      // Ensure only the sender can delete their message
      if (msg.sender.toString() !== socket.user.id) return; 

      await Message.findByIdAndDelete(messageId);

      const chat = await Chat.findById(chatId);
      if (chat && chat.latestMessage && chat.latestMessage.toString() === messageId) {
        const newLatest = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 });
        await Chat.findByIdAndUpdate(chatId, { latestMessage: newLatest ? newLatest._id : null });
      }

      // Emit to everyone in the room, including sender
      io.to(chatId).emit('message_deleted', messageId);
    } catch(err) {
      console.error(err);
    }
  });

  socket.on('delete_chat', async ({ chatId }) => {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      if (!chat.users.includes(socket.user.id)) return;

      await Message.deleteMany({ chat: chatId });
      await Chat.findByIdAndDelete(chatId);

      io.to(chatId).emit('chat_deleted', chatId);
    } catch(err) {
      console.error(err);
    }
  });

  socket.on('mark_messages_read', async (chatId) => {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      
      if (!chat.unreadCounts) chat.unreadCounts = new Map();
      chat.unreadCounts.set(socket.user.id, 0);
      await chat.save();
    } catch(err) {
      console.error(err);
    }
  });

  socket.on('disconnect', async () => {
    if (onlineUsers.has(userId)) {
      const userSockets = onlineUsers.get(userId);
      userSockets.delete(socket.id);
      
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        const lastSeenDate = new Date();
        await User.findByIdAndUpdate(userId, { lastSeen: lastSeenDate });
        // Broadcast offline status
        socket.broadcast.emit('user_status_change', { userId, status: 'offline', lastSeen: lastSeenDate });
      }
    }
    console.log(`User disconnected: ${socket.user.username}`);
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await connectRedis(); // This will no longer crash if Redis isn't running
  
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
