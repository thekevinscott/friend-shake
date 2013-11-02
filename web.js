var express = require("express");
var app = express();



app.use(express.logger());
app.use(express.bodyParser());


var mysql      = require('mysql');

var connection = mysql.createConnection({
	  host     : 'us-cdbr-east-04.cleardb.com',
	  user     : 'b6204b17cbb96d',
	  password : '9a9cd260',
	  database : 'heroku_b378eaa431255a3'
	});





app.get('/', function(request, response) {

	response.send('What are you doing here');
});

app.get('/jquery', function(request, response) {

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

var query = function(query,callback,error) {
	console.log('query',query);
	connection.query(query, function(err, rows, fields) {
		if (err) {
			if (error) { error(err);}
			else { console.log('err',err); }
		} else {

			callback(rows);
		}
	});
}

var createUser = function(uuid, callback) {
	var query_string = 'INSERT INTO users (uuid, created) VALUES ('+uuid+', NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';
	query(query_string,callback);

};

var createHandshake = function(user_id,lat,lng,timestamp,callback){
	var query_string = 'INSERT INTO shakes (user_id, lat, lng, timestamp, created) VALUES ('+user_id+','+lat+','+lng+',FROM_UNIXTIME('+timestamp+'), NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';
	query(query_string,callback);
};

var createAccessToken = function(user_id,access_token,callback){
	var query_string = 'INSERT INTO access_tokens (user_id, access_token, created) VALUES ('+user_id+','+access_token+', NOW())';
	query(query_string,callback);
};
app.post('/shakes/add', function(request, response) {



	var access_token = connection.escape(request.body.access_token);
	var uuid = connection.escape(request.body.uuid);
	var lat = connection.escape(request.body.lat);
	var lng = connection.escape(request.body.lng);
	var timestamp = connection.escape(request.body.time);

	createUser(uuid, function(rows){
		var user_id = rows.insertId;
		createAccessToken(user_id,access_token,function(rows){
			createHandshake(user_id,lat,lng,timestamp,function(rows){
				console.log('rows',rows);
				response.send('Good job.');
			});
		});
	});

});




var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);

});
