var request = require("request");
var Twit = require('twit');
var schedule = require('node-schedule');
var Promise = require('promise');
var Wikipedia = require("./wikipedia");

var wikipedia = new Wikipedia();

var Wikidosia = function (config) {

    var self = this;

    this.kredentzialak = {

        "consumer_key": config.twitter_app.consumer_key,
        "consumer_secret": config.twitter_app.consumer_secret,
        "access_token": config.twitter_app.access_token,
        "access_token_secret": config.twitter_app.access_token_secret

    };

    // EDT ordua (-6 ordu)
    // Momentuz 9:00 eta 21:00tan. Argi ordu aldaketekin!
    var j = schedule.scheduleJob(config.schedule_job, function() {
        self.txiokatuWikidosia();
    });

    // Atzoko irakurrienen zerrendaren txioak.
    // EDT ordua (-6 ordu)
    // Momentuz 12:00tan. Argi ordu aldaketekin!
    var irakurrienen_txioak = schedule.scheduleJob(config.schedule_job_most_viewed, function() {

        self.txiokatuAtzokoIrakurrienak("eu", "all-access", 10, false);

    });
};

Wikidosia.prototype.txiokatuAtzokoIrakurrienak = function(hizkuntza_kodea, sarbidea, zenbat, bereziak_barne) {

    // Atzoko data eskuratu.
    var data = new Date();
    data.setDate(data.getUTCDate() - 1);

    var urtea = data.getUTCFullYear();
    var hilabetea = data.getUTCMonth() + 1; // Hilabeteak 0-11 bezala itzultzen ditu.
    var eguna = data.getUTCDate();

    if (hilabetea < 10) {
        hilabetea = "0" + hilabetea;
    }

    if (eguna < 10) {
        eguna = "0" + eguna;
    }

    this.txiokatuEgunekoIrakurrienak(hizkuntza_kodea, urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne);

}

Wikidosia.prototype.txiokatuEgunekoIrakurrienak = function(hizkuntza_kodea, urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne) {

    var T = new Twit({
        consumer_key:         this.kredentzialak.consumer_key,
        consumer_secret:      this.kredentzialak.consumer_secret,
        access_token:         this.kredentzialak.access_token,
        access_token_secret:  this.kredentzialak.access_token_secret
    });

    var mezua = "Atzoko #wikirakurrienak:\n";

    wikipedia.getMostViewedArticles(hizkuntza_kodea, urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne).then(function(emaitza) {

        var tmp_mezua = "";

        for (var i = 0; i < emaitza.length; i++) {

            tmp_mezua = (i + 1) + " " + emaitza[i].article.replace(/_/g, ' ') + "\n";

            if (mezua.length + tmp_mezua.length + 23 < 140) {

                mezua = mezua + tmp_mezua;

            } else {

                break;

            }

        }

        mezua = mezua + "http://wikidosia.aldatsa.eus/irakurrienak?data=" + urtea + "-" + hilabetea + "-" + eguna + "&bereziak_barne=" + bereziak_barne + "&sarbidea=" + sarbidea;

        T.post('statuses/update', { status: mezua }, function(err, data, response) {
            if(err) {
                console.log("There was a problem tweeting the message.", err);
            }
        });

    });

}

Wikidosia.prototype.txiokatuWikidosia = function() {

    var T = new Twit({
        consumer_key:         this.kredentzialak.consumer_key,
        consumer_secret:      this.kredentzialak.consumer_secret,
        access_token:         this.kredentzialak.access_token,
        access_token_secret:  this.kredentzialak.access_token_secret
    });

    var mezua = "";

    wikipedia.getRandomArticle("eu").then(function(emaitza) {

        mezua = emaitza.title + " - " + emaitza.extract;

        mezua = mezua.substring(0, 140 - 27);

        mezua = mezua + "... " + emaitza.fullurl;

        T.post('statuses/update', { status: mezua }, function(err, data, response) {
            if(err) {
                console.log("There was a problem tweeting the message.", err);
            }
        });

    });

};

Wikidosia.prototype.eskuratuArtikuluenIkustaldienHistoria = function(artikuluak) {

    var promise = new Promise(function(resolve, reject) {

        // Wikipediako artikuluen datuak eskuratzeko egingo ditugun deien promise-ak gordetzeko array-a.
        var promiseak = [];

        // Datuak array-ko lehen elementuan daten array-a gordeko dugu.
        // Ondorengo elementuetan artikulu bakoitzaren ikustaldien datuak.
        var datuak = [];

        // Daten array-a gehitu lehen elementu bezala array-aren izena, "data", duelarik.
        datuak[0] = ["data"];

        // Artikulu bakoitzeko lehen elementu bezala artikuluaren izena duen array bat gehitu datuen array-ra.
        artikuluak.forEach(function(artikulua) {
            datuak.push([artikulua.replace(/_/g, " ")]);
        });

        // Artikulu bakoitzaren datuak eskuratuko ditugu Wikipediaren APIa erabiliz.
        // Wikipedia objektuaren getDailyPageViews metodoak itzultzen dituen promise-ak array batean gordeko ditugu.
        artikuluak.forEach(function(artikulua) {

            promiseak.push(wikipedia.getDailyPageViews("eu", artikulua, "2015", "12", "01", "2016", "01", "05", "all-access", "all-agents"));

        });

        // Datu guztiak eskuratu ditugunean...
        Promise.all(promiseak).then(function(emaitzak) {

            // Artikulu bakoitzaren datuekin...
            emaitzak.forEach(function(emaitza, indizea) {

                // Egun bakoitzeko datuekin (data eta ikustaldiak)...
                emaitza.forEach(function(datua) {

                    // Lehen artikulua bada, egun guztien datak gordeko ditugu daten array-an.
                    if (indizea === 0) {

                        datuak[0].push(datua.timestamp);

                    }

                    // Artikuluaren ikustaldiak gorde dagokion array-an.
                    datuak[indizea + 1].push(datua.views);

                });

            });

            resolve(datuak);

        }, function(errorea) {

            console.log(errorea);

            reject(errorea);

        });

    });

    return promise;

};

module.exports = Wikidosia;
