const express = require('express');
const router = express.Router();
const controller = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/', authenticate, controller.list);
router.patch('/read-all', authenticate, controller.markAllRead);

module.exports = router;
