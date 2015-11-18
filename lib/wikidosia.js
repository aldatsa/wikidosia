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
};

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
