const express = require('express');
const { register, login, me, updateProfile, toggleFavorite } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();
const avatarUpload = upload.single('avatar');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.put('/profile', authenticate, avatarUpload, updateProfile);
router.post('/favorites/:bookId/toggle', authenticate, toggleFavorite);

module.exports = router;
