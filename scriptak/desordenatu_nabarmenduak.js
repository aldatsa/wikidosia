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

var fs = require('fs');

var fitxategia = "openshift/nabarmenduak.json";
var fitxategia_desordenatuta = "openshift/nabarmenduak-desordenatuta.json";

/*
 * Array bat jaso eta desordenatuta itzultzen du.
 */
function desordenatuArraya(array) {

    // Fisher-Yates
    // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

fs.readFile(fitxategia, function (err, content) {

    var nabarmenduak = JSON.parse(content);

    // Array-a ausaz ordenatu.
    var emaitza = desordenatuArraya(nabarmenduak);

    fs.writeFile(fitxategia_desordenatuta, JSON.stringify(emaitza, null, 4), function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log("JSON fitxategia behar bezala gorde da: " + fitxategia_desordenatuta);
        }
    });

});
