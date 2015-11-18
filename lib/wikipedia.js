var request = require("request");
var Promise = require('promise');

var Wikipedia = function() {

}

Wikipedia.prototype.getMostViewedArticles = function(language_code, year, month, day) {

    var promise = new Promise(function (resolve, reject) {

        request({
            url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/" + language_code + ".wikipedia/all-access/" + year + "/" + month + "/" + day,
            json: true
        }, function (error, response, body) {

            if (!error && response.statusCode === 200) {
                resolve(body.items[0].articles);
            } else {
                reject(error);
            }

        });

    });

    return promise;
    
}

module.exports = Wikipedia;
