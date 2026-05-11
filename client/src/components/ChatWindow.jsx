import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Send, Smile, Paperclip, ArrowLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import api from '../services/api';

const formatLastSeen = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return `Active a few seconds ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Active ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Active ${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return `Active yesterday`;
  return `Last seen on ${date.toLocaleDateString()}`;
};

const ChatWindow = ({ user, activeChat, setActiveChat, socket }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [statusText, setStatusText] = useState('Fetching status...');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    if (!activeChat) return;
    try {
      const { data } = await api.get(`/message/${activeChat.id}`);
      const formattedMessages = data.map(msg => ({
        id: msg._id,
        chatId: msg.chat._id,
        senderId: msg.sender._id,
        text: msg.content,
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setMessages(formattedMessages);
      socket.emit('join_chat', activeChat.id);
    } catch (error) {
      console.error("Failed to fetch messages", error);
    }
  };

  const fetchUserStatus = async () => {
    if (!activeChat || activeChat.isGroupChat || !activeChat.targetUserId) {
      return;
    }
    
    try {
      const { data } = await api.get(`/users/${activeChat.targetUserId}/status`);
      setStatusText(formatLastSeen(data.lastSeen));
      socket.emit('check_user_status', activeChat.targetUserId);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchUserStatus();
  }, [activeChat]);

  useEffect(() => {
    if (socket && activeChat) {
      const handleReceiveMessage = (data) => {
        if (data.chatId === activeChat.id) {
          setMessages(prev => [...prev, data]);
          socket.emit('mark_messages_read', activeChat.id);
        }
      };

      const handleStatusChange = (data) => {
        if (activeChat.targetUserId === data.userId) {
          if (data.status === 'online') {
            setStatusText('Online');
          } else {
            setStatusText(formatLastSeen(data.lastSeen));
          }
        }
      };

      const handleMessageDeleted = (messageId) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      };

      const handleChatDeleted = (chatId) => {
        if (activeChat.id === chatId) {
          setActiveChat(null);
          toast.success("Chat was deleted");
        }
      };

      socket.on('receive_message', handleReceiveMessage);
      socket.on('user_status_change', handleStatusChange);
      socket.on('message_deleted', handleMessageDeleted);
      socket.on('chat_deleted', handleChatDeleted);

      return () => {
        socket.off('receive_message', handleReceiveMessage);
        socket.off('user_status_change', handleStatusChange);
        socket.off('message_deleted', handleMessageDeleted);
        socket.off('chat_deleted', handleChatDeleted);
      };
    }
  }, [socket, activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
      const msgData = {
        chatId: activeChat.id,
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      socket.emit('send_message', msgData);
      
      const optimisticMsg = {
        id: Date.now(), // Temporary ID until we re-fetch or socket returns true ID
        chatId: activeChat.id,
        senderId: user.id,
        text: message,
        time: msgData.time,
        temp: true
      };
      
      setMessages(prev => [...prev, optimisticMsg]);
      setMessage('');
    }
  };

  const handleDeleteMessage = (messageId, isTemp) => {
    if (isTemp) return toast.error("Wait a moment before deleting this message");
    socket.emit('delete_message', { messageId, chatId: activeChat.id });
  };

  const handleDeleteChat = () => {
    if (window.confirm("Are you sure you want to delete this entire chat for everyone?")) {
      socket.emit('delete_chat', { chatId: activeChat.id });
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage(prev => prev + emojiObject.emoji);
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-info">
          <button className="icon-btn back-btn" onClick={() => setActiveChat(null)}>
            <ArrowLeft size={24} />
          </button>
          <div className="avatar chat-avatar">{activeChat.name[0].toUpperCase()}</div>
          <div className="chat-header-details">
            <h3>{activeChat.name}</h3>
            <span>{activeChat.isGroupChat ? 'Group Chat' : statusText}</span>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn" onClick={handleDeleteChat} title="Delete Chat">
            <Trash2 size={20} color="#ea0038" />
          </button>
          <button className="icon-btn"><Search size={20} /></button>
          <button className="icon-btn"><MoreVertical size={20} /></button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => {
          const isSent = msg.senderId === user.id;
          return (
            <div key={msg.id || index} className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
              <div className="message-bubble">
                <p className="message-text">{msg.text}</p>
                <span className="message-time">{msg.time}</span>
                {isSent && (
                  <button 
                    className="msg-delete-btn" 
                    onClick={() => handleDeleteMessage(msg.id, msg.temp)}
                    title="Delete message for everyone"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area" style={{ position: 'relative' }}>
        {showEmojiPicker && (
          <div className="emoji-picker-container">
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </div>
        )}
        <button 
          className="icon-btn" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          type="button"
        >
          <Smile size={24} />
        </button>
        <button className="icon-btn"><Paperclip size={24} /></button>
        <form className="message-form" onSubmit={handleSendMessage}>
          <input 
            type="text" 
            placeholder="Type a message" 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button 
            type="submit" 
            className="icon-btn send-btn"
            disabled={!message.trim()}
          >
            <Send size={24} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
