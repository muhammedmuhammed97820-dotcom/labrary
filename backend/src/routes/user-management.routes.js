const express = require('express');
const controller = require('../controllers/user-management.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, requireAdmin);
router.get('/', controller.listUsers);
router.post('/', controller.createUser);
router.put('/:id', controller.updateUser);
router.delete('/:id', controller.deleteUser);

module.exports = router;
