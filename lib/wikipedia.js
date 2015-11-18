var request = require("request");
var Promise = require('promise');

var Wikipedia = function() {

}

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

}

Wikipedia.prototype.getMostViewedArticles = function(language_code, year, month, day, how_many, include_specials) {

    var results = [];

    var promise = new Promise(function(resolve, reject) {

        request({
            url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/" + language_code + ".wikipedia/all-access/" + year + "/" + month + "/" + day,
            json: true
        }, function (error, response, body) {

            if (!error && response.statusCode === 200) {

                body.items[0].articles = JSON.parse(body.items[0].articles);

                for (var i = 0; results.length < how_many; i++) {

                    if (!include_specials && (body.items[0].articles[i].article.substr(0, 7) === "Berezi:" || body.items[0].articles[i].article.substr(0, 8) === "Special:" || body.items[0].articles[i].article.substr(0, 9) === "Template:")) {

                        continue;

                    }

                    results.push(body.items[0].articles[i]);

                }

                resolve(results);

            } else {
                reject(error);
            }

        });

    });

    return promise;

}

module.exports = Wikipedia;
