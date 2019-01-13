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
var Masto = require('mastodon');
var crontab = require('node-crontab');
var Promise = require('promise');
var cheerio = require('cheerio');
var https = require('https');
var fs = require('fs');
var path = require("path");
var url = require("url");
var TelegramBot = require('node-telegram-bot-api');
var Wikipedia = require("./wikipedia");
var EuskalWikipedia = require('./euskalwikipedia');

var euskalwikipedia = new EuskalWikipedia();
var wikipedia = new Wikipedia();

var Wikidosia = function (config) {

    var self = this;

    this.kredentzialak = {

        "consumer_key": config.twitter_app.consumer_key,
        "consumer_secret": config.twitter_app.consumer_secret,
        "access_token": config.twitter_app.access_token,
        "access_token_secret": config.twitter_app.access_token_secret

    };

    this.kredentzialak_mastodon = {

        "access_token": config.mastodon_app.access_token,
        "api_url": config.mastodon_app.api_url

    };

    // Telegrameko bot-a.
    var telegram_bot = new TelegramBot(config.telegram_bot.token, {polling: true});

    // Erabiltzaileak telegram-en /ausazkoa komandoa erabiltzen badu...
    telegram_bot.onText(/\/ausazkoa/, function(msg, match) {

        var from_id = msg.from.id;
        var chat_id = msg.chat.id;

        wikipedia.getRandomArticle("eu").then(function(emaitza) {

            telegram_bot.sendMessage(chat_id, emaitza.fullurl);

        });
    });

    // Erabiltzaileak telegram-en /asteko_irudia komandoa erabiltzen badu...
    telegram_bot.onText(/\/asteko_irudia/, function(msg, match) {

        var chat_id = msg.chat.id;

        euskalwikipedia.eskuratuAstekoIrudia().then(function(asteko_irudia) {

            var irudia_url = asteko_irudia.irudiak.x2;

            // Irudiaren esteka bidali ordez irudia bidalita hobe?
            // Horretarako deskargatu beharko dut, ez baitu URLa erabiliz irudiak bidaltzen uzten. Baina nora deskargatu? Gero ezabatu?
            //telegram_bot.sendPhoto(chat_id, irudia, { caption: asteko_irudia.testua });
            telegram_bot.sendMessage(chat_id, irudia_url);

        });
    });

    // Erabiltzaileak telegram-en /irakurrienak komandoa erabiltzen badu...
    telegram_bot.onText(/\/irakurrienak/, function(msg, match) {

        var chat_id = msg.chat.id;

        var mezua = "Atzoko #wikirakurrienak:\n";

        // Atzoko data eskuratu.
        var data = new Date();
        data.setDate(data.getUTCDate() - 1);

        var urtea = data.getUTCFullYear();
        var hilabetea = self.itzuliHilabeteaKatea(data);
        var eguna = self.itzuliEgunaKatea(data);
        var sarbidea = "all-access";
        var zenbat = 10;
        var bereziak_barne = false;

        wikipedia.getMostViewedArticles("eu", urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne).then(function(emaitza) {

            for (var i = 0; i < emaitza.length; i++) {

                mezua = mezua + (i + 1) + " " + emaitza[i].article.replace(/_/g, ' ') + "\n";

            }

            mezua = mezua + "Zerrenda osoa ikusteko: http://wikidosia.aldatsa.eus/irakurrienak?data=" + urtea + "-" + hilabetea + "-" + eguna + "&bereziak_barne=" + bereziak_barne + "&sarbidea=" + sarbidea;

            telegram_bot.sendMessage(chat_id, mezua);
        });

    });

    telegram_bot.on('inline_query', function (query) {

        var query_results = [];

        wikipedia.getSearchResults("eu", query.query).then(function(results) {
            if (results.query && results.query.search) {
                query_results = results.query.search.map(function (elem) {
                    return {
                        id: elem.title,
                        type: "article",
                        title: elem.title,
                        input_message_content: {
                            message_text: "https://eu.wikipedia.org/wiki/" + elem.title.replace(/ /g, '_')
                        }
                    };
                });
                telegram_bot.answerInlineQuery(query.id, query_results);
            }
        });
    });

    // KONTUZ!
    // node-crontab-ek 0-7 balioak onartu behar lituzke bateragarritasun arrazoiengatik,
    // baina 0-6 arteko balioak onartzen ditu asteko egunentzat.
    // http://stackoverflow.com/questions/18919151/crontab-day-of-the-week-syntax
    // 7 jarriz gero errorea ematen du:
    // Error: Constraint error, got range 4-7 expected range 0-6

    // Ausazko artikuluak.
    // EDT ordua (-6 ordu)
    // Momentuz 9:00tan. Argi ordu aldaketekin!
    var j = crontab.scheduleJob(config.schedule_job, function() {

        self.txiokatuWikidosia();

        self.tootWikidosia();

    });

    // Atzoko irakurrienen zerrendaren txioak.
    // EDT ordua (-6 ordu)
    // Momentuz 12:00tan. Argi ordu aldaketekin!
    var irakurrienen_txioak = crontab.scheduleJob(config.schedule_job_most_viewed, function() {

        self.txiokatuAtzokoIrakurrienak("eu", "all-access", 10, false);
        self.tootAtzokoIrakurrienak("eu", "all-access", 10, false);

    });

    // Ausazko artikuluak.
    // EDT ordua (-6 ordu)
    // Momentuz astearteetan eta ostegunetik igandera 21:00tan. Argi ordu aldaketekin!
    var nabarmendutakoak_txioak = crontab.scheduleJob(config.schedule_job_nabarmenduak, function() {

        self.txiokatuNabarmendua();

    });

    // Asteko irudiaren txioak.
    // EDT ordua (-6 ordu))
    // Momentuz astelehenetan 21:00tan. Argi ordu aldaketekin!
    var asteko_irudiaren_txioak = crontab.scheduleJob(config.schedule_job_picture_of_the_week, function() {

        self.txiokatuAstekoIrudia();

    });

    // Asteko herriaren txioak.
    // EDT ordua (-6 ordu))
    // Momentuz asteazkenetan 21:00tan. Argi ordu aldaketekin!
    var asteko_herriaren_txioak = crontab.scheduleJob(config.schedule_job_town_of_the_week, function() {

        self.txiokatuAstekoHerria();

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

            if (mezua.length + tmp_mezua.length + 23 < 280) {

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

Wikidosia.prototype.tootAtzokoIrakurrienak = function(hizkuntza_kodea, sarbidea, zenbat, bereziak_barne) {

    // Atzoko data eskuratu.
    var data = new Date();
    data.setDate(data.getUTCDate() - 1);

    var urtea = data.getUTCFullYear();
    var hilabetea = this.itzuliHilabeteaKatea(data);
    var eguna = this.itzuliEgunaKatea(data);

    this.tootEgunekoIrakurrienak(hizkuntza_kodea, urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne);

};

Wikidosia.prototype.tootEgunekoIrakurrienak = function(hizkuntza_kodea, urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne) {

    var M = new Masto({
        access_token: this.kredentzialak_mastodon.access_token,
        api_url: this.kredentzialak_mastodon.api_url
    });

    var mezua = "Atzoko #wikirakurrienak:\n";

    wikipedia.getMostViewedArticles(hizkuntza_kodea, urtea, hilabetea, eguna, sarbidea, zenbat, bereziak_barne).then(function(emaitza) {

        var tmp_mezua = "";

        for (var i = 0; i < emaitza.length; i++) {

            tmp_mezua = (i + 1) + " " + emaitza[i].article.replace(/_/g, ' ') + "\n";

            if (mezua.length + tmp_mezua.length + 23 < 500) {

                mezua = mezua + tmp_mezua;

            } else {

                break;

            }

        }

        mezua = mezua + "http://wikidosia.aldatsa.eus/irakurrienak?data=" + urtea + "-" + hilabetea + "-" + eguna + "&bereziak_barne=" + bereziak_barne + "&sarbidea=" + sarbidea;

        M.post('statuses', { status: mezua }, function(err, data, response) {
            if(err) {
                console.log("There was a problem tooting the message.", err);
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

        mezua = mezua.substring(0, 280 - 27);

        mezua = mezua + "... " + emaitza.fullurl;

        T.post('statuses/update', { status: mezua }, function(err, data, response) {
            if(err) {
                console.log("There was a problem tweeting the message.", err);
            }
        });

    });

};

Wikidosia.prototype.tootWikidosia = function() {

    var M = new Masto({
        access_token: this.kredentzialak_mastodon.access_token,
        api_url: this.kredentzialak_mastodon.api_url
    });

    var mezua = "";

    wikipedia.getRandomArticle("eu").then(function(emaitza) {

        mezua = emaitza.title + " - " + emaitza.extract;

        mezua = mezua.substring(0, 500 - 27);

        mezua = mezua + "... " + emaitza.fullurl;

        M.post('statuses', { status: mezua }, function(err, data, response) {
            if(err) {
                console.log("There was a problem tooting the message.", err);
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
        // Konpontzeko egun bat gehituko diogu azken datari.
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

/*
 * Azkena txiokatutako nabarmendua zein den eta zenbagarrena den gordetzen ditu.
 */
Wikidosia.prototype.gordeTxiokatutakoNabarmendua = function(izena) {

    var hurrengoa = 0;

    // OpenShift-en bagaude bertako bidea erabili, lokalean bagaude berriz config.json-en bide erlatiboa.
    var bidea = process.env.OPENSHIFT_DATA_DIR || "./openshift/";
    var fitxategia = bidea + "nabarmenduen_kontua.json";

    var promise = new Promise(function(resolve, reject) {

        fs.readFile(fitxategia, 'utf8', function (err, data) {

            if (err) {

                console.log(err);

                reject(err);
            }

            data = JSON.parse(data);

            hurrengoa = data.hurrengoa + 1;

            data.txiokatutakoak.push(izena);

            // Datuak gorde fitxategian.
            fs.writeFile(fitxategia, JSON.stringify({"hurrengoa": hurrengoa, "txiokatutakoak": data.txiokatutakoak}, null, 4), function(err) {
                if (err) {
                    console.log(err);

                    reject(err);

                } else {
                    console.log("JSON fitxategia behar bezala gorde da: " + fitxategia);
                }
            });

        });
    });

    return promise;

};

/*
 * Hurrena txiokatu beharreko nabarmendua zenbagarrena den itzultzen du.
 */
Wikidosia.prototype.eskuratuZenbagarrenNabarmendua = function() {

    var zenbagarrena = 0;

    // OpenShift-en bagaude bertako bidea erabili, lokalean bagaude berriz config.json-en bide erlatiboa.
    var bidea = process.env.OPENSHIFT_DATA_DIR || "./openshift/";
    var fitxategia = bidea + "nabarmenduen_kontua.json";

    var promise = new Promise(function(resolve, reject) {

        fs.readFile(fitxategia, 'utf8', function (err, data) {

            if (err) {

                console.log(err);

                reject(err);
            }

            data = JSON.parse(data);

            zenbagarrena = data.hurrengoa;

            resolve(zenbagarrena);
        });
    });

    return promise;

};

Wikidosia.prototype.eskuratuHurrengoNabarmendua = function() {

    var hurrengo_nabarmendua = "";
    var self = this;

    // OpenShift-en bagaude bertako bidea erabili, lokalean bagaude berriz config.json-en bide erlatiboa.
    var bidea = process.env.OPENSHIFT_DATA_DIR || "./openshift/";
    var fitxategia = bidea + "nabarmenduak-desordenatuta.json";

    var promise = new Promise(function(resolve, reject) {

        self.eskuratuZenbagarrenNabarmendua().then(function(emaitza) {

            var zenbagarrena = emaitza;

            fs.readFile(fitxategia, 'utf8', function (err, data) {

                if (err) {

                    console.log(err);

                    reject(err);
                }

                data = JSON.parse(data);

                hurrengo_nabarmendua = data[zenbagarrena];

                resolve(hurrengo_nabarmendua);
            });
        });
    });

    return promise;

};

Wikidosia.prototype.txiokatuNabarmendua = function() {

    var self = this;
    var mezua = "";

    var T = new Twit({
        consumer_key:         this.kredentzialak.consumer_key,
        consumer_secret:      this.kredentzialak.consumer_secret,
        access_token:         this.kredentzialak.access_token,
        access_token_secret:  this.kredentzialak.access_token_secret
    });

    self.eskuratuHurrengoNabarmendua().then(function(emaitza) {

        var kategoria = "";

        // Hau txukunago egin daiteke. Adibidez, azpi-kategoria "Euskal Herria" eta kategoria "Historia" -> "Euskal Herriko historia"
        if (emaitza["azpi-kategoria"] === "Bestelakoak" || emaitza["azpi-kategoria"] === "Euskal Herrikoak" || emaitza["azpi-kategoria"] === "Besteak" ||
            emaitza["azpi-kategoria"] === "Eskualde eta banaketa administratiboak" || emaitza["azpi-kategoria"] === "Europakoak" ||
            emaitza["azpi-kategoria"] === "Euskal Herria" || emaitza["azpi-kategoria"] === "Mundua") {

            kategoria = emaitza.kategoria;

        } else if (emaitza["azpi-kategoria"] !== "") {

            kategoria = emaitza["azpi-kategoria"];

        } else {

            kategoria = emaitza.kategoria;

        }

        mezua = kategoria + " kategoriako #ArtikuluNabarmendua: " + emaitza.izena + " " + emaitza.esteka;

        euskalwikipedia.eskuratuArtikuluarenIrudia(emaitza.esteka).then(function(irudiak) {

            var image_request = require('request').defaults({ encoding: null });

            image_request.get(irudiak.x2, function (error, response, body) {

                var b64content;

                if (!error && response.statusCode == 200) {

                    b64content = new Buffer(body).toString('base64');

                    // Irudia Twitter-era igo.
                    T.post('media/upload', { media_data: b64content }, function (err, data, response) {

                        // Irudiaren erreferentzia eskuratu. now we can reference the media and post a tweet (media will attach to the tweet)
                        var mediaIdStr = data.media_id_string;

                        // Txioaren parametroak prestatu.
                        var params = {
                            status: mezua,
                            media_ids: [mediaIdStr]
                        };

                        T.post('statuses/update', params, function (err, data, response) {

                            if (err) {

                                console.log("There was a problem tweeting the message.", err);

                            } else {

                                console.log(irudiak);
                                console.log(mezua);

                                self.gordeTxiokatutakoNabarmendua(emaitza.izena);

                            }

                        });
                    });

                } else {

                    // Irudirik gabe txiokatu.
                    T.post('statuses/update', { status: mezua }, function(err, data, response) {

                        if (err) {

                            console.log("There was a problem tweeting the message.", err);

                        } else {
                            console.log(mezua);
                            self.gordeTxiokatutakoNabarmendua(emaitza.izena);

                        }
                    });

                }
            });

        });
    });
};

Wikidosia.prototype.txiokatuAstekoHerria = function() {

    var asteko_herria_url = "https://eu.wikipedia.org/wiki/Txantiloi:Asteko_herria";

    var T = new Twit({
        consumer_key:         this.kredentzialak.consumer_key,
        consumer_secret:      this.kredentzialak.consumer_secret,
        access_token:         this.kredentzialak.access_token,
        access_token_secret:  this.kredentzialak.access_token_secret
    });

    request({
        url: asteko_herria_url
    }, function(error, response, body) {

        if (!error && response.statusCode == 200) {

            var $ = cheerio.load(body);

            var herria = {};
            var mezua = "";

            herria.izena = $("#mw-content-text td > a").attr("title");
            herria.esteka = "https://eu.wikipedia.org" + $("#mw-content-text td > a").attr("href");
            herria.herrialdea = $("#mw-content-text span.flagicon a").attr("title");
            herria.irudiak = {};

            // Herrialdeen izen batzuei aldaketak egin behar zaizkie.
            if (herria.herrialdea === "Nafarroa Beherea") {

                herria.herrialdea = "Nafarroa Behere";

            } else if (herria.herrialdea === "Nafarroako Foru Erkidegoa") {

                herria.herrialdea = "Nafarroa Garai";

            } else if (herria.herrialdea === "Bizkaia") {

                herria.herrialdea = "Bizkai";

            }

            euskalwikipedia.eskuratuArtikuluarenIrudia(herria.esteka).then(function(irudiak) {

                herria.irudiak = irudiak;

                console.log(herria.irudiak);

                var image_request = require('request').defaults({ encoding: null });

                image_request.get(herria.irudiak.x2, function (error, response, body) {

                    var b64content;

                    if (!error && response.statusCode == 200) {

                        b64content = new Buffer(body).toString('base64');

                        // Irudia Twitter-era igo.
                        T.post('media/upload', { media_data: b64content }, function (err, data, response) {

                            // Irudiaren erreferentzia eskuratu. now we can reference the media and post a tweet (media will attach to the tweet)
                            var mediaIdStr = data.media_id_string;

                            var mezua = "Euskarazko Wikipediako #AstekoHerria " + herria.herrialdea + "ko " + herria.izena + " da " + herria.esteka;
                            console.log("Euskarazko Wikipediako #AstekoHerria " + herria.herrialdea + "ko " + herria.izena + " da " + herria.esteka);

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
                    } else {

                        console.log("Errorea gertatu da asteko herriaren irudia eskuratzean.");
                        console.log(error);

                    }
                });
            });
        } else {

            console.log("Errorea gertatu da asteko herriaren datuak eskuratzean.");
            console.log(error);

        }
    });
};

Wikidosia.prototype.txiokatuAstekoIrudia = function() {

    var T = new Twit({
        consumer_key:         this.kredentzialak.consumer_key,
        consumer_secret:      this.kredentzialak.consumer_secret,
        access_token:         this.kredentzialak.access_token,
        access_token_secret:  this.kredentzialak.access_token_secret
    });

    euskalwikipedia.eskuratuAstekoIrudia().then(function(asteko_argazkia) {

        var image_request = require('request').defaults({ encoding: null });

        image_request.get(asteko_argazkia.irudiak.x2, function (error, response, body) {

            var b64content;

            if (!error && response.statusCode == 200) {

                b64content = new Buffer(body).toString('base64');

                // Irudia Twitter-era igo.
                T.post('media/upload', { media_data: b64content }, function (err, data, response) {

                    // Irudiaren erreferentzia eskuratu. now we can reference the media and post a tweet (media will attach to the tweet)
                    var mediaIdStr = data.media_id_string;

                    var mezua = asteko_argazkia.testua.substring(0, 280 - 65);

                    // Testuari zati bat moztu badiogu...
                    if (mezua.length < asteko_argazkia.testua.length) {

                        // Amaieran hiru puntu gehitu.
                        mezua = mezua + "...";

                    }

                    mezua = mezua + " " + asteko_argazkia.irudiak.x1 + " #AstekoIrudia";

                    console.log(mezua);

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
    });
};

Wikidosia.prototype.tootAstekoIrudia = function() {

    var self = this;

    var M = new Masto({
        access_token: this.kredentzialak_mastodon.access_token,
        api_url: this.kredentzialak_mastodon.api_url
    });

    euskalwikipedia.eskuratuAstekoIrudia().then(function(asteko_argazkia) {

        var image_request = require('request').defaults({ encoding: null });

        //https://stackoverflow.com/a/27006391/2855012
        var fitxategia = path.basename(url.parse(asteko_argazkia.irudiak.x2).pathname);

        self.deskargatu(asteko_argazkia.irudiak.x2, "./openshift/tmp/" + fitxategia).then(function() {

            M.post('media', { file: fs.createReadStream("./openshift/tmp/" + fitxategia) }).then(function(resp) {

                var id = resp.data.id;

                var mezua = asteko_argazkia.testua.substring(0, 280 - 65);

                // Testuari zati bat moztu badiogu...
                if (mezua.length < asteko_argazkia.testua.length) {

                    // Amaieran hiru puntu gehitu.
                    mezua = mezua + "...";

                }

                mezua = mezua + " " + asteko_argazkia.irudiak.x1 + " #AstekoIrudia";

                M.post('statuses', { status: mezua, media_ids: [id] }, function(err, data, response) {

                    if(err) {
                        console.log("There was a problem tooting the message.", err);
                    }

                    // Aldibaterako fitxategia ezabatu
                    fs.unlink("./openshift/tmp/" + fitxategia);
                });

            });
        });
    });
};

// https://stackoverflow.com/a/22907134/2855012
Wikidosia.prototype.deskargatu = function(url, dest) {

    var promise = new Promise(function(resolve, reject) {
        var file = fs.createWriteStream(dest);
        var request = https.get(url, function(response) {
            response.pipe(file);
            file.on('finish', function() {
                file.close();
                resolve();
            });
        }).on('error', function(err) { // Handle errors
            fs.unlink(dest); // Delete the file async. (But we don't check the result)
            console.log(err.message);
            reject(err);
        });
    });

    return promise;
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
