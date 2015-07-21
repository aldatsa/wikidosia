var request = require("request");
var Twit = require('twit');
var fs = require('fs');
var schedule = require('node-schedule');

var config = JSON.parse(fs.readFileSync('./config.json'));

var j = schedule.scheduleJob('0 10,22 * * *', function() {
    txiokatuWikidosia();
});

function txiokatuWikidosia() {

    var T = new Twit({
        consumer_key:         config.twitter_app.consumer_key,
        consumer_secret:      config.twitter_app.consumer_secret,
        access_token:         config.twitter_app.access_token,
        access_token_secret:  config.twitter_app.access_token_secret
    });

    var emaitza = {
        pageid: undefined,
        title: "",
        extract: ""
    };

    var mezua = "";

    request({
        url: "http://eu.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts&explaintext&exintro=&format=json",
        json: true
    }, function (error, response, body) {

        if (!error && response.statusCode === 200) {

            for (var orria in body.query.pages) {

                emaitza.pageid = body.query.pages[orria].pageid;
                emaitza.title = body.query.pages[orria].title;
                emaitza.extract = body.query.pages[orria].extract;

                request({
                    url: "http://eu.wikipedia.org/w/api.php?action=query&prop=info&pageids=" + emaitza.pageid + "&inprop=url&format=json",
                    json: true
                }, function(error, response, body) {

                    if (!error && response.statusCode === 200) {

                        for (var orria in body.query.pages) {

                            emaitza.fullurl = body.query.pages[orria].fullurl;

                        }

                        mezua = emaitza.title + " - " + emaitza.extract;

                        mezua = mezua.substring(0, 140 - 27);

                        mezua = mezua + "... " + emaitza.fullurl;

                        T.post('statuses/update', { status: mezua }, function(err, data, response) {
                            if(err) {
                                console.log("There was a problem tweeting the message.", err);
                            }
                        });

                    }

                });
            }
        }

    });
}
