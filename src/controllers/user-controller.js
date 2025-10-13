const UserService = require('../services/user-service');
const { verifyHashedOTP } = require('../helpers/otp-helper');
const userService = new UserService();

const signUp = async (req, res) => {
    try {
        const user = await userService.create(req.body);
        await userService.sendOTP(req.body);
        return res.status(201).json({
            data: user,
            message: "created a new user and sent otp successfully",
            error: {},
            success: true
        });
    } catch (error) {
        console.log("unable to create a new user, error from user-controller: ", error);
        if (error.message === "user already exists") {
            return res.status(409).json({
                data: {},
                message: "user already exists",
                error: error.errmsg,
                success: false
            })
        }
        if (error.message === "user not found") {
            return res.status(404).json({
                data: {},
                message: "Cannot send otp, user with the given email does not exist.",
                error: error,
                success: false
            })
        }
        return res.status(500).json({
            data: {},
            message: "unable to create a new user and send otp",
            error: error,
            success: false
        })
    }
}

const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await userService.findByEmail(email);
        if (!user.otp || !user.otpExpiry || user.otpExpiry < Date.now()) {
            throw new Error("OTP expired");
        }
        if (!user || !verifyHashedOTP(otp, user.otp)) {
            return res.status(401).send({
                data: {},
                success: false,
                message: 'Invalid OTP',
                error: 'Invalid OTP'
            });
        }
        user.isVerified = true;
        user.otp = null;
        await user.save();
        return res.status(201).json({
            message: "otp verified",
            err: {},
            success: true,
            data: user
        });
    } catch (error) {
        console.log(error);
        if (error.message === "user not found") {
            return res.status(404).json({
                message: "User with the given email does not exist.",
                data: {},
                success: false,
                err: error
            })
        }
        return res.status(500).json({
            message: "otp verification failed",
            data: {},
            success: false,
            err: error
        });
    }
};


const signIn = async (req, res) => {
    try {
        const token = await userService.signIn(req.body);
        return res.status(200).json({
            message: 'Successfully signed in',
            success: true,
            data: {
                token: token,
            },
            err: {}
        });
    } catch (error) {
        if (error.message === "user not found") {
            return res.status(404).json({
                message: "User with the given email does not exist.",
                data: {},
                success: false,
                err: { message: error.message }
            });
        }
        if (error.message === "Incorrect Password") {
            return res.status(401).json({
                message: "Incorrect Password, please try again",
                data: {},
                success: false,
                err: { message: error.message }
            });
        }
        if (error.message === "Email not verified") {
            return res.status(401).json({
                message: "Email not verified, please verify your email",
                data: {},
                success: false,
                err: { message: error.message }
            });
        }
        return res.status(500).json({
            message: "Unable to sign in",
            data: {},
            success: false,
            err: { message: error.message }
        });
    }
}

const forgotPassword = async (req, res) => {
    try {
        await userService.sendForgotPasswordOTP(req.body.email);
        return res.status(200).json({
            message: "OTP sent to your email for password reset",
            success: true,
            data: {}
        });
    } catch (error) {
        if (error.message === "user not found") {
            return res.status(404).json({
                message: "User with the given email does not exist",
                success: false,
                data: {}
            });
        }
        return res.status(500).json({
            message: "Unable to process forgot password",
            success: false,
            err: error
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        await userService.resetPassword(email, otp, newPassword);
        return res.status(200).json({
            message: "Password reset successful",
            success: true,
            data: {}
        });
    } catch (error) {
        if (error.message === "user not found") {
            return res.status(404).json({
                message: "User with the given email does not exist",
                success: false,
                data: {}
            });
        }
        if (error.message === "Invalid OTP") {
            return res.status(401).json({
                message: "Invalid OTP",
                success: false,
                data: {}
            });
        }
        if (error.message === "OTP expired") {
            return res.status(401).json({
                message: "OTP expired",
                success: false,
                data: {}
            });
        }
        if (error.message === "PasswordMatchError") {
            return res.status(401).json({
                message: "New password cannot be same as old password",
                success: false,
                data: {}
            });
        }
        return res.status(500).json({
            message: "Unable to reset password",
            success: false,
            err: error
        });
    }
};


module.exports = {
    signUp,
    verifyOTP,
    signIn,
    forgotPassword,
    resetPassword
}