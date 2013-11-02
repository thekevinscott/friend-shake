var express = require("express");
var app = express();



app.use(express.logger());
app.use(express.bodyParser());


var mysql      = require('mysql');







app.get('/', function(request, response) {

	response.send('<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.8.0/jquery.min.js"></script>');
});


/*
* 	POST expects:
*
*	auth token -- facebook access token
*	uuid -- representing our phone
*	lat,lng -- geolocation
*	timestamp since epoch
*
*	Example: $.post('/',{auth_token: '123123123', uuid: '123123123123', lat: 10.12313, lng: 123.312313, timestamp: 1231321314213})
*/

var connection;

var createUser = function(uuid, callback) {
	//var dfd = Q.defer();
	connection.query('INSERT INTO users (uuid, created) VALUES ('+uuid+', NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)', function(err, rows, fields) {
		if (err) {
			console.log('err',err);
		} else {

			var user_id = rows.insertId;
			callback(user_id);
		}
	});
};

var createHandshake = function(user_id,lat,lng,timestamp,callback){
	connection.query('INSERT INTO shakes (user_id, lat, lng, timestamp, created) VALUES ('+user_id+','+lat+','+lng+','+timestamp+', NOW())', function(err, rows, fields) {
		if (err) {
			console.log('err',err);
		} else {
			callback(rows);
		}
	});
};

app.post('/', function(request, response) {
	connection = mysql.createConnection({
	  host     : 'us-cdbr-east-04.cleardb.com',
	  user     : 'b6204b17cbb96d',
	  password : '9a9cd260',
	  database : 'heroku_b378eaa431255a3'
	});
	connection.connect();

	var auth_token = connection.escape(request.body.auth_token);
	var uuid = connection.escape(request.body.uuid);
	var lat = connection.escape(request.body.lat);
	var lng = connection.escape(request.body.lng);
	var timestamp = connection.escape(request.body.timestamp);

	createUser(uuid, function(user_id){
		createHandshake(user_id,lat,lng,timestamp,function(rows){
			console.log('rows',rows);
			connection.end();
			response.send('Good job.');
		});
	});

});




var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);

});
