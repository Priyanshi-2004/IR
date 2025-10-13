const express = require('express');
const router = express.Router();
const { signUp, signIn, verifyOTP, forgotPassword, resetPassword } = require('../controllers/user-controller');

router.post('/sign-up', signUp);
router.post('/verify-otp', verifyOTP);
router.post('/sign-in', signIn);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;