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
var Twit = require('twit');
var schedule = require('node-schedule');
var Promise = require('promise');
var cheerio = require('cheerio');
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

    // Asteko irudiaren txioak.
    // EDT ordua (-6 ordu))
    // Momentuz astelehenetan 15:00tan. Argi ordu aldaketekin!
    var asteko_irudiaren_txioak = schedule.scheduleJob(config.schedule_job_picture_of_the_week, function() {

        self.txiokatuAstekoIrudia();

    });

};

Wikidosia.prototype.txiokatuAtzokoIrakurrienak = function(hizkuntza_kodea, sarbidea, zenbat, bereziak_barne) {

    // Atzoko data eskuratu.
    var data = new Date();
    data.setDate(data.getUTCDate() - 1);

    var urtea = data.getUTCFullYear();
    var hilabetea = this.itzuliHilabeteaKatea(data);
    var eguna = this.itzuliEgunaKatea(data);

    this.txiokatuEgunekoIrakurrienak(hizkuntza_kodea, urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne);

};

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

Wikidosia.prototype.eskuratuArtikuluenIkustaldienHistoria = function(hizkuntza_kodea,
                                                                     artikuluak,
                                                                     hasierako_urtea, hasierako_hilabetea, hasierako_eguna,
                                                                     amaierako_urtea, amaierako_hilabetea, amaierako_eguna,
                                                                     sarbidea,
                                                                     agentea) {

    var self = this;

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

        // Hasierako eta amaierako daten arteko daten array-a eskuratu.
        var tarteko_datak = self.itzuliTartekoDatak(hasierako_urtea, hasierako_hilabetea, hasierako_eguna,
                                                    amaierako_urtea, amaierako_hilabetea, amaierako_eguna);

        // Tarteko data guztiak datuak[0] array-ra gehitu.
        tarteko_datak.forEach(function(data) {

            datuak[0].push(data.getUTCFullYear() + "" + self.itzuliHilabeteaKatea(data) + self.itzuliEgunaKatea(data) + "00");

            // Artikuluen bakoitzean data bakoitzeko ikustaldiak zerora jarri.
            artikuluak.forEach(function(artikulua, index) {

                datuak[index + 1].push(0);

            });

        });

        // Pageviews APIaren dokumentazioan amaierako data barne jartzen du:
        // "The date of the last day to include, in YYYYMMDD format",
        // baina itzulitako datuek ez dute azken eguna barne hartzen.
        // https://wikimedia.org/api/rest_v1/?doc#!/Pageviews_data/get_metrics_pageviews_per_article_project_access_agent_article_granularity_start_end
        // Konpontzeko egun bat gehituko diogu azken datari. Eguna "09" bezalako kate bat izan daitekeelako erabiltzen dugu parseInt.
        var amaierako_data = new Date(Date.UTC(amaierako_urtea, amaierako_hilabetea, amaierako_eguna));
        amaierako_data.setDate(amaierako_data.getDate() + 1);

        amaierako_urtea = amaierako_data.getUTCFullYear();
        amaierako_hilabetea = self.itzuliHilabeteaKatea(amaierako_data);
        amaierako_eguna = self.itzuliEgunaKatea(amaierako_data);

        // Artikulu bakoitzaren datuak eskuratuko ditugu Wikipediaren APIa erabiliz.
        // Wikipedia objektuaren getDailyPageViews metodoak itzultzen dituen promise-ak array batean gordeko ditugu.
        artikuluak.forEach(function(artikulua) {

            promiseak.push(wikipedia.getDailyPageViews(hizkuntza_kodea,
                                                       artikulua,
                                                       hasierako_urtea, hasierako_hilabetea, hasierako_eguna,
                                                       amaierako_urtea, amaierako_hilabetea, amaierako_eguna,
                                                       sarbidea,
                                                       agentea));

        });

        // Datu guztiak eskuratu ditugunean...
        Promise.all(promiseak).then(function(emaitzak) {

            // Artikulu bakoitzaren datuekin...
            emaitzak.forEach(function(emaitza, indizea) {

                // Egun bakoitzeko datuekin (data eta ikustaldiak)...
                for (var i = 0; i < emaitza.length; i++) {

                    /*
                     * Artikuluaren ikustaldiak gordeko ditugu dagokion array-an.
                     * Baina kontuan izan behar da artikulu batek egun jakin batean ez badauka bisitarik
                     * egun hori ez da agertzen APIak itzultzen dituen datuen zerrendan.
                     * Ikusi #6 https://github.com/aldatsa/wikidosia/issues/6
                     * Adibidez, Beñat Gaztelumendik ez dauka ikustaldirik abenduaren 3an:
                     * [ [ { project: 'eu.wikipedia',
                     *       article: 'Beñat_Gaztelumendi',
                     *       granularity: 'daily',
                     *       timestamp: '2015120200',
                     *       access: 'all-access',
                     *       agent: 'user',
                     *       views: 2 },
                     *     { project: 'eu.wikipedia',
                     *       article: 'Beñat_Gaztelumendi',
                     *       granularity: 'daily',
                     *       timestamp: '2015120400',
                     *       access: 'all-access',
                     *       agent: 'user',
                     *       views: 2 } ] ]
                     */
                    for (var j = 1; j < datuak[0].length; j++) {

                        // Daten array-ko elementu batekin bat badator emaitzaren timestamp-a...
                        if (datuak[0][j] === emaitza[i].timestamp) {

                            // Artikuluaren ikustaldiak gorde dagokion array-ko indizea.
                            datuak[indizea + 1][j] = emaitza[i].views;

                            break;

                        }
                    }

                }

            });

            resolve(datuak);

        }, function(errorea) {

            console.log(errorea);

            reject(errorea);

        });

    });

    return promise;

};

Wikidosia.prototype.txiokatuAstekoHerria = function() {

    var url = "https://eu.wikipedia.org/wiki/Txantiloi:Asteko_herria";

    request({
        url: url
    }, function(error, response, body) {

        if (!error && response.statusCode == 200) {

            var $ = cheerio.load(body);

            var herria = {};
            var mezua = "";

            herria.izena = $("#mw-content-text td > a").attr("title");
            herria.esteka = "https://eu.wikipedia.org" + $("#mw-content-text td > a").attr("href");
            herria.herrialdea = $("#mw-content-text span.flagicon a").attr("title");

            // Gainerako herrialdeekin ez dago arazorik baina Nafarroa Behereari a kendu behar zaio -ko gehitu aurretik.
            if (herria.herrialdea === "Nafarroa Beherea") {

                herria.herrialdea = "Nafarroa Behere";

            }

            console.log("Euskarazko Wikipediako #AstekoHerria " + herria.herrialdea + "ko " + herria.izena + " da " + herria.esteka);

        }

    });
};

Wikidosia.prototype.txiokatuAstekoIrudia = function() {

    var url = "https://eu.wikipedia.org/wiki/Txantiloi:Asteko_argazkia";

    var T = new Twit({
        consumer_key:         this.kredentzialak.consumer_key,
        consumer_secret:      this.kredentzialak.consumer_secret,
        access_token:         this.kredentzialak.access_token,
        access_token_secret:  this.kredentzialak.access_token_secret
    });

    request({
        url: url
    }, function (error, response, body) {

        if (!error && response.statusCode == 200) {

            var $ = cheerio.load(body);

            // Asteko irudiaren datuak.
            var irudia;

            // Asteko irudiaren testua.
            var testua = "";

            irudia = $("#mw-content-text a.image img")[0].attribs;
            testua = $("#mw-content-text div center").text();

            irudia.urla = "https://eu.wikipedia.org" + $("#mw-content-text a.image").attr("href");

            var image_request = require('request').defaults({ encoding: null });

            image_request.get("https:" + irudia.src, function (error, response, body) {

                var b64content;

                if (!error && response.statusCode == 200) {

                    b64content = new Buffer(body).toString('base64');

                    // Irudia Twitter-era igo.
                    T.post('media/upload', { media_data: b64content }, function (err, data, response) {

                        // Irudiaren erreferentzia eskuratu. now we can reference the media and post a tweet (media will attach to the tweet)
                        var mediaIdStr = data.media_id_string;

                        var mezua = testua.substring(0, 140 - 61);

                        mezua = mezua + " " + irudia.urla + " #AstekoIrudia";

                        // Txioaren parametroak prestatu.
                        var params = {
                            status: mezua,
                            media_ids: [mediaIdStr]
                        };

                        T.post('statuses/update', params, function (err, data, response) {

                            if (err) {
                                console.log("There was a problem tweeting the message.", err);
                            }

                        });
                    });
                }
            });

        }

    });
};

/*
 * Hasierako eta amaierako daten arteko egun guztien daten array-a itzultzen du.
 * http://stackoverflow.com/a/7114229/2855012
 */
Wikidosia.prototype.itzuliTartekoDatak = function(hasierako_urtea, hasierako_hilabetea, hasierako_eguna,
                                                  amaierako_urtea, amaierako_hilabetea, amaierako_eguna) {

    var data1 = new Date(Date.UTC(hasierako_urtea, hasierako_hilabetea, hasierako_eguna));
    var data2 = new Date(Date.UTC(amaierako_urtea, amaierako_hilabetea, amaierako_eguna));
    var eguna;
    var tartea = [];

    while (data1 <= data2) {

        eguna = new Date(Date.UTC(data1.getUTCFullYear(), data1.getUTCMonth() - 1, data1.getUTCDate()));

        tartea.push(eguna);

        data1.setDate(data1.getDate() + 1);

    }

    return tartea;

};

/*
 * Data bat jaso eta hilabetea itzultzen du testu kate bezala,
 * behar izanez gero aurretik zeroa gehituta.
 */
Wikidosia.prototype.itzuliHilabeteaKatea = function(data) {

    var hilabetea = data.getUTCMonth() + 1; // Hilabeteak 0-11 bezala itzultzen ditu.

    if (hilabetea < 10) {
        hilabetea = "0" + hilabetea;
    }

    return hilabetea;

};

/*
 * Data bat jaso eta eguna itzultzen du testu kate bezala,
 * behar izanez gero aurretik zeroa gehituta.
 */
Wikidosia.prototype.itzuliEgunaKatea = function(data) {

    var eguna = data.getUTCDate();

    if (eguna < 10) {
        eguna = "0" + eguna;
    }

    return eguna;

};

module.exports = Wikidosia;
