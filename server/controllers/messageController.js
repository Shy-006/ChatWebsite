const Message = require('../models/Message');
const User = require('../models/User');
const Chat = require('../models/Chat');

exports.allMessages = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    let query = { chat: req.params.chatId };
    
    if (chat && chat.deletedAt) {
      const deletedAtStr = chat.deletedAt.get(req.user._id.toString());
      if (deletedAtStr) {
        query.createdAt = { $gt: new Date(deletedAtStr) };
      }
    }

    const messages = await Message.find(query)
      .populate("sender", "username profilePic")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
