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

var request = require("request");
var Promise = require('promise');
var cheerio = require('cheerio');

var EuskalWikipedia = function() {
};

/*
 * Nabarmendutako artikuluak bakarrik itzultzen dituen APIrik ez dudanez aurkitu webgunetik erauziko ditut.
 */
EuskalWikipedia.prototype.eskuratuNabarmenduenZerrenda = function() {

    var url = "https://eu.wikipedia.org/wiki/Wikipedia:Artikulu_nabarmenduak";

    var promise = new Promise(function(resolve, reject) {

        request({
            url: url
        }, function (error, response, body) {

            if (!error && response.statusCode == 200) {

                var $ = cheerio.load(body);

                var nabarmenduak = [];
                var estekak;
                var kategoria = "";

                estekak = $("#mw-content-text > p a");

                for (var i = 0; i < estekak.length; i++) {

                    kategoria = "";

                    // Bere kategoria eskuratu. Ez da oso dotorea baina badabil.
                    if (estekak[i].parent.prev.prev.name === "h2") {

                        kategoria = estekak[i].parent.prev.prev.children[0].children[0].data;

                    }

                    nabarmenduak.push({
                        izena: estekak[i].attribs.title,
                        esteka: "https://eu.wikipedia.org" + estekak[i].attribs.href,
                        kategoria: kategoria
                    });
                }
                console.log(nabarmenduak.length);
                resolve(nabarmenduak);

            } else {

                console.log("Errore bat gertatu da nabarmenduak eskuratzean.");
                console.log(error);

                reject(error);

            }
        });
    });

    return promise;
};

module.exports = EuskalWikipedia;
