var params = {};
var status_number = 0;
var pancakes = [];
var n_found_cinemas = 0;
var n_built_cinemas = 0;
var saved_market_data = null;
var saved_cinema_data = {};
var spiner_opts = {
    lines: 13, // The number of lines to draw
    length: 20, // The length of each line
    width: 10, // The line thickness
    radius: 30, // The radius of the inner circle
    corners: 1, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#FFF', // #rgb or #rrggbb or array of colors
    speed: 1, // Rounds per second
    trail: 60, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '50%', // Top position relative to parent
    left: '50%' // Left position relative to parent
};
var spinner = new Spinner(spiner_opts);

(window.onpopstate = function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);
    while (match = search.exec(query))
       params[decode(match[1])] = decode(match[2]);
})();

function init_query() {
    overrides = [];
    use_overrides = false;
    if("q" in params) {
        query = params["q"];
        if(!$("#q").val()) {
            $("#q").val(params["q"]);
        }
    }
    overrides = $("#q").val().split(/[\s,]+/);
    use_overrides = overrides.length && overrides[0].length;
}

function clear_data() {
    init_query();
    $("#main").empty();
    $("#statuses").empty();
    spinner.spin(document.getElementById('spin'));
    pancakes = [];
    n_found_cinemas = 0;
    n_built_cinemas = 0;
    status_number = 0;
}

function capwords(text) {
    return text.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function pad(num, size) {
    var s = num + "";
    while (s.length < size)
        s = "0" + s;
    return s;
}

function daystr() {
    var today = new Date();
    var dd = pad(today.getDate(), 2);
    var mm = pad(today.getMonth() + 1, 2);
    var yyyy = today.getFullYear();
    return yyyy + mm + dd;
}

function status(text) {
    window.status_number++;
    var li = document.createElement('li');
    li.className = "status_item";
    li.id = "status_" + window.status_number;
    li.innerHTML = text;
    $("#statuses").append(li);
    return window.status_number;
}

function status_update(text, number) {
    $("#status_" + number).html(text);
}

function show_pancake(pancake) {
    window.pancakes.push(pancake);
    var template = _.template($("script.template").html());
    $("#main").html(template(window.pancakes));
    $("h1").fitText(1.5);
    $("h2").fitText(3)
}

function matches_override(title) {
    for(var o = 0; o < overrides.length; o++) {
        var re = new RegExp(overrides[o], 'i');
        if(title.match(re)) {
            return true;
        }
    }
    return false;
}

function parse_cinema(data) {
    var status_message = "Parsing " + data.Cinema.CinemaName + " Data...";
    var status_id = status(status_message);
    for(var i = 0; i < data.Cinema.Dates.length; i++) {
        var date_data = data.Cinema.Dates[i];
        for(var j = 0; j < date_data.Films.length; j++) {
            var film_data = date_data.Films[j];
            var is_pancake = (film_data.Film.match(/pancake/i));
            var is_override = matches_override(film_data.Film);
            if((!use_overrides && !is_pancake) || (use_overrides && !is_override)) {
                continue; // DO NOT WANT!
            }
            for(var k = 0; k < film_data.Sessions.length; k++) {
                var session_data = film_data.Sessions[k];
                pancake = {
                    film: capwords(film_data.Film.replace("Master Pancake: ", "").toLowerCase())
                    , film_uid: film_data.FilmId
                    , cinema: data.Cinema.CinemaName
                    , cinema_url: data.Cinema.CinemaURL
                    , date: date_data.Date
                    , time: session_data.SessionTime
                    , status: session_data.SessionStatus
                    , url: session_data.SessionStatus == "onsale" ? session_data.SessionSalesURL : null
                };
                show_pancake(pancake);
            }
        }
    }
    status_update(status_message + " done.", status_id);
}

function build_cinema(cinema) {
    var status_message = "Fetching " + cinema.CinemaName + " Data...";
    var status_id = status(status_message);
    var finish = function() {
        status_update(status_message + " done.", status_id);
        n_built_cinemas = n_built_cinemas + 1;
        if(n_built_cinemas == n_found_cinemas) {
            spinner.stop();
        }
    }
    if(!(cinema.CinemaName in saved_cinema_data)) {
        $.when($.ajax({
            url: "https://d20ghz5p5t1zsc.cloudfront.net/adcshowtimeJson/CinemaSessions.aspx"
            , dataType: "jsonp"
            , jsonp: "callback"
            , data: {
                cinemaid: pad(cinema.CinemaId, 4)
            }
            , success: parse_cinema
        })).then(function(data, textStatus, jqXHR) {
            saved_cinema_data[cinema.CinemaName] = data;
            finish();
        });
    } else {
        parse_cinema(saved_cinema_data[cinema.CinemaName]);
        finish();
    }
}

function build_cinemas(cinemas) {
    var status_message = "Parsing Cinemas Data...";
    var status_id = status(status_message);
    for(var i = 0; i < cinemas.length; i++) {
        var cinema = cinemas[i];
        build_cinema(cinema);
    }
    status_update(status_message + " done.", status_id);
}

function parse_market(data) {
    var status_message = "Parsing Market Data...";
    var status_id = status(status_message);
    var cinemas = [];
    for(var i = 0; i < data.Market.Cinemas.length; i++) {
        var cinema = data.Market.Cinemas[i];
        if(cinema.CinemaId == '0090') {
            continue;
        }
        var item = {
            CinemaId: cinema.CinemaId
            , CinemaName: cinema.CinemaName
            , CinemaURL: cinema.CinemaURL
        };
        cinemas.push(item);
    }
    n_found_cinemas = cinemas.length;
    status_update(status_message + " done.", status_id);
    build_cinemas(cinemas);
}

function build_market() {
    clear_data();
    var status_message = "Fetching Market Data...";
    var status_id = status(status_message);
    var finish = function() {
        status_update(status_message + " done.", status_id);
    }
    if(saved_market_data == null) {
        $.when($.ajax({
            url: "https://d20ghz5p5t1zsc.cloudfront.net/adcshowtimeJson/marketsessions.aspx"
            , dataType: "jsonp"
            , jsonp: "callback"
            , data: {
                date: daystr()
                , marketid: pad(0, 4)
            }
            , success: parse_market
        })).then(function(data, textStatus, jqXHR) {
            saved_market_data = data;
            finish();
        });
    } else {
        parse_market(saved_market_data);
        finish();
    }
}

function by_location(pancakes) {
    return _.groupBy(pancakes, function(pancake) {
        return [pancake.film, pancake.cinema];
    });
}

function pancake_time(pancake) {
    var span = document.createElement('span');
    span.className = pancake.status;
    if(pancake.status == "onsale") {
        var a = document.createElement('a');
        a.href = pancake.url;
        a.innerHTML = pancake.time;
        span.innerHTML = a.outerHTML;
    } else {
        span.innerHTML = pancake.time;
    }
    return span.outerHTML;
}

function pancake_times(pancakes) {
    return pancakes.map(function(pancake) {
        return pancake_time(pancake);
    });
}

_.templateSettings.variable = "rc";