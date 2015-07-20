var request = require("request");

var emaitza = {
    pageid: undefined,
    title: "",
    extract: ""
};

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

                    console.log(emaitza);
                    
                }

            });
        }
    }

});

/*
$.getJSON("http://en.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts&explaintext&exintro=&format=json&callback=?", function (data) {
        $.getJSON('http://en.wikipedia.org/w/api.php?action=query&prop=info&pageids='+v.pageid+'&inprop=url&format=json&callback=?', function(url) {
    $.each(data.query.pages, function(k, v) {
            $.each(url.query.pages, function(key, page) {
                console.log(page); // contains the page data
                var url = page.fullurl; // the url to the page
            });
        });
    });
});
*/
