const express = require('express');
const router = express.Router();
const controller = require('../controllers/smart-importer.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.use(authenticate, requireAdmin);
router.post('/preview', controller.preview);
router.post('/approve', controller.approve);

module.exports = router;
