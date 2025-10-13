const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const { SECRET_KEY } = require('../config/server-config');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    otp: {
        type: String,
    },
    otpExpiry: {
        type: Date,
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await argon2.hash(this.password);
    }
    next();
});

userSchema.methods.comparePassword = async function compare(password) {
    return await argon2.verify(this.password, password);
}

userSchema.methods.genJWT = function generate() {
    const payload = {
        id: this._id,
        email: this.email
    };
    return jwt.sign(payload, SECRET_KEY, {
        expiresIn: '1d'
    });
}

const User = mongoose.model('User', userSchema);
module.exports = User;