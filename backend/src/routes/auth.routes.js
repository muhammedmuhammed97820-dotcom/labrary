const express = require('express');
const { register, login, me, getAvatar, updateProfile, toggleFavorite } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const avatarUpload = require('../middleware/avatar-upload.middleware');

const router = express.Router();
const avatarUploadHandler = avatarUpload.single('avatar');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.get('/avatar/:id', getAvatar);
router.put('/profile', authenticate, avatarUploadHandler, updateProfile);
router.post('/favorites/:bookId/toggle', authenticate, toggleFavorite);

module.exports = router;
