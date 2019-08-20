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
 * Artikulu onak bakarrik itzultzen dituen APIrik ez dudanez aurkitu webgunetik erauziko ditut.
 */
EuskalWikipedia.prototype.eskuratuArtikuluOnenZerrenda = function() {

    var url = "https://eu.wikipedia.org/wiki/Wikipedia:Artikulu_onak";

    var promise = new Promise(function(resolve, reject) {

        request({
            url: url
        }, function (error, response, body) {

            if (!error && response.statusCode == 200) {

                var $ = cheerio.load(body);

                var artikulu_onak = [];
                var estekak;
                var kategoria = "";
                var azpi_kategoria = "";
                var azpi_azpi_kategoria = "";
                var aurrekoa;

                estekak = $(".mw-parser-output > table:nth-child(4) > tbody > tr > td > p a");

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

                    artikulu_onak.push({
                        "izena": estekak[i].attribs.title,
                        "esteka": "https://eu.wikipedia.org" + estekak[i].attribs.href,
                        "kategoria": kategoria,
                        "azpi-kategoria": azpi_kategoria,
                        "azpi-azpi-kategoria": azpi_azpi_kategoria
                    });
                }
                console.log(artikulu_onak.length);
                //console.log(artikulu_onak);
                resolve(artikulu_onak);

            } else {

                console.log("Errore bat gertatu da artikulu onak eskuratzean.");
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

    /* https://stackoverflow.com/a/6117889/2855012
     *
     * For a given date, get the ISO week number
     *
     * Based on information at:
     *
     *    http://www.merlyn.demon.co.uk/weekcalc.htm#WNR
     *
     * Algorithm is to find nearest thursday, it's year
     * is the year of the week number. Then get weeks
     * between that date and the first day of that year.
     *
     * Note that dates in one year can be weeks of previous
     * or next year, overlap is up to 3 days.
     *
     * e.g. 2014/12/29 is Monday in week  1 of 2015
     *      2012/1/1   is Sunday in week 52 of 2011
     */
    function getWeekNumber(d) {
        // Copy date so don't modify original
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        // Set to nearest Thursday: current date + 4 - current day number
        // Make Sunday's day number 7
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        // Get first day of year
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        // Calculate full weeks to nearest Thursday
        var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
        // Return array of year and week number
        return [d.getUTCFullYear(), weekNo];
    }
    var gaur = new Date();

    var url = "https://eu.wikipedia.org/wiki/Txantiloi:Azala/AstekoArgazkia/" + gaur.getFullYear() + "-" + getWeekNumber(gaur)[1];

    var promise = new Promise(function(resolve, reject) {

        request({
            url: url
        }, function (error, response, body) {

            if (!error && response.statusCode == 200) {

                var asteko_argazkia = {};

                var $ = cheerio.load(body);

                // Asteko irudiaren datuak.
                asteko_argazkia.irudiak = {};

                asteko_argazkia.irudiak.fitxategi_orria = "https://eu.wikipedia.org" + $("#mw-content-text a.image").attr("href");
                asteko_argazkia.irudiak.x1 = "https:" + $("#mw-content-text a.image img").attr("src");

                var srcset = $("#mw-content-text a.image img").attr("srcset");

                if (srcset) {

                    srcset = srcset.split(" ");
                    asteko_argazkia.irudiak.x1_5 = "https:" + srcset[0];
                    asteko_argazkia.irudiak.x2 = "https:" + srcset[2];

                }

                // Asteko irudiaren testua.
                asteko_argazkia.testua = "";

                asteko_argazkia.testua = $("#mw-content-text .mw-parser-output > div.quote").contents().map(function() {
                    return $(this).text();
                }).get().join('').replace(/\n/g, "");

                resolve(asteko_argazkia);

            } else {

                console.log("Errore bat gertatu da asteko irudiaren datuak eskuratzean.");
                console.log(error);

                reject(error);

            }
        });
    });

    return promise;
};

module.exports = EuskalWikipedia;
