require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

(async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  await mongoose.connect(MONGODB_URI || 'mongodb://127.0.0.1:27017/electronic_library');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase().trim() },
    { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase().trim(), passwordHash, role: 'admin' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin ready: ${user.email}`);
  await mongoose.disconnect();
})().catch(error => { console.error(error.message); process.exit(1); });
