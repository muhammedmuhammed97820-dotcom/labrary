const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/user.model');

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatarFileId ? `/api/auth/avatar/${user.avatarFileId}` : user.avatar || null,
    favoritesCount: Array.isArray(user.favorites) ? user.favorites.length : 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function validId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

async function listUsers(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role === 'user' || role === 'admin') filter.role = role;

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);

    const [totalUsers, totalAdmins] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' })
    ]);

    res.json({
      users: users.map(publicUser),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
      stats: { totalUsers, totalAdmins, regularUsers: totalUsers - totalAdmins }
    });
  } catch (error) { next(error); }
}

async function createUser(req, res, next) {
  try {
    const { name, email, password, role = 'user' } = req.body;
    const cleanName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!cleanName || cleanName.length > 100) return res.status(400).json({ message: 'الاسم مطلوب وبحد أقصى 100 حرف.' });
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
    if (!password || String(password).length < 6) return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'صلاحية المستخدم غير صالحة.' });
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'البريد الإلكتروني مستخدم بالفعل.' });

    const user = await User.create({ name: cleanName, email: normalizedEmail, passwordHash: await bcrypt.hash(String(password), 12), role });
    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح.', user: publicUser(user) });
  } catch (error) { next(error); }
}

async function updateUser(req, res, next) {
  try {
    const id = String(req.params.id);
    if (!validId(id)) return res.status(400).json({ message: 'معرف المستخدم غير صالح.' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });

    const { name, email, password, role } = req.body;
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > 100) return res.status(400).json({ message: 'الاسم مطلوب وبحد أقصى 100 حرف.' });
      user.name = cleanName;
    }
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
      const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: id } });
      if (duplicate) return res.status(409).json({ message: 'البريد الإلكتروني مستخدم بالفعل.' });
      user.email = normalizedEmail;
    }
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'صلاحية المستخدم غير صالحة.' });
      if (String(req.user._id) === id && role !== 'admin') return res.status(400).json({ message: 'لا يمكنك إزالة صلاحية المدير من حسابك الحالي.' });
      if (user.role === 'admin' && role === 'user' && await User.countDocuments({ role: 'admin' }) <= 1) {
        return res.status(400).json({ message: 'لا يمكن إزالة آخر مدير في النظام.' });
      }
      user.role = role;
    }
    if (password !== undefined && String(password).length > 0) {
      if (String(password).length < 6) return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
      user.passwordHash = await bcrypt.hash(String(password), 12);
    }

    await user.save();
    res.json({ message: 'تم تحديث المستخدم بنجاح.', user: publicUser(user) });
  } catch (error) { next(error); }
}

async function deleteUser(req, res, next) {
  try {
    const id = String(req.params.id);
    if (!validId(id)) return res.status(400).json({ message: 'معرف المستخدم غير صالح.' });
    if (String(req.user._id) === id) return res.status(400).json({ message: 'لا يمكنك حذف حسابك الحالي.' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });
    if (user.role === 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
      return res.status(400).json({ message: 'لا يمكن حذف آخر مدير في النظام.' });
    }
    await User.deleteOne({ _id: id });
    res.json({ message: 'تم حذف المستخدم بنجاح.' });
  } catch (error) { next(error); }
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
