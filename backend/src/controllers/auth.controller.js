const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

function tokenFor(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
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

module.exports = { register, login, me };
