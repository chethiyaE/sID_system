var facebook = require('../../config/facebook.js');

var chalk = require('chalk');

var mongoose = require('mongoose');

var rest = require('restler');

var User = require('../models/user');
var Facebook = require('../models/facebook');
var Entry = require("../models/entry");
var LinkedIn = require("../models/linkedin");

module.exports = function (app, passport) {

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function (req, res) {

        //req.user.userDetails.local.email

        if(req.user){
            res.redirect('/home');
        }else{
            res.render('index.ejs', { user: req.user});
        }

    });

    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function (req, res) {
        //User.findById(req.user._id)
        //    //.populate('userDetails.facebook')
        //    //.populate('facebook.ratedByMe')
        //    .exec(function (error, user) {
        //        console.log(JSON.stringify(user, null, "\t"));
        //    });

        User.findById(req.user._id)
            .populate('userDetails.facebook')
            .populate('userDetails.linkedin')
            //.populate('facebook.ratedByMe')
            .exec(function (error, user) {
                console.log(JSON.stringify(user, null, "\t"));
                res.render('profile.ejs', {
                    user: user
                });

                //res.render('partials/profile', {user: user});
            });


    });

    // LOGOUT ==============================
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
    // LOGIN ===============================
    // show the login form
    app.get('/login', function (req, res) {
        res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/home', // redirect to the secure profile section
        failureRedirect: '/login', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // SIGNUP =================================
    // show the signup form
    app.get('/signup', function (req, res) {
        res.render('signup.ejs', {message: req.flash('signupMessage')});
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/home', // redirect to the secure profile section
        failureRedirect: '/signup', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // facebook -------------------------------

    // send to facebook to do the authentication
    app.get('/auth/facebook', passport.authenticate('facebook', {scope: 'email, user_friends'}));

    // handle the callback after facebook has authenticated the user
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
            successRedirect: '/home',
            failureRedirect: '/'
        }));

    app.get('/auth/linkedin', passport.authenticate('linkedin'));

    app.get('/auth/linkedin/callback',
        passport.authenticate('linkedin', {
            successRedirect: '/home',
            failureRedirect: '/'
        })
        //,
        //function (req, res) {
        //    // Successful authentication, redirect home.
        //    res.redirect('/success');
        //}
    );

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    // locally --------------------------------
    app.get('/connect/local', function (req, res) {
        res.render('connect-local.ejs', {message: req.flash('loginMessage')});
    });
    app.post('/connect/local', passport.authenticate('local-signup', {
        successRedirect: '/profile', // redirect to the secure profile section
        failureRedirect: '/connect/local', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // facebook -------------------------------

    // send to facebook to do the authentication
    app.get('/connect/facebook', passport.authenticate('facebook-authz', {failureRedirect: '/failed'}));

    // handle the callback after facebook has authorized the user
    app.get('/connect/facebook/callback',


        //passport.authorize('facebook-authz', {
        //    successRedirect: '/okk',
        //    failureRedirect: '/failed'
        //}),
        //function (req, res) {
        //    var user = req.user;
        //
        //    console.log(chalk.blue("facebook-authz: " + JSON.stringify(user, null, "\t")));
        //
        //    if (user) {
        //        return ;
        //    }
        //}

        passport.authenticate('facebook-authz', {
            successRedirect: '/profile',
            failureRedirect: '/failure'
        })
    );

    app.get('/connect/linkedin', passport.authenticate('linkedin-authz', {
        res: ['r_basicprofile', 'r_fullprofile', 'r_emailaddress']
    }));

    // the callback after google has authorized the user
    app.get('/connect/linkedin/callback',
        passport.authenticate('linkedin-authz', {
            successRedirect: '/profile',
            failureRedirect: '/failure'
        }));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function (req, res) {
        var user = req.user;
        user.userDetails.local.email = undefined;
        user.userDetails.local.password = undefined;
        user.save(function (err) {
            res.redirect('/profile');
        });
    });

    // facebook -------------------------------
    app.get('/unlink/facebook', isLoggedIn, function (req, res) {

        Facebook.findOne({
            _id: req.user.userDetails.facebook
        }, function (err, facebook) {
            facebook.token = undefined;
            facebook.save(function (err) {
                res.redirect('/profile');
            });


        });
    });

    app.get('/unlink/linkedin', isLoggedIn, function (req, res) {
        LinkedIn.findOne({
            _id: req.user.userDetails.linkedin
        }, function (err, linkedin) {
            linkedin.token = undefined;
            linkedin.save(function (err) {
                res.redirect('/profile');
            });


        });
    });
    // FRIENDS SECTION =========================
    app.get('/facebook/friends', isLoggedIn, function (req, res) {

        facebook.getFbData(req, '/me/friends', function (data) {
             console.log(data);
             console.log("-------------------------------------");
             var jsonPretty = JSON.stringify(JSON.parse(data),null,2);
             console.log(jsonPretty);

            obj = JSON.parse(data);

            console.log("obj.data: " + obj);
            console.log(JSON.stringify("obj.data: " +JSON.parse(data),null,2));

            res.render('friends.ejs', {
                friends: obj.data,
                user: req.user
            });

        });

        // res.redirect('/profile');

    });

    app.get('/home', isLoggedIn,  function (req, res) {
        res.render('home.ejs', { user: req.user});
    });

    app.get('/usersummary', function(req, res){
      rest.post('http://localhost:8080/claimRating', {
        data: { sender: 'Pubudu', target: 'Dodangoda', cClass: 'cClassTest', claimId: 334 },
        }).on('complete', function(data, response) {
        //if (response.statusCode == 201) { // you can get at the raw response like this...
          var summary = [];
          //summary.push({'positive': data.positive, 'negative': data.negative, 'uncertain': data.uncertain});
          summary.push({
              "label": 'positive',
              "value" : data.positive,
              "color" : "#33CC33"
            },
            {
              "label": 'negative',
              "value" : data.negative,
              "color" : "#FF0000"
            },
            {
              "label": 'uncertain',
              "value" : data.uncertain,
              "color" : "#FF9900"
            }
          );
          //console.log(summary);
          res.render('usersummary.ejs', { user: req.user, summary: summary});
        //}
      });
    });
};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {

    console.log("isAuthenticated: " + req.isAuthenticated());

    console.log(chalk.green("User: " + req.user));

    //console.log("Token: " + req.user.token);

    if (req.isAuthenticated())
        return next();

    res.redirect('/');
}
