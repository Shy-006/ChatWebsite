const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');

/* ===================== TOKEN HELPERS ===================== */
const generateTokens = (userId) => {
	const accessToken = jwt.sign(
		{ userId },
		process.env.ACCESS_TOKEN_SECRET,
		{ expiresIn: "15m" }
	);

	const refreshToken = jwt.sign(
		{ userId },
		process.env.REFRESH_TOKEN_SECRET,
		{ expiresIn: "7d" }
	);

	return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
	await redisClient.set(
		`refresh_token:${userId}`,
		refreshToken,
		"EX",
		7 * 24 * 60 * 60
	);
};

const setCookies = (res, accessToken, refreshToken) => {
	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: true,
		sameSite: "none",
		path: "/",
		maxAge: 15 * 60 * 1000, // 15m
	});

	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: true,
		sameSite: "none",
		path: "/",
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
	});
};

/* ===================== CONTROLLERS ===================== */

exports.signup = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username and password required" });
    
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });

    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    await storeRefreshToken(user._id, refreshToken);
    setCookies(res, accessToken, refreshToken);

    res.status(201).json({ message: "User created successfully", user: { id: user._id, username: user.username } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    await storeRefreshToken(user._id, refreshToken);
    setCookies(res, accessToken, refreshToken);

    res.json({ user: { id: user._id, username: user.username } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token required" });

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid refresh token" });

      const userId = decoded.userId;

      // Check Redis Cache First
      let validToken = await redisClient.get(`refresh_token:${userId}`);

      // If not in cache, fallback to DB
      if (!validToken) {
        const user = await User.findById(userId);
        if (user && user.refreshToken === refreshToken) {
          validToken = user.refreshToken;
          await storeRefreshToken(userId, validToken);
        }
      }

      if (validToken !== refreshToken) {
        return res.status(403).json({ message: "Invalid or expired refresh token" });
      }

      const { accessToken: newAccessToken } = generateTokens(userId);
      
      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 15 * 60 * 1000,
      });

      res.json({ message: "Token refreshed" });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    res.clearCookie('accessToken', { path: "/", sameSite: "none", secure: true });
    res.clearCookie('refreshToken', { path: "/", sameSite: "none", secure: true });

    const token = req.cookies.refreshToken;
    if (token) {
       jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
         if (!err) {
           await User.findByIdAndUpdate(decoded.userId, { refreshToken: "" });
           await redisClient.del(`refresh_token:${decoded.userId}`);
         }
       });
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Token invalid or expired" });
      
      const user = await User.findById(decoded.userId).select('-password -refreshToken');
      if (!user) return res.status(404).json({ message: "User not found" });

      res.json({ user: { id: user._id, username: user.username, profilePic: user.profilePic } });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
