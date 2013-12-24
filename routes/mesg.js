
/*
 * GET message listing => show()
 * POST meaasge posting => send()
 */

var settings = require('../settings');
var group = require('../models/group');
var mesg = require('../models/mesg');
var querystring = require("querystring");
var iolib = require("../socket/io");

exports.welcome = function(req, res) {
    var name = req.params.name;
    var secret = req.params.secret;
    var info = {title: name, name: name, secret: secret};
    var fallback = function(err) {
        req.flash('error', err);
        return res.redirect('/');
    }
    group.checkSecret(name, secret, function(err) {
        if (err) return fallback(err);
        return res.render('mesgwelcome', info);
    });
};

exports.redirect = function(req, res) {
    var name = req.params.name;
    var secret = req.params.secret;
    var user = req.body.user;
    var escapeU = querystring.escape(user);
    if (user == '') {
        req.flash('error', 'Name needed');
        return res.redirect('back');
    } else {
        req.flash('success', 'Save this page to bookmarks for further writing.');
        if (secret)
            return res.redirect('/w/' + name + '/' + secret + '/' + escapeU);
        else
            return res.redirect('/p/' + name + '/' + escapeU);
    }
};

exports.show = function(req, res) {
    var name = req.params.name;
    var secret = req.params.secret;
    var user = req.params.user;
    var escapeU = querystring.escape(user);
    var info = {title: name, name: name, secret: secret, urlu: escapeU, user: user};
    var page = info.page = Number(req.params.page || '1');
    var fallback = function(err) {
        console.log(err);
        req.flash('error', err);
        return res.redirect('/');
    }
    group.checkSecret(name, secret, function(err) {
        if (err) return fallback(err);
        mesg.find({group: name}).count(function(err, count) {
            if (err) return fallback('Database error');
            info.totpage = Math.ceil(count / settings.perpage);
            var skip = settings.perpage * (page - 1);
            mesg.find({group: name}).sort('-create').skip(skip).limit(settings.perpage)
                .exec(function(err, mesglist) {
                    if (err) fallback(err);
                    info.mesglist = mesg.getNormalizedInfo(mesglist);
                    return res.render('mesglist', info);
                });
        });
    });
};

var saveMessage = function (req, res, cb) {
    var name = req.params.name;
    var secret = req.params.secret;
    var user = req.params.user;
    var escapeU = querystring.escape(user);
    var info = {title: name, name: name, secret: secret, urlu: escapeU, user: user};
    group.checkSecret(name, secret, function(err) {
        if (err) return cb(err);
        if (!req.body.content) return cb("No content");
        mesg.findOne().sort('-id').exec(function(err, last) {
            var item = new mesg(req.body);
            item.id = last ? last.id + 1 : 0;
            item.author = user; item.group = name;
            item.save(function(err) {
                if (err) return cb('Database error');
                iolib.io.sockets.in(name).emit('message',
                    { text: item.content, perpage: settings.perpage,
                      mesg: mesg.getNormalizedInfo([item])[0] });
                return cb();
            });
        });
    });
};

exports.send = function(req, res) {
    var fallback = function(err) {
        console.log(err);
        req.flash('error', err);
        return res.redirect('back');
    };
    saveMessage(req, res, function(err) {
        if (err) return fallback(err);
        else return res.redirect('back');
    });
};

exports.sendmesg = function(req, res) {
    var fallback = function(err) {
        console.log(err);
        return res.send({err: err});
    };
    saveMessage(req, res, function(err) {
        if (err) return fallback(err);
        else return res.send({err: null});
    });
};

exports.getmesg = function(req, res) {
    var name = req.params.name;
    var secret = req.params.secret;
    if (!req.query.last) req.query.last = 0;
    group.checkSecret(name, secret, function(err) {
        if (err) return res.send({err: err, data: []});
        mesg.find({group: name, id: {$gt: req.query.last}})
            .sort('create').exec(function(err, mesgs) {
                if (err) return res.send({err: err, data: []});
                else {
                    var mesglist = mesg.getRawInfo(mesgs);
                    return res.send({err: null, data: mesglist});
                }
            });
    });
};
