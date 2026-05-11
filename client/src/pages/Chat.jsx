import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import './Chat.css';

const Chat = ({ user, setUser }) => {
  const [socket, setSocket] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    if (user) {
      const newSocket = io('http://localhost:5000', {
        withCredentials: true
      });
      
      setSocket(newSocket);
      
      return () => newSocket.close();
    }
  }, [user]);

  // We add dynamic classes to handle mobile responsive switching.
  // On mobile, if a chat is active, we hide the sidebar and show chat.
  // If no chat is active, we show the sidebar and hide chat.
  const isChatActive = activeChat !== null;

  return (
    <div className="chat-app-container">
      <div className="chat-app-inner">
        <div className={`chat-sidebar-wrapper ${isChatActive ? 'hidden-on-mobile' : ''}`}>
          <Sidebar 
            user={user} 
            setUser={setUser}
            activeChat={activeChat} 
            setActiveChat={setActiveChat} 
            socket={socket} 
          />
        </div>
        
        <div className={`chat-window-wrapper ${!isChatActive ? 'hidden-on-mobile' : ''}`}>
          {activeChat ? (
            <ChatWindow 
              user={user} 
              activeChat={activeChat} 
              setActiveChat={setActiveChat}
              socket={socket} 
            />
          ) : (
            <div className="empty-chat-state">
              <div className="empty-chat-content">
                <div className="empty-chat-icon">💬</div>
                <h2>WhatsApp Clone</h2>
                <p>Select a chat to start messaging.</p>
                <p className="encryption-notice">🔒 End-to-end encryption is not enabled</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
