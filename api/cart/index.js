(function (){
  'use strict';

  var async     = require("async")
    , express   = require("express")
    , request  = require("../../helpers/zipkin-request")
    , helpers   = require("../../helpers")
    , endpoints = require("../endpoints")
    , app       = express()

  // List items in cart for current logged in user.
  app.get("/cart", function (req, res, next) {
    console.log("Request received: " + req.url + ", " + req.query.custId);
    var custId = helpers.getCustomerId(req, app.get("env"));
    console.log("Customer ID: " + custId);
    request(endpoints.cartsUrl + "/" + custId + "/items")
      .then(response => response.json())
      .then(body => helpers.respondSuccessBody(res, JSON.stringify(body)));
  });

  // Delete cart
  app.delete("/cart", function (req, res, next) {
    var custId = helpers.getCustomerId(req, app.get("env"));
    console.log('Attempting to delete cart for user: ' + custId);
    var options = {
      method: 'DELETE'
    };
    request(endpoints.cartsUrl + "/" + custId, options)
      .then(response => {
        console.log('User cart deleted with status: ' + response.statusCode);
        helpers.respondStatus(res, response.status);
      })
      .catch(error => next(error));
  });

  // Delete item from cart
  app.delete("/cart/:id", function (req, res, next) {
    if (req.params.id == null) {
      return next(new Error("Must pass id of item to delete"), 400);
    }

    console.log("Delete item from cart: " + req.url);

    var custId = helpers.getCustomerId(req, app.get("env"));

    var options = {
      method: 'DELETE'
    };
    request(endpoints.cartsUrl + "/" + custId + "/items/" + req.params.id.toString(), options)
      .then(response => {
        console.log('Item deleted with status: ' + response.statusCode);
        helpers.respondStatus(res, response.status);
      })
      .catch(error => next(error));
  });

  // Add new item to cart
  app.post("/cart", function (req, res, next) {
    console.log("Attempting to add to cart: " + JSON.stringify(req.body));

    if (req.body.id == null) {
      next(new Error("Must pass id of item to add"), 400);
      return;
    }

    var custId = helpers.getCustomerId(req, app.get("env"));

    async.waterfall([
        function (callback) {
          request(endpoints.catalogueUrl + "/catalogue/" + req.body.id.toString())
            .then(response => response.json())
            .then(body => {
              console.log(body);
              callback(null, body);
            })
            .catch(error => {
              console.log(error);
              callback(error, null);
            });
        },
        function (item, callback) {
          var options = {
            uri: endpoints.cartsUrl + "/" + custId + "/items",
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({itemId: item.id, unitPrice: item.price})
          };
          console.log("POST to carts: " + options.uri + " body: " + JSON.stringify(options.body));
          request(options.uri, options)
            .then(response => callback(null, response.status))
            .catch(error => callback(error));
        }
    ], function (err, statusCode) {
      if (err) {
        return next(err);
      }
      if (statusCode != 201) {
        return next(new Error("Unable to add to cart. Status code: " + statusCode));
      }
      helpers.respondStatus(res, statusCode);
    });
  });

// Update cart item
  app.post("/cart/update", function (req, res, next) {
    console.log("Attempting to update cart item: " + JSON.stringify(req.body));
    
    if (req.body.id == null) {
      next(new Error("Must pass id of item to update"), 400);
      return;
    }
    if (req.body.quantity == null) {
      next(new Error("Must pass quantity to update"), 400);
      return;
    }
    var custId = helpers.getCustomerId(req, app.get("env"));

    async.waterfall([
        function (callback) {
          request(endpoints.catalogueUrl + "/catalogue/" + req.body.id.toString())
            .then(response => response.json())
            .then(body => callback(null, body))
            .catch(error => callback(error, null));
        },
        function (item, callback) {
          var options = {
            uri: endpoints.cartsUrl + "/" + custId + "/items",
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({itemId: item.id, quantity: parseInt(req.body.quantity), unitPrice: item.price})
          };
          console.log("PATCH to carts: " + options.uri + " body: " + JSON.stringify(options.body));
          request(options.uri, options)
            .then(response => callback(null, response.status))
            .catch(error => callback(error));
        }
    ], function (err, statusCode) {
      if (err) {
        return next(err);
      }
      if (statusCode != 202) {
        return next(new Error("Unable to add to cart. Status code: " + statusCode))
      }
      helpers.respondStatus(res, statusCode);
    });
  });
  
  module.exports = app;
}());
