function createUserSession (req, userId, action) {
    req.session.user = userId._id.toString();
    req.session.save(action);
}

function destroyUserAuthSession(req) {
    req.session.user = null;
}

module.exports = {
    createUserSession: createUserSession,
    destroyUserAuthSession: destroyUserAuthSession
}
