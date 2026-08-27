const express = require('express');
const { register, login, me, updateProfile, toggleFavorite } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.post('/favorites/:bookId/toggle', authenticate, toggleFavorite);

module.exports = router;
