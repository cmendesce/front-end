(function() {
    'use strict';

    var async = require("async"), express = require("express"), endpoints = require("../endpoints"), helpers = require("../../helpers"), app = express(), cookie_name = "logged_in"
    var request = require("../../helpers/zipkin-request")

    app.get("/customers/:id", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.customersUrl + "/" + req.session.customerId, res, next);
    });
    app.get("/cards/:id", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.cardsUrl + "/" + req.params.id, res, next);
    });

    app.get("/customers", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.customersUrl, res, next);
    });
    app.get("/addresses", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.addressUrl, res, next);
    });
    app.get("/cards", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.cardsUrl, res, next);
    });

    // Create Customer - TO BE USED FOR TESTING ONLY (for now)
    app.post("/customers", function(req, res, next) {
        var options = {
            method: 'POST', 
            body: JSON.stringify(req.body)
        };
        console.log("Posting Customer: " + JSON.stringify(req.body));

        request(endpoints.customersUrl, options)
            .then(() => helpers.respondSuccessBody(res, JSON.stringify(req.body)))
            .catch(err => next(err));
    });

    app.post("/addresses", function(req, res, next) {
        req.body.userID = helpers.getCustomerId(req, app.get("env"));
        var options = {
            method: 'POST',
            body: JSON.stringify(req.body)
        };
        console.log("Posting Address: " + JSON.stringify(req.body));
        request(endpoints.addressUrl, options)
            .then(response => response.json())
            .then(body => helpers.respondSuccessBody(res, JSON.stringify(body)))
            .catch(error => next(error));
    });

    app.get("/card", function(req, res, next) {
        var custId = helpers.getCustomerId(req, app.get("env"));
        request(endpoints.customersUrl + '/' + custId + '/cards')
            .then(response => response.json())
            .then(data => {
                if (data.status_code !== 500 && data._embedded.card.length !== 0 ) {
                    var resp = {
                        "number": data._embedded.card[0].longNum.slice(-4)
                    };
                    return helpers.respondSuccessBody(res, JSON.stringify(resp));
                }
                return helpers.respondSuccessBody(res, JSON.stringify({"status_code": 500}));
            })
            .catch(error => {
                console.log(error)
                next(error)
            });
    });

    app.get("/address", function(req, res, next) {
        var custId = helpers.getCustomerId(req, app.get("env"));
        request(endpoints.customersUrl + '/' + custId + '/addresses')
            .then(response => response.json())
            .then(body => {
                if (body.status_code !== 500 && body._embedded.address.length !== 0 ) {
                    var resp = body._embedded.address[0];
                    return helpers.respondSuccessBody(res, JSON.stringify(resp));
                }
                return helpers.respondSuccessBody(res, JSON.stringify({"status_code": 500}));
            })
            .catch(error => next(error));
    });

    app.post("/cards", function(req, res, next) {
        req.body.userID = helpers.getCustomerId(req, app.get("env"));
        var options = {
            method: 'POST',
            body: JSON.stringify(req.body)
        };
        console.log("Posting Card: " + JSON.stringify(req.body));
        request(endpoints.cardsUrl, options)
            .then(response => response.json())
            .then(body => helpers.respondSuccessBody(res, JSON.stringify(body)))
            .catch(error => next(error));
    });

    // Delete Customer - TO BE USED FOR TESTING ONLY (for now)
    app.delete("/customers/:id", function(req, res, next) {
        console.log("Deleting Customer " + req.params.id);
        var options = {
            method: 'DELETE'
        };
        request(endpoints.customersUrl + "/" + req.params.id, options)
            .then(response => response.json())
            .then(body => helpers.respondSuccessBody(res, JSON.stringify(body)))
            .catch(error => next(error));
    });

    // Delete Address - TO BE USED FOR TESTING ONLY (for now)
    app.delete("/addresses/:id", function(req, res, next) {
        console.log("Deleting Address " + req.params.id);
        var options = {
            method: 'DELETE'
        };
        request(endpoints.addressUrl + "/" + req.params.id, options)
            .then(response => response.json())
            .then(body => helpers.respondSuccessBody(res, JSON.stringify(body)))
            .catch(error => next(error));
    });

    // Delete Card - TO BE USED FOR TESTING ONLY (for now)
    app.delete("/cards/:id", function(req, res, next) {
        console.log("Deleting Card " + req.params.id);
        var options = {
            method: 'DELETE'
        };
        request(endpoints.cardsUrl + "/" + req.params.id, options)
            .then(response => response.json())
            .then(body => helpers.respondSuccessBody(res, JSON.stringify(body)))
            .catch(error => next(error));
    });

    app.post("/register", function(req, res, next) {
        console.log("Posting Customer: " + JSON.stringify(req.body));
        async.waterfall([
                function(callback) {
                    request(endpoints.registerUrl, {
                        method: 'POST',
                        body: JSON.stringify(req.body)
                    }).then(response => {
                        return response.json();
                    }).then(body => {
                        var customerId = body.id;
                        console.log('customerId=', customerId);
                        req.session.customerId = customerId;
                        callback(null, customerId);
                    }).catch(err => callback(err));
                },
                function(custId, callback) {
                    var sessionId = req.session.id;
                    console.log("Merging carts for customer id: " + custId + " and session id: " + sessionId);

                    var uri = endpoints.cartsUrl + "/" + custId + "/merge" + "?sessionId=" + sessionId;
                    request(uri).then(() => {
                        console.log('Carts merged.');
                        if (callback) {
                            callback(null, custId);
                        } 
                    }).catch(error => callback(error));
                }
            ],
            function(err, custId) {
                if (err) {
                    console.log("Error with log in: " + err);
                    res.status(500);
                    res.end();
                    return;
                }
                console.log("set cookie" + custId);
                res.status(200);
                res.cookie(cookie_name, req.session.id, {
                    maxAge: 3600000
                }).send({id: custId});
                console.log("Sent cookies.");
                res.end();
                return;
            }
        );
    });

    app.get("/login", function(req, res, next) {
        console.log("Received login request");

        async.waterfall([
                function(callback) {
                    var headers = {
                        'Authorization': req.get('Authorization')
                    };
                    request(endpoints.loginUrl, {headers}).then(response => response.json()).then(body => {
                        console.log(body);
                        var customerId = body.user.id;
                        console.log(customerId);
                        req.session.customerId = customerId;
                        callback(null, customerId);
                    }).catch(err => {
                        console.err(err)
                        callback(err)
                    })
                },
                function(custId, callback) {
                    var sessionId = req.session.id;
                    console.log("Merging carts for customer id: " + custId + " and session id: " + sessionId);
                    var url = endpoints.cartsUrl + "/" + custId + "/merge" + "?sessionId=" + sessionId;

                    request(url).then(() => {
                        console.log('Carts merged.');
                        callback(null, custId);
                    }).catch(err => {
                        callback(err)
                        console.log(err);
                    })
                }
            ],
            function(err, custId) {
                if (err) {
                    console.log("Error with log in: " + err);
                    res.status(401);
                    res.end();
                    return;
                }
                res.status(200);
                res.cookie(cookie_name, req.session.id, {
                    maxAge: 3600000
                }).send('Cookie is set');
                console.log("Sent cookies.");
                res.end();
                return;
            });
    });

    module.exports = app;
}());
