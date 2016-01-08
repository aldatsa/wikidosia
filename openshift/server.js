#!/bin/env node
//  OpenShift sample Node application
var express   = require('express');
var fs        = require('fs');
var Wikidosia = require('../lib/wikidosia');
var Wikipedia = require('../lib/wikipedia');
var wikipedia = new Wikipedia();

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
        self.ipaddress   = process.env.OPENSHIFT_NODEJS_IP;
        self.port        = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        // OpenShift-en bagaude bertako bidea erabili, lokalean bagaude berriz config.json-en bide erlatiboa.
        self.config_path = process.env.OPENSHIFT_DATA_DIR || "./openshift/";

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        }
    };

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

        self.routes["/irakurrienak"] = function(req, res) {

            var data = req.query.data;
            var bereziak_barne = req.query.bereziak_barne;
            var sarbidea = req.query.sarbidea;
            var checked = "";

            // Erabiltzaileak data bat pasa badu URLean...
            // Ordu-zonekin arazoak nituen. Konponbide bezala UTC (Coordinated Universal Time) erabiltzen hasi naiz.
            // http://stackoverflow.com/questions/7556591/javascript-date-object-always-one-day-off
            if (data) {
                data = new Date(data);
            } else {
                // Atzoko data eskuratu.
                data = new Date();
                data.setDate(data.getUTCDate() - 1);
            }

            // Erabiltzaileak artikulu bereziak ere ikusi nahi baditu...
            // Erabiltzaileak edozein gauza pasa dezakeela kontutan izan behar dugu. Pasatakoa true/false bihurtuko dugu.
            if (bereziak_barne === "true") {
                bereziak_barne = true;
                checked = " checked";
            } else {
                bereziak_barne = false;
            }

            var urtea = data.getUTCFullYear();
            var hilabetea = data.getUTCMonth() + 1; // Hilabeteak 0-11 bezala itzultzen ditu.
            var eguna = data.getUTCDate();

            if (hilabetea < 10) {
                hilabetea = "0" + hilabetea;
            }

            if (eguna < 10) {
                eguna = "0" + eguna;
            }

            // sarbidea ez bada zehaztu edo mota ezezagun bat eskatu bada...
            if (sarbidea !== "all-access" && sarbidea !== "desktop" && sarbidea !== "mobile-app" && sarbidea !== "mobile-web") {

                // Aukera lehenetsia ezarri.
                sarbidea = "all-access";

            }

            wikipedia.getMostViewedArticles("eu", urtea, hilabetea, eguna, sarbidea, 100, bereziak_barne).then(function(emaitza) {

                //res.setHeader('Content-Type', 'text/html');
                res.render("pages/irakurrienak", {
                    bista: "irakurrienak",
                    title: "Wikidosia - Irakurrienak " + urtea + "-"  + hilabetea + "-" + eguna,
                    urtea: urtea,
                    hilabetea: hilabetea,
                    eguna: eguna,
                    artikuluak: emaitza,
                    checked: checked,
                    sarbidea: sarbidea,
                    errorea: false
                });

            }, function(errorea) {

                res.render("pages/irakurrienak", {
                    bista: "irakurrienak",
                    title: "Wikidosia - Irakurrienak " + urtea + "-"  + hilabetea + "-" + eguna,
                    urtea: urtea,
                    hilabetea: hilabetea,
                    eguna: eguna,
                    artikuluak: [],
                    checked: checked,
                    sarbidea: sarbidea,
                    errorea: true
                });

            });
        };

        self.routes["/joerak"] = function(req, res) {

            var artikulua = "Euskara";
            var datuak = [];

            wikipedia.getDailyPageViews("eu", artikulua, "2015", "12", "01", "2016", "01", "05", "all-access", "all-agents").then(function(emaitza) {

                datuak[0] = ["data"];
                datuak[1] = [artikulua];

                emaitza.forEach(function(datua) {
                    datuak[0].push(datua.timestamp);
                    datuak[1].push(datua.views);
                });
                console.log(datuak);
                res.render("pages/joerak", {
                    bista: "joerak",
                    title: "Wikidosia",
                    datuak: datuak
                });

            });

        };

        self.routes["/"] = function(req, res) {

            res.render("pages/index", {
                bista: "hasiera",
                title: "Wikidosia"
            });

        };

    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express.createServer();
        self.app.use(express.static(__dirname + '/public'));
        self.app.set('views', __dirname + '/views');
        self.app.set('view engine', 'ejs');

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
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {

        var config = JSON.parse(fs.readFileSync(self.config_path + 'config.json'));

        var wikidosia = new Wikidosia(config);

        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
