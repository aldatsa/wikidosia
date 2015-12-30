var request = require("request");
var Twit = require('twit');
var schedule = require('node-schedule');
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

module.exports = Wikidosia;
