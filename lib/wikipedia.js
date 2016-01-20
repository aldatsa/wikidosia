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

var Wikipedia = function() {
    // Orri berezien identifikatzaileak. Adibidez, "Berezi:"
    this.bereziak = [
        "Azala",
        "Berezi:",
        "Template:",
        "Special:",
        "Wikipedia:",
        "Laguntza:",
        "Atari:",
        "Lankide:",
        "Kategoria:",
        "Atari_eztabaida:",
        "Lankide_eztabaida:",
        "Txantiloi:",
        "Fitxategi:",
        "Wikiproiektu:",
        "Aparteko:",
        "Eztabaida:",
        "-" // Berez ez da berezia baina arazoren bat dagoela uste dut, APIak itzultzen duena ez dator bat benetako bisitekin.
        // Gehiago daude. Ikusi ahala hemen gehitu.
    ];
};

Wikipedia.prototype.getRandomArticle = function(language_code) {

    var result = {
        pageid: undefined,
        title: "",
        extract: ""
    };

    var promise = new Promise(function(resolve, reject) {

        request({
            url: "http://" + language_code + ".wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts&explaintext&exintro=&format=json",
            json: true
        }, function (error, response, body) {

            if (!error && response.statusCode === 200) {

                for (var page in body.query.pages) {

                    result.pageid = body.query.pages[page].pageid;
                    result.title = body.query.pages[page].title;
                    result.extract = body.query.pages[page].extract;

                    request({
                        url: "http://" + language_code + ".wikipedia.org/w/api.php?action=query&prop=info&pageids=" + result.pageid + "&inprop=url&format=json",
                        json: true
                    }, function(error, response, body) {

                        if (!error && response.statusCode === 200) {

                            for (var page in body.query.pages) {

                                result.fullurl = body.query.pages[page].fullurl;

                            }

                            resolve(result);

                        } else {

                            reject(error);

                        }

                    });

                }

            } else {

                reject(error);

            }

        });

    });

    return promise;

};

Wikipedia.prototype.getDailyPageViews = function(language_code, article, start_year, start_month, start_day, end_year, end_month, end_day, access, agent) {

    var promise = new Promise(function(resolve, reject) {

        request({
            url: encodeURI("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/" + language_code + ".wikipedia/" + access + "/" + agent + "/" + article + "/daily/" + start_year + start_month + start_day + "/" + end_year + end_month + end_day),
            json: true
        }, function (error, response, body) {
            console.log(encodeURI("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/" + language_code + ".wikipedia/" + access + "/" + agent + "/" + article + "/daily/" + start_year + start_month + start_day + "/" + end_year + end_month + end_day));
            console.log(response.statusCode);
            if (!error && response.statusCode === 200) {

                resolve(body.items);

            } else {

                reject(error);

            }

        });

    });

    return promise;

};

Wikipedia.prototype.getMostViewedArticles = function(language_code, year, month, day, access, how_many, include_specials) {

    var that = this;

    var results = [];

    var exclude = false;

    var promise = new Promise(function(resolve, reject) {

        request({
            url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/" + language_code + ".wikipedia/" + access + "/" + year + "/" + month + "/" + day,
            json: true
        }, function (error, response, body) {

            if (!error && response.statusCode === 200) {

                if (body.items[0].articles.length > 0) {

                    for (var i = 0; results.length < how_many; i++) {

                        // If we have reached the last article break the loop.
                        if (i >= body.items[0].articles.length) {

                            break;

                        }

                        exclude = false;

                        if (!include_specials) {

                            for (var j = 0; j < that.bereziak.length; j++) {

                                if (body.items[0].articles[i].article.substr(0, that.bereziak[j].length) === that.bereziak[j]) {

                                    exclude = true;
                                    break;

                                }

                            }

                        }

                        if (!exclude) {
                            results.push(body.items[0].articles[i]);
                        }

                    }

                }

                resolve(results);

            } else {
                reject(error);
            }

        });

    });

    return promise;

};

module.exports = Wikipedia;
