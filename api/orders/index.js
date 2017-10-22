(function (){
  'use strict';

  var async     = require("async")
    , express   = require("express")
    , request   = require("../../helpers/zipkin-request")
    , endpoints = require("../endpoints")
    , helpers   = require("../../helpers")
    , app       = express()

  app.get("/orders", function (req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;
    async.waterfall([
        function (callback) {
          request(endpoints.ordersUrl + "/orders/search/customerId?sort=date&custId=" + custId)
            .then(response => {
              if (response.status == 404) {
                console.log("No orders found for user: " + custId);
                callback(null, []);
                return null;
              } else {
                return response.json();
              }
            }).then(body => {
              if (body)
                callback(null, body._embedded.customerOrders)
            })
            .catch(error => callback(error));
        }
    ],
    function (err, result) {
      if (err) {
        return next(err);
      }
      helpers.respondStatusBody(res, 201, JSON.stringify(result));
    });
  });

  app.get("/orders/*", function (req, res, next) {
    var url = endpoints.ordersUrl + req.url.toString();
    request(url)
      .then(response => response.json())
      .then(body => helpers.respondSuccessBody(res, JSON.stringify(body)))
      .catch(error => next(error));
  });

  app.post("/orders", function(req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;

    async.waterfall([
        function (callback) {
          request(endpoints.customersUrl + "/" + custId)
            .then(response => response.json())
            .then(body => {
              console.log("Received response: " + JSON.stringify(body));
              var customerlink = body._links.customer.href;
              var addressLink = body._links.addresses.href;
              var cardLink = body._links.cards.href;
              var order = {
                "customer": customerlink,
                "address": null,
                "card": null,
                "items": endpoints.cartsUrl + "/" + custId + "/items"
              };
              callback(null, order, addressLink, cardLink);
            })
            .catch(error => callback(error));
        },
        function (order, addressLink, cardLink, callback) {
          async.parallel([
              function (callback) {
                console.log("GET Request to: " + addressLink);
                request(addressLink)
                  .then(response => response.json())
                  .then(body => {
                    console.log("Received response: " + JSON.stringify(body));
                    if (body._embedded.address[0] != null) {
                      order.address = body._embedded.address[0]._links.self.href;
                    }
                    callback();
                  })
                  .catch(error => callback(error));
              },
              function (callback) {
                console.log("GET Request to: " + cardLink);
                request(cardLink)
                  .then(response => response.json())
                  .then(body => {
                    console.log("Received response: " + JSON.stringify(body));
                    if (body._embedded.card[0] != null) {
                      order.card = body._embedded.card[0]._links.self.href;
                    }
                    callback();
                  })
                  .catch(error => callback(error));
              }
          ], function (err, result) {
            if (err) {
              callback(err);
              return;
            }
            console.log(result);
            callback(null, order);
          });
        },
        function (order, callback) {
          var options = {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(order)
          };
          console.log("Posting Order: " + JSON.stringify(order));
          var statusCode = 0;
          request(endpoints.ordersUrl + '/orders', options)
            .then(response => {
              statusCode = response.status;
              if (response.status === 400) {
                throw Error('Invalid order. Try again');
              } else {
                return response.json();
              }
            })
            .then(body => {
              console.log("Order response: " + JSON.stringify(body));
              callback(null, statusCode, body);
            })
            .catch(error => callback(error));
        }
    ],
    function (err, status, result) {
      if (err) {
        console.log(err);
        return next(err);
      }
      helpers.respondStatusBody(res, status, JSON.stringify(result));
    });
  });

  module.exports = app;
}());
