const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

function tokenFor(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
    favorites: user.favorites || []
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Name, email and password (minimum 6 characters) are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, passwordHash });
    return res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    return res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function updateProfile(req, res, next) {
  try {
    const { name, avatar } = req.body;
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > 100) return res.status(400).json({ message: 'Name is required and must be 100 characters or less.' });
      req.user.name = cleanName;
    }
    if (avatar !== undefined) {
      if (avatar !== null && typeof avatar !== 'string') return res.status(400).json({ message: 'Invalid avatar.' });
      if (avatar && avatar.length > 2500000) return res.status(413).json({ message: 'Avatar is too large.' });
      req.user.avatar = avatar || null;
    }
    await req.user.save();
    res.json({ message: 'Profile updated successfully.', user: publicUser(req.user) });
  } catch (error) { next(error); }
}

async function toggleFavorite(req, res, next) {
  try {
    const bookId = String(req.params.bookId || '').trim();
    if (!bookId) return res.status(400).json({ message: 'Book id is required.' });
    const index = req.user.favorites.indexOf(bookId);
    if (index >= 0) req.user.favorites.splice(index, 1);
    else req.user.favorites.push(bookId);
    await req.user.save();
    res.json({ favorite: index < 0, favorites: req.user.favorites });
  } catch (error) { next(error); }
}

module.exports = { register, login, me, updateProfile, toggleFavorite };
