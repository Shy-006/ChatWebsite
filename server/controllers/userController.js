const User = require('../models/User');

// /api/users?search=xyz
exports.searchUsers = async (req, res) => {
  const keyword = req.query.search
    ? {
        username: { $regex: req.query.search, $options: 'i' },
      }
    : {};

  // Find users matching search, exclude the current user
  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } }).select('-password -refreshToken');
  
  res.json(users);
};

// /api/users/:id/status
exports.getUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('lastSeen');
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // We will let the frontend determine if they are currently online by checking
    // if a socket exists, but we return the lastSeen date as a fallback.
    res.json({ lastSeen: user.lastSeen });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
