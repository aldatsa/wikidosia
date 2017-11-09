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
 * Artikulu baten infotaulako irudi nagusia itzultzen du tamaina desberdinetan.
 */
EuskalWikipedia.prototype.eskuratuArtikuluarenIrudia = function(url) {

    var irudiak = {};

    var promise = new Promise(function(resolve, reject) {

        request({
            url: url
        }, function(error, response, body) {

            if (!error && response.statusCode == 200) {

                var $ = cheerio.load(body);
                var srcset = $("#mw-content-text table a.image img").attr("srcset");

                // Irudiak baditu...
                if (srcset) {

                    srcset = srcset.split(" ");

                    irudiak.x1 = "https:" + $("#mw-content-text table a.image img").attr("src");
                    irudiak.x1_5 = "https:" + srcset[0];
                    irudiak.x2 = "https:" + srcset[2];

                }

                resolve(irudiak);

            } else {

                console.log("Errore bat gertatu da artikuluaren irudiak eskuratzean.");
                console.log(error);

                reject(error);

            }
        });
    });

    return promise;
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
                var azpi_kategoria = "";
                var azpi_azpi_kategoria = "";
                var aurrekoa;

                estekak = $("#mw-content-text > p a");

                for (var i = 0; i < estekak.length; i++) {

                    kategoria = "";
                    azpi_kategoria = "";
                    azpi_azpi_kategoria = "";

                    aurrekoa = estekak[i].parent.prev.prev;

                    // Bere kategoria eskuratu. Ez da oso dotorea baina badabil.
                    if (aurrekoa.name === "h2") {

                        kategoria = aurrekoa.children[0].children[0].data;

                    } else if (aurrekoa.name === "h3") {

                        azpi_kategoria = aurrekoa.children[0].children[0].data;

                        while (aurrekoa.name !== "h2") {

                            aurrekoa = aurrekoa.prev;

                        }

                        kategoria = aurrekoa.children[0].children[0].data;

                    } else if (aurrekoa.name === "h5") {

                        azpi_azpi_kategoria = aurrekoa.children[0].children[0].data;

                        while (aurrekoa.name !== "h3") {

                            aurrekoa = aurrekoa.prev;

                        }

                        azpi_kategoria = aurrekoa.children[0].children[0].data;

                        while (aurrekoa.name !== "h2") {

                            aurrekoa = aurrekoa.prev;

                        }

                        kategoria = aurrekoa.children[0].children[0].data;

                    }

                    nabarmenduak.push({
                        "izena": estekak[i].attribs.title,
                        "esteka": "https://eu.wikipedia.org" + estekak[i].attribs.href,
                        "kategoria": kategoria,
                        "azpi-kategoria": azpi_kategoria,
                        "azpi-azpi-kategoria": azpi_azpi_kategoria
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

/*
 * Euskarazko Wikipediako asteko argazkiaren datuak itzultzen ditu. APIrik ez dudanez aurkitu webgunetik erauziko ditut.
 */
EuskalWikipedia.prototype.eskuratuAstekoIrudia = function() {

    var url = "https://eu.wikipedia.org/wiki/Txantiloi:Asteko_argazkia";

    var promise = new Promise(function(resolve, reject) {

        request({
            url: url
        }, function (error, response, body) {

            if (!error && response.statusCode == 200) {

                var asteko_argazkia = {};

                var $ = cheerio.load(body);

                // Asteko irudiaren datuak.
                asteko_argazkia.irudiak = {};

                var srcset = $("#mw-content-text a.image img").attr("srcset");
                srcset = srcset.split(" ");

                asteko_argazkia.irudiak.x1 = "https://eu.wikipedia.org" + $("#mw-content-text a.image").attr("href");
                asteko_argazkia.irudiak.x1_5 = "https:" + srcset[0];
                asteko_argazkia.irudiak.x2 = "https:" + srcset[2];

                // Asteko irudiaren testua.
                asteko_argazkia.testua = "";

                asteko_argazkia.testua = $("#mw-content-text .mw-parser-output > div").contents().map(function() {
                    return $(this).text();
                }).get().join('').replace(/\n/g, "");

                resolve(asteko_argazkia);

            } else {

                console.log("Errore bat gertatu da asteko herriaren datuak eskuratzean.");
                console.log(error);

                reject(error);

            }
        });
    });

    return promise;
};

module.exports = EuskalWikipedia;
