const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  isGroupChat: { type: Boolean, default: false },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  chatName: { type: String },
  unreadCounts: { type: Map, of: Number, default: {} },
  deletedAt: { type: Map, of: Date, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
