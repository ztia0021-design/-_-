

export function requireRole(...allowedRoles) {

    function checkRole(req, res, next) {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({error: "You do not have permission to perform this action"});
        }
        next();
    }
    return checkRole;
}