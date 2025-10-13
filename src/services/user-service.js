const User = require('../models/user-model.js');
const { generateOTP, sendOTPByEmail, hashOTP, verifyHashedOTP } = require('../helpers/otp-helper.js');

class UserService {
    async create(payload) {
        try {
            const user = await User.create(payload);
            return user;
        } catch (error) {
            if (error.code === 11000) {
                console.log("user already exists, create method called from UserRepository and throws error: ", error);
                throw new Error("user already exists");
            }
            console.log("unable to create a new user, create method called from UserRepository and throws error: ", error);
            throw error;
        }
    }
    async sendOTP(payload) {
        try {
            const email = payload.email;
            const user = await User.findOne({ email: email });
            if (!user) {
                throw new Error('user not found');
            }
            const OTP = generateOTP();
            sendOTPByEmail(email, OTP);
            await User.updateOne(
                { email },
                {
                    $set: {
                        otp: hashOTP(OTP),
                        otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
                    }
                }
            );
            return true;
        } catch (error) {
            console.log('unable to send otp, UserService throws error: ', error);
            if (error.message === 'user not found') {
                throw new Error('user not found');
            }
            throw error;
        }
    }

    async findByEmail(email) {
        try {
            const user = await User.findOne({ email: email });
            if (!user) {
                console.log("No user found with the given email.");
                throw new Error("user not found");
            }
            return user;
        } catch (error) {
            console.log("unable to find user by email, findByEmail method called from UserRepository and throws error: ", error);
            throw error;
        }
    }

    async findById(id) {
        try {
            const user = await User.findById(id);
            if (!user) {
                console.log("No user found with the given ID.");
                throw new Error("user not found");
            }
            return user;
        } catch (error) {
            console.log("unable to find user by ID, findById method called from UserRepository and throws error: ", error);
            throw error;
        }
    }
    async signIn(data) {
        try {
            const user = await this.findByEmail(data.email);
            const isPasswordMatch = await user.comparePassword(data.password);
            if (!isPasswordMatch) {
                throw new Error('Incorrect Password');
            }
            if (!user.isVerified) {
                throw new Error('Email not verified');
            }
            const token = user.genJWT();
            return token;
        }
        catch (error) {
            console.log('unable to sign in, UserService throws error: ', error);
            if (error.message === 'user not found') {
                throw new Error('user not found');
            }
            throw error;
        }
    }

    async update(email, otp) {
        try {
            await User.updateOne(
                { email },
                { $set: { otp } },
            );
            return true;
        } catch (error) {
            console.log("unable to update user, update method called from UserRepository and throws error: ", error);
            throw error;
        }
    }
    async findUnverifiedUsers() {
        try {
            const unverifiedUsers = await User.find({ isVerified: false });
            return unverifiedUsers;
        } catch (error) {
            console.error("Error fetching unverified users from UserRepository:", error);
            throw new Error('An error occurred while fetching unverified users.');
        }
    }
    async sendForgotPasswordOTP(email) {
        try {
            const user = await this.findByEmail(email);
            if (!user) {
                throw new Error('user not found');
            }
            const OTP = generateOTP();
            sendOTPByEmail(email, OTP);
            await User.updateOne(
                { email },
                {
                    $set: {
                        otp: hashOTP(OTP),
                        otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
                    }
                }
            );
            return true;
        } catch (error) {
            console.log('Error in sendForgotPasswordOTP:', error);
            throw error;
        }
    }

    async resetPassword(email, otp, newPassword) {
        try {
            const user = await this.findByEmail(email);

            if (!user.otp || !user.otpExpiry || user.otpExpiry < Date.now()) {
                throw new Error("OTP expired");
            }

            if (!verifyHashedOTP(otp, user.otp)) {
                throw new Error("Invalid OTP");
            }
            const isPasswordMatch = await user.comparePassword(newPassword);
            if (isPasswordMatch) {
                throw new Error('PasswordMatchError');
            }
           
            user.password = newPassword;
            user.otp = null;
            user.otpExpiry = null;
            await user.save();

            return true;
        } catch (error) {
            console.log('Error in resetPassword:', error);
            throw error;
        }
    }

}

module.exports = UserService;