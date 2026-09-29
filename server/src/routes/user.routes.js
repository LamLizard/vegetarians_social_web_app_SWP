const express = require('express');
const { getMyProfile, saveMyProfile } = require('../controllers/user.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();
router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, saveMyProfile);

module.exports = router;