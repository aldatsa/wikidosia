#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
var request = require("request");
var Twit = require('twit');
var schedule = require('node-schedule');

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express.createServer();

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {

        self.config = JSON.parse(fs.readFileSync('./config.json'));

        // EDT ordua (-6 ordu)
        var j = schedule.scheduleJob('12 8,18 * * *', function() {
            self.txiokatuWikidosia();
        });

        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
            console.log("Kaixo");
        });
    };

    self.txiokatuWikidosia = function() {

        var T = new Twit({
            consumer_key:         self.config.twitter_app.consumer_key,
            consumer_secret:      self.config.twitter_app.consumer_secret,
            access_token:         self.config.twitter_app.access_token,
            access_token_secret:  self.config.twitter_app.access_token_secret
        });

        var emaitza = {
            pageid: undefined,
            title: "",
            extract: ""
        };

        var mezua = "";

        request({
            url: "http://eu.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts&explaintext&exintro=&format=json",
            json: true
        }, function (error, response, body) {

            if (!error && response.statusCode === 200) {

                for (var orria in body.query.pages) {

                    emaitza.pageid = body.query.pages[orria].pageid;
                    emaitza.title = body.query.pages[orria].title;
                    emaitza.extract = body.query.pages[orria].extract;

                    request({
                        url: "http://eu.wikipedia.org/w/api.php?action=query&prop=info&pageids=" + emaitza.pageid + "&inprop=url&format=json",
                        json: true
                    }, function(error, response, body) {

                        if (!error && response.statusCode === 200) {

                            for (var orria in body.query.pages) {

                                emaitza.fullurl = body.query.pages[orria].fullurl;

                            }

                            mezua = emaitza.title + " - " + emaitza.extract;

                            mezua = mezua.substring(0, 140 - 27);

                            mezua = mezua + "... " + emaitza.fullurl;

                            T.post('statuses/update', { status: mezua }, function(err, data, response) {
                                if(err) {
                                    console.log("There was a problem tweeting the message.", err);
                                }
                            });

                        }

                    });
                }
            }

        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
