import React, { useState, useEffect } from 'react';
import { Search, LogOut, MessageSquare, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Sidebar = ({ user, setUser, activeChat, setActiveChat, socket }) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchChats();
    if (socket) {
      const fetchChatsWrapper = () => fetchChats();
      socket.on('chat_deleted', fetchChatsWrapper);
      
      const handleNewMessage = (notification) => {
        setChats(prevChats => {
          const chatExists = prevChats.some(c => c._id === notification.chatId);
          if (!chatExists) {
            fetchChats();
            return prevChats;
          }
          
          return prevChats.map(chat => {
            if (chat._id === notification.chatId) {
              if (activeChat?.id !== chat._id) {
                const updatedCounts = { ...(chat.unreadCounts || {}) };
                updatedCounts[user.id] = notification.unreadCount;
                return { 
                  ...chat, 
                  latestMessage: { content: notification.message.text },
                  unreadCounts: updatedCounts
                };
              } else {
                return { 
                  ...chat, 
                  latestMessage: { content: notification.message.text }
                };
              }
            }
            return chat;
          }).sort((a, b) => {
            if (a._id === notification.chatId) return -1;
            if (b._id === notification.chatId) return 1;
            return 0;
          });
        });
      };
      
      socket.on('new_message_notification', handleNewMessage);
      
      return () => {
        socket.off('chat_deleted', fetchChatsWrapper);
        socket.off('new_message_notification', handleNewMessage);
      };
    }
  }, [socket, activeChat, user.id]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get('/chat');
      setChats(data);
    } catch (error) {
      console.error("Failed to load chats", error);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data } = await api.get(`/users?search=${query}`);
      setSearchResults(data);
    } catch (error) {
      console.error("Failed to search users", error);
    }
  };

  const accessChat = async (userId) => {
    try {
      const { data } = await api.post('/chat', { userId });
      // If chat is not already in the list, add it
      if (!chats.find((c) => c._id === data._id)) {
        setChats([data, ...chats]);
      }
      
      const chatObj = {
        id: data._id,
        targetUserId: userId,
        isGroupChat: data.isGroupChat,
        name: data.isGroupChat ? data.chatName : data.users.find(u => u._id !== user.id).username,
        lastMessage: data.latestMessage ? data.latestMessage.content : 'Started a new chat',
      };
      
      setActiveChat(chatObj);
      setIsSearching(false);
      setSearchQuery('');
    } catch (error) {
      console.error("Failed to access chat", error);
    }
  };

  const selectChat = (chat) => {
    const otherUser = chat.users.find(u => u._id !== user.id);
    
    // Tell server we've read these messages
    if (socket) {
      socket.emit('mark_messages_read', chat._id);
    }
    
    // Optimistically update local UI
    setChats(prevChats => prevChats.map(c => {
      if (c._id === chat._id) {
        const updatedCounts = { ...(c.unreadCounts || {}) };
        updatedCounts[user.id] = 0;
        return { ...c, unreadCounts: updatedCounts };
      }
      return c;
    }));

    setActiveChat({
      id: chat._id,
      targetUserId: otherUser ? otherUser._id : null,
      isGroupChat: chat.isGroupChat,
      name: chat.isGroupChat ? chat.chatName : (otherUser ? otherUser.username : 'Unknown'),
      lastMessage: chat.latestMessage ? chat.latestMessage.content : 'No messages yet'
    });
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      navigate('/login');
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const totalUnreadChats = chats.filter(chat => {
    const unreadCount = chat.unreadCounts ? (chat.unreadCounts[user.id] || 0) : 0;
    return unreadCount > 0;
  }).length;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-profile">
          <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <span className="username">{user?.username}</span>
        </div>
        <div className="sidebar-actions">
          <button className="icon-btn" title="New Chat" style={{ position: 'relative' }}>
            <MessageSquare size={20} />
            {totalUnreadChats > 0 && (
              <span className="total-unread-badge">{totalUnreadChats}</span>
            )}
          </button>
          <button className="icon-btn" onClick={handleLogout} title="Logout"><LogOut size={20} /></button>
        </div>
      </div>
      
      <div className="search-bar">
        <div className="search-input-wrapper">
          {isSearching ? (
            <ArrowLeft size={18} className="search-icon" style={{cursor:'pointer'}} onClick={() => { setIsSearching(false); setSearchQuery(''); }} />
          ) : (
            <Search size={18} className="search-icon" />
          )}
          <input 
            type="text" 
            placeholder="Search or start new chat" 
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="chat-list">
        {isSearching ? (
          searchResults.map(searchedUser => (
            <div 
              key={searchedUser._id} 
              className="chat-item"
              onClick={() => accessChat(searchedUser._id)}
            >
              <div className="avatar chat-avatar">{searchedUser.username[0].toUpperCase()}</div>
              <div className="chat-item-details">
                <div className="chat-item-header">
                  <h4>{searchedUser.username}</h4>
                </div>
              </div>
            </div>
          ))
        ) : (
          chats.map(chat => {
            const otherUser = chat.users.find(u => u._id !== user.id);
            const chatName = chat.isGroupChat ? chat.chatName : (otherUser ? otherUser.username : 'Unknown');
            const lastMsg = chat.latestMessage ? chat.latestMessage.content : 'No messages yet';
            const unreadCount = chat.unreadCounts ? (chat.unreadCounts[user.id] || 0) : 0;
            
            return (
              <div 
                key={chat._id} 
                className={`chat-item ${activeChat?.id === chat._id ? 'active' : ''}`}
                onClick={() => selectChat(chat)}
              >
                <div className="avatar chat-avatar">{chatName[0].toUpperCase()}</div>
                <div className="chat-item-details">
                  <div className="chat-item-header">
                    <h4>{chatName}</h4>
                  </div>
                  <p className="last-message">{lastMsg}</p>
                </div>
                {unreadCount > 0 && (
                  <div className="unread-badge">
                    {unreadCount}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
