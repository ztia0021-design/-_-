import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { verifyToken } from "../midAuth.js";



const authRouter = express.Router();
authRouter.post("/register", async (req, res) => {
    const { fullName, email, password, role } = req.body;


    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ error: "Missing required fields"});
    }

    if (!["tutor", "learner"].includes(role)) {
        return res.status(400).json({ error: "Invalid role"});
    }
    
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return res.status(400).json({ error: "Password does not meet complexity requirements"});
    }

    const _email = email.trim().toLowerCase();
    if (await User.findOne({ email: _email })) {
        return res.status(409).json({ error: "Conflict"});
    }
    
   
   
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
        fullName,
        email: email,
        passwordHash,
        role
    });
    
    return res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdDate: user.createdDate
        });
    }

    

 
);

authRouter.post("/login", async (req, res) => {
    
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required"
        });
    }

   

    const user = await User.findOne({
        email: email
    });

    if (!user) {
        return res.status(401).json({
            error: "invalid email or password"
        });
    }

    const passwordIsCorrect = await bcrypt.compare(
        password,
        user.passwordHash
    );

    if (!passwordIsCorrect) {
        return res.status(401).json({
            error: "invalid email or password"
        });
    }

    const token = jwt.sign(
        {
            userId: user._id,
            role: user.role,
            tokenVersion: user.tokenVersion
        },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            expiresIn: "2h"
        }
    );

    return res.status(200).json({token});


});


authRouter.post("/logout", verifyToken, async (req, res) => {
    
    const user = await User.findById(req.user.userId);
    user.tokenVersion += 1;

    await user.save();

    return res.status(200).json({
        message: "Logged out successfully"
    });

});



authRouter.get("/me", verifyToken, async (req, res) => {
    

    const user = await User.findById(req.user.userId);

    const firstName = user.fullName.split(" ")[0];

    return res.status(200).json({
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdDate: user.createdDate,
        greeting: `Welcome back, ${firstName}!`
        });

});




export default authRouter;