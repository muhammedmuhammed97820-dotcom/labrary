const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const User = require('../models/user.model');
const Book = require('../models/Book');
const { uploadBuffer, getFile, openDownloadStream, deleteFile } = require('../services/gridfs.service');

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
    avatar: user.avatarFileId ? `/api/auth/avatar/${user.avatarFileId}` : user.avatar || null,
    favorites: (user.favorites || []).map(String)
  };
}

function removeLegacyAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') return;
  const prefix = '/uploads/avatars/';
  if (!avatar.startsWith(prefix)) return;
  const filename = path.basename(avatar);
  const filePath = path.resolve(process.env.UPLOAD_AVATARS_DIR || 'uploads/avatars', filename);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (error) { console.warn('Could not remove old avatar:', error.message); }
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

async function getAvatar(req, res, next) {
  try {
    const file = await getFile(req.params.id, 'libraryAvatars');
    if (!file) return res.status(404).json({ message: 'Avatar not found.' });
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return openDownloadStream(req.params.id, 'libraryAvatars').pipe(res);
  } catch (error) { next(error); }
}

async function updateProfile(req, res, next) {
  try {
    const { name, removeAvatar } = req.body;
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > 100) return res.status(400).json({ message: 'Name is required and must be 100 characters or less.' });
      req.user.name = cleanName;
    }

    let newAvatarId = null;
    const oldAvatarId = req.user.avatarFileId;
    const oldLegacyAvatar = req.user.avatar;

    if (req.file) {
      newAvatarId = await uploadBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        { type: 'profile-avatar', userId: req.user._id.toString() },
        'libraryAvatars'
      );
      req.user.avatarFileId = newAvatarId;
      req.user.avatar = null;
    } else if (String(removeAvatar).toLowerCase() === 'true') {
      req.user.avatarFileId = null;
      req.user.avatar = null;
    }

    try {
      await req.user.save();
    } catch (error) {
      if (newAvatarId) await deleteFile(newAvatarId, 'libraryAvatars').catch(() => {});
      throw error;
    }

    if (newAvatarId && oldAvatarId) await deleteFile(oldAvatarId, 'libraryAvatars').catch(() => {});
    if (newAvatarId || String(removeAvatar).toLowerCase() === 'true') removeLegacyAvatar(oldLegacyAvatar);

    res.json({ message: 'Profile updated successfully.', user: publicUser(req.user) });
  } catch (error) { next(error); }
}

async function toggleFavorite(req, res, next) {
  try {
    const bookId = String(req.params.bookId || '').trim();
    if (!bookId) return res.status(400).json({ message: 'Book id is required.' });
    if (!require('mongoose').Types.ObjectId.isValid(bookId)) return res.status(400).json({ message: 'Invalid book id.' });
    if (!(await Book.exists({ _id: bookId }))) return res.status(404).json({ message: 'Book not found.' });

    const favorites = Array.from(new Set((req.user.favorites || []).map(String)));
    const index = favorites.indexOf(bookId);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.push(bookId);
    req.user.favorites = favorites;
    await req.user.save();
    res.json({ favorite: index < 0, favorites });
  } catch (error) { next(error); }
}

module.exports = { register, login, me, getAvatar, updateProfile, toggleFavorite };
