function checkAuthStatus(req, res, next) {
    const uid = req.session.user;

    if(!user) {
        return next();
    }


    res.locals.user = user;
    res.locals.isAuth = true;
    res.locals.isAdmin = req.session.isAdmin;
    next();
}


module.exports = checkAuthStatus;
