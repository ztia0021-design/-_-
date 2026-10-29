import jwt from "jsonwebtoken";
import User from "./models/User.js";

export async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: "Authorization header is required"
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Invalid authorization format"
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                error: "Token is required"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                error: "User no longer exists"
            });
        }

        if (user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({
                error: "Token is no longer valid"
            });
        }

        req.user = {
            userId: user._id,
            role: user.role,
            fullName: user.fullName
        };

        next();

    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                error: "Token has expired"
            });
        }

        return res.status(401).json({
            error: "Invalid token"
        });
    }
}