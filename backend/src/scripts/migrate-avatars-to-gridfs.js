require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const connectDatabase = require('../config/database');
const { uploadBuffer } = require('../services/gridfs.service');

async function main() {
  await connectDatabase();
  const users = await User.find({ avatar: { $regex: '^/uploads/avatars/' }, avatarFileId: null });
  const avatarsDir = path.resolve(process.env.UPLOAD_AVATARS_DIR || 'uploads/avatars');
  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const filename = path.basename(user.avatar || '');
    const filePath = path.join(avatarsDir, filename);
    if (!filename || !fs.existsSync(filePath)) {
      skipped++;
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    const fileId = await uploadBuffer(buffer, filename, contentType, {
      type: 'profile-avatar',
      userId: user._id.toString(),
      migratedFrom: user.avatar
    }, 'libraryAvatars');

    user.avatarFileId = fileId;
    user.avatar = null;
    await user.save();
    migrated++;
  }

  console.log(`Avatar migration complete. Migrated: ${migrated}, skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
