/*
 * Use the function form of "use strict" (W097) errore-mezua ematen zidan jshint-ek.
 * "use strict"ek berehalako funtzio baten barruan joan behar luke,
 * bere eragina konkatenatutako funtzioetara ez zabaltzeko.
 * Baina horrek node-ko moduluetan ez du zentzurik, ikusi:
 * http://stackoverflow.com/questions/4462478/jslint-is-suddenly-reporting-use-the-function-form-of-use-strict
 * Arazoa konpontzeko hau gehitu behar da:
*/
/* jshint node: true */
"use strict";

var fs = require('fs');
var EuskalWikipedia = require("../lib/euskalwikipedia");

var euskalwikipedia = new EuskalWikipedia();

var fitxategia = "openshift/nabarmenduak.json";

euskalwikipedia.eskuratuNabarmenduenZerrenda().then(function(emaitza) {

    fs.writeFile(fitxategia, JSON.stringify(emaitza, null, 4), function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log("JSON fitxategia behar bezala gorde da: " + fitxategia);
        }
    });

});
