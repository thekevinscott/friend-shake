var express = require("express");
var app = express();



app.use(express.logger());
app.use(express.bodyParser());


var mysql      = require('mysql');
var db_config = {
	  host     : 'us-cdbr-east-04.cleardb.com',
	  user     : 'b6204b17cbb96d',
	  password : '9a9cd260',
	  database : 'heroku_b378eaa431255a3'
	};

var connection = mysql.createConnection(db_config);





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

var createHandshake = function(user_id,lat,lng,timestamp,location_threshold,timestamp_threshold,callback){
	var create_handshake = 'INSERT INTO shakes (user_id, lat, lng, timestamp, created) VALUES ('+user_id+','+lat+','+lng+',FROM_UNIXTIME('+timestamp+'), NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';
	query(create_handshake,function(rows){

		var grab_partner = '	SELECT *, \
								ABS(UNIX_TIMESTAMP(timestamp)-'+timestamp+'), ABS(lat-'+lat+'), ABS(lng-'+lng+') \
								FROM shakes WHERE 1=1 \
									AND timestamp >= DATE_SUB(FROM_UNIXTIME('+timestamp+'),INTERVAL '+timestamp_threshold+' SECOND) \
									AND timestamp <= DATE_ADD(FROM_UNIXTIME('+timestamp+'),INTERVAL '+timestamp_threshold+' SECOND) \
									AND lat >= '+lat+'-'+location_threshold+' \
									AND lat <= '+lat+'+'+location_threshold+' \
									AND lng >= '+lng+'-'+location_threshold+' \
									AND lng <= '+lng+'+'+location_threshold+' \
									AND user_id != '+user_id+' \
							';
		query(grab_partner,callback);
	});
};

var createAccessToken = function(user_id,access_token,callback){
	var query_string = 'INSERT INTO access_tokens (user_id, access_token, created) VALUES ('+user_id+','+access_token+', NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';
	query(query_string,callback);
};
app.post('/shakes/add', function(request, res) {



	var access_token = connection.escape(request.body.access_token);
	var uuid = connection.escape(request.body.uuid);
	var lat = connection.escape(request.body.lat);
	var lng = connection.escape(request.body.lng);
	var timestamp = connection.escape(request.body.timestamp);

	var location_threshold = connection.escape(request.body.location_threshold || 0.0005);
	var timestamp_threshold = connection.escape(request.body.timestamp_threshold || 20);

	createUser(uuid, function(rows){
		var user_id = rows.insertId;
		createAccessToken(user_id,access_token,function(rows){
			createHandshake(user_id,lat,lng,timestamp,location_threshold,timestamp_threshold,function(rows){
				console.log('rows',rows);
				res.json({ rows: rows })
			});
		});
	});

});




var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);

});





function handleDisconnect() {
  connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

handleDisconnect();