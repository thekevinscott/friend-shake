var express = require("express");
var app = express();
var https = require("https");
var querystring = require("querystring");
var util = require('util');
var exec = require('child_process').exec;
var q = require('q');


app.use(express.logger());
app.use(express.bodyParser());



var mysql      = require('mysql');
var db_config = {
	  host     : 'us-cdbr-east-04.cleardb.com',
	  user     : 'b6204b17cbb96d',
	  password : '9a9cd260',
	  database : 'heroku_b378eaa431255a3'
	};


var pool = {};





app.get('/', function(request, response) {
	response.send('What are you doing here? Go away.');
});
app.get('/jquery', function(request, response) {
    response.send('<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.8.0/jquery.min.js"></script>');
});



app.get('/meetings/*', function(request, response) {

	var uuid = request.params[0];

	var meetings_query = "SELECT s.timestamp, u.username, u.fbid, u.uuid, u.firstname FROM (SELECT m.created as timestamp, m.user_b as target_user \
							FROM meetings m \
							LEFT JOIN users u ON u.id = m.user_a \
							WHERE u.uuid = ? \
							) s LEFT JOIN users u ON u.id = s.target_user ";


	pool.query(meetings_query,[uuid]).then(function(rows){
		if (rows.length) {
			response.json({meetings : rows});
		} else {
			response.json({meetings : [], message: 'No meetings found.'});
		}
	});

});




var createUser = function(params, callback, error_callback) {


	var query_string = 'INSERT INTO users (uuid, fbid, username, firstname, created) \
						VALUES (?,?,?,?,NOW()) \
						ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id), uuid=?,fbid=?,username=?,firstname=?';
	params = [params.uuid,params.fbid,params.username,params.firstname,params.uuid,params.fbid,params.username,params.firstname];
	pool.query(query_string,params).then(callback).fin(error_callback);

};

var createHandshake = function(user_id,params,callback,error_callback){

	var handshake_params = [user_id,params.lat,params.lng,params.timestamp];



	var create_handshake = 'INSERT INTO shakes (user_id, lat, lng, timestamp, created) VALUES (?,?,?,FROM_UNIXTIME(?), NOW()) \
							ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';


	pool.query(create_handshake,handshake_params).then(function(rows){
		console.log('created handshake');
		params.timestamp_threshold /= 2;
		params.location_threshold /= 2;

		var partner_params = [	params.timestamp, params.lat, params.lng, user_id,
								params.timestamp, params.timestamp_threshold, params.timestamp, params.timestamp_threshold,
								user_id];

		var grab_partner = '	SELECT s.*, u.fbid, u.username, u.firstname, a.access_token, \
								ABS(UNIX_TIMESTAMP(timestamp)-?) as timestamp_difference, \
								ABS(lat-?) as lat_distance, \
								ABS(lng-?) as lng_distance \
								FROM shakes s \
								LEFT JOIN users u ON u.id = s.user_id \
								LEFT JOIN (SELECT * FROM access_tokens WHERE user_id = ? ORDER BY id DESC) a ON a.user_id = u.id \
								WHERE 1=1 \
									AND timestamp >= DATE_SUB(FROM_UNIXTIME(?),INTERVAL ? SECOND) \
									AND timestamp <= DATE_ADD(FROM_UNIXTIME(?),INTERVAL ? SECOND) \
									AND s.user_id != ? ';
/*
		var grab_partner = '	SELECT shakes.*, u.fbid, u.username, u.firstname, \
								ABS(UNIX_TIMESTAMP(timestamp)-'+params.timestamp+') as timestamp_difference, \
								ABS(lat-'+params.lat+') as lat_distance, \
								ABS(lng-'+params.lng+') as lng_distance \
								FROM shakes \
								LEFT JOIN users u ON u.id = shakes.user_id \
								WHERE 1=1 \
									AND timestamp >= DATE_SUB(FROM_UNIXTIME('+params.timestamp+'),INTERVAL '+params.timestamp_threshold+' SECOND) \
									AND timestamp <= DATE_ADD(FROM_UNIXTIME('+params.timestamp+'),INTERVAL '+params.timestamp_threshold+' SECOND) \
									AND lat >= '+(lat - params.location_threshold)+' \
									AND lat <= '+(lat + params.location_threshold)+' \
									AND lng >= '+(lng - params.location_threshold)+' \
									AND lng <= '+(lng + params.location_threshold)+' \
									AND user_id != '+user_id+' ';
									*/

		pool.query(grab_partner,partner_params).then(function(rows){
			callback(rows);
		}).fin(error_callback);
	}).fin(error_callback);


};

var createAccessToken = function(user_id,access_token,callback,error_callback){

	var query_string = 'INSERT INTO access_tokens (user_id, access_token, created) VALUES (?,?, NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';
	pool.query(query_string,[user_id,access_token]).then(callback).fin(error_callback);

};

var sendMeetRequest = function(row, callback) {
/*
curl -X POST https://graph.facebook.com/me/shakepebble:meet
-d profile=http%3A%2F%2Ffacebook.com/chrismaddern
-d access_token=ACCESS_TOKEN
*/
	console.log('row in meet request',row);
	var actor_id = row.fbid.replace(/'/g,'');
	row.target_username = row.target_username.replace(/'/g,'');
	row.access_token = row.access_token.replace(/'/g,'');
	row.target_firstname = row.target_firstname.replace(/'/g,'');
	row.firstname = row.firstname.replace(/'/g,'');

	var message = encodeURIComponent(row.firstname+' met <a href="/'+row.target_username+'">'+row.target_firstname+'</a>');
	//var message = row.firstname+'test';
	var post_data = querystring.stringify({
		  'message' : message,
	      'access_token': row.access_token,
          'explicitly_shared' : 'true'
	  });
	var options = {
	  host: 'graph.facebook.com',
	  port: 443,
	  path: actor_id+'/feed',
	  method: 'POST',
	  headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': post_data.length
      }
	};
	var body = '';
	console.log('post_data',post_data);
	console.log("options",options);
	console.log('CURL Request');
	/*
	var command = 'curl -X POST https://graph.facebook.com/'+actor_id+'/feed \
-d message='+message+' \
-d access_token='+row.access_token+' \
-d fb:explicitly_shared=true';
*/
/*
	var command = 'curl -X POST https://graph.facebook.com/me/shakepebble:meet \
-d profile=http%3A%2F%2Ffacebook.com/'+row.target_username+' \
-d access_token='+row.access_token+' \
-d fb:explicitly_shared=true';
*/
	var command = 'curl -X POST "https://graph.facebook.com/me/shakepebble:meet" \
  	-F profile=http://facebook.com/'+row.target_username+' \
  	-F "access_token='+row.access_token+'" \
  	-F "fb:explicitly_shared=true"';

	console.log(command);


/*
	var req = https.request(options, function(res) {
	  // console.log('STATUS: ' + res.statusCode);
	  // console.log('HEADERS: ' + JSON.stringify(res.headers));
	  res.setEncoding('utf8');
	  res.on('data', function (chunk) {
	    // console.log('BODY: ' + chunk);
	    body += chunk;
	    // req.close();
	  });
	  res.on('end',function () {
	  	// console.log('close');
	  	console.log('CURL RESPONSE');
	  	console.log(body);
	  	if (callback) { callback(body); }
	  });
	});

	req.on('error', function(e) {
	  console.log('problem with CURL request: ' + e.message);
	});

	// write data to request body
	req.write(post_data);
	req.end();
	*/

	child = exec(command, function(error, stdout, stderr){

		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);

		if(error !== null)
		{
		    console.log('exec error: ' + error);
		    callback(error);
		}

		if (callback) { callback(stdout); }
	});

}




app.post('/shakes/add', function(request, res) {

	var params = {};
	var required = ['access_token','uuid','fbid','username','firstname','lat','lng','timestamp'];

	for (var i in required) {
		var require = required[i];
		if (! request.body[require]) {
			res.json({error : "Missing field " + require});
			return;
		}
		params[require] = request.body[require];
	}

	console.log("params at the top",params);

	params.location_threshold = parseFloat(request.body.location_threshold || 0.0005);
	params.timestamp_threshold = parseFloat(request.body.timestamp_threshold || 10);


	createUser(params, function(rows){
		var user = {
			id: rows.insertId,
			username: params.username,
			firstname: params.firstname,
			fbid: params.fbid,
			access_token : params.access_token
		};
		console.log('user',user);

		createAccessToken(user.id,params.access_token,function(rows){
			console.log('access token good',rows);
			createHandshake(user.id,params,function(rows){


				if (rows.length) {
					console.log('rows were found, woot woot',rows);
					var row = rows[0];

					var friend = {
						id: row.user_id,
						username: row.username,
						firstname: row.firstname,
						fbid: row.fbid,
						access_token: row.access_token
					};

					var handshake = {
						timestamp: row.timestamp,
						lat: row.lat,
						lng: row.lng
					};
					console.log('friend',friend);
					console.log('handshake',handshake);

					handleMeetingRequest({
						user: user,
						friend: friend,
						handshake : handshake
					});


				} else {
					console.log("No other users were found");
					res.json({ message : 'User was successfully added. No other matching users were found', rows: rows });
				}
			},function(err){
				res.json({err : err});
			});
		},function(err){
			res.json({err : err});
		});
	},function(err){
		res.json({err : err});
	});

});






var handleMeetingRequest = function(params) {
	var pebble_response = {};
	var user = params.user;
	var friend = params.friend;
	var handshake = params.handshake;

	// have we already made a meet request?
	var minute_threshold = 1;
	var meeting_query = "SELECT * FROM meetings \
						WHERE created > DATE_SUB(NOW(), INTERVAL "+minute_threshold+" MINUTE) \
						AND user_a = ? AND user_b = ? ";
	pool.query(meeting_query,[user.id,friend.id]).then(function(meeting_rows){
		if (! meeting_rows.length) {
			console.log("**** go ahead and make the meeting: "+user.username+" met "+friend.username+" ****");

			var meeting_insert_params = [user.id, friend.id];
			var meeting_insert = "INSERT INTO meetings (user_a,user_b,created) VALUES (?,?,NOW()) ";
			pool.query(meeting_insert,meeting_insert_params).then(function(m_rows){
				var meeting_id = m_rows.insertId;

				var sendResponse = function() {
					res.json({ rows: rows, pebble_response : pebble_response});
				}


				var makeMeetRequest = function(params,callback) {
					console.log('params for meet request', params);
					sendMeetRequest(params,function(data){
						pebble_response[params.me.replace(/'/g,'')] = data;
						//console.log("do callback");
						callback();
					});
				}

				console.log('params at the top',params);

				makeMeetRequest({
					target_username : friend.username, // their username
					target_firstname : friend.firstname, // their firstname
					access_token : user.access_token, // my access token
					me : user.username, // me
					firstname : user.firstname, // my firstname
					fbid : user.fbid // my fbid
				},function(){
					// here we should check if we need to make a second query
					var second_meeting_params = [friend.id,user.id];
					var second_meeting_query = "SELECT * FROM meetings \
										WHERE created > DATE_SUB(NOW(), INTERVAL 1 MINUTE) \
										AND user_a = ? \
										AND user_b = ? ";
					pool.query(second_meeting_query,second_meeting_params).then(function(second_meeting_rows){
						if (! second_meeting_rows.length) {
							console.log("**** go ahead and make the meeting: "+friend.username +" met "+user.username+" ****");
							var meeting_insert_params = [friend.id,user.id];
							var meeting_insert = "INSERT INTO meetings (user_a,user_b,created) VALUES (?,?,NOW()) ";
							pool.query(meeting_insert,meeting_insert_params).then(function(m_rows){

								makeMeetRequest({
									target_username : user.username, // their username
									target_firstname : user.firstname, // their first name
									access_token : friend.access_token, // my access token
									me : friend.username, // me
									firstname : friend.firstname, // my firstname
									fbid : friend.fbid // my fbid
								},function(){
									sendResponse();
								});

							});
						} else {
							// no meeting needed, it already exists
							sendResponse();
						}
					});

				});
			});

		} else {
			res.json({ message: 'A meeting has already happened between these users within the time threshold.' });
		}


	}).fin(function(error){
		console.log('there was an unknown error',err);
		res.json({ err: err });
	});
};

// delete the below two methods
// only for testing purposes
/*
app.get('/shakes', function(request, res) {
	var query_string = 'SELECT u.uuid, s.lat, s.lng, s.timestamp, a.access_token FROM shakes s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN access_tokens a ON a.user_id = u.id ';
	query(query_string,function(rows){
		var users = {};
		for (var i=0;i<rows.length;i++) {
			var row = rows[i];
			var uuid = row['uuid'];
			var access_token = row['access_token'];
			if (! users[uuid]) { users[uuid] = [];}
			//if (! users[uuid][access_token]) { users[uuid][access_token] = [];}

			//users[uuid][access_token].push({lat : row.lat, lng : row.lng, timestamp : row.timestamp});
			users[uuid].push({lat : row.lat, lng : row.lng, timestamp : row.timestamp, access_token : access_token});
		}
		res.json({users : users});
	});

});

// send a meet request
app.get('/meet',function(request,res){
	sendMeetRequest({
		target_username : 'testman.johnson.5',
		access_token : 'CAAFfoHPA48oBANKyLiZBVFTalBYr09sNQC5B2oxlas3jKlV6ZC5svPtZBkm53JIMp0zgqN5U0qBg0fdPAmdX3faVAFTZBHyXokwmye2UTfD0EeiPUWfPj6ujmAUZA8ZAZAblwJICndGCFXxX7KEhpkBCCiIRWYZB8kDWQTY6HsgPw8FwHh3YS7MLGfhXJSl0V5ZBbedjStMAiHAZDZD'
	},function(data){
		res.write(data);
		res.end();
	});
});
*/










var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);

});









pool = function() {
	var connection;
	function handleDisconnect() {
	  connection = mysql.createConnection(db_config); // Recreate the connection, since
	                                                  // the old one cannot be reused.

	  connection.connect(function(err) {              // The server is either down
	    if(err) {                                     // or restarting (takes a while sometimes).
	      console.log('error when connecting to db:', err);
	      connection = null;
	      setTimeout(handleDisconnect, 500); // We introduce a delay before attempting to reconnect,
	    }                                     // to avoid a hot loop, and to allow our node script to
	  });                                     // process asynchronous requests in the meantime.
	                                          // If you're also serving http, display a 503 error.
	  connection.on('error', function(err) {

	    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
	      connection = null;
	      handleDisconnect();                         // lost due to either server restart, or a
	    } else {                                      // connnection idle timeout (the wait_timeout
	      console.log('db error', err);
	      throw err;                                  // server variable configures this)
	    }
	  });
	}



	var getConnection = function(deferred) {
		if (! deferred) { var deferred = q.defer(); }
		if (connection) {
			deferred.resolve(connection);
		} else {
			setTimeout(function(){
				getConnection(deferred);
			},500);
		}
		return deferred.promise;
	}


	handleDisconnect();



	var query = function(query,params) {
		var deferred = q.defer();
		getConnection().then(function(conn){
			console.log('here comes a query',query);
			conn.query(query, params, function(err, rows, fields) {
				if (err) {
					deferred.reject(err);
					console.log('Query Error',query); console.log('err',err);
				} else {
					deferred.resolve(rows);
				}
			});
		});
		return deferred.promise;
	}

	return {
		getConnection : getConnection,
		query : query
	};
}();






// testing
/*
var timestamp = Math.floor((+new Date())/1000);
$.post(
	'/shakes/add',
	{
		access_token: '386617718137802|ohH-pn_BhWG3yoXTVUHZOF8N2RY',
		fbid: 100003810453895,
		username: 'testman.johnson.5',
		uuid: '2',
		lat: 10.12343,
		lng: 123.312313,
		timestamp: timestamp,
		timestamp_threshold: 1
	},
	function(data){console.log(data);}
);
setTimeout(function(){
	console.log('go second');
	var xhr = $.post(
		'/shakes/add',
		{
			access_token: 'CAAFfoHPA48oBANKyLiZBVFTalBYr09sNQC5B2oxlas3jKlV6ZC5svPtZBkm53JIMp0zgqN5U0qBg0fdPAmdX3faVAFTZBHyXokwmye2UTfD0EeiPUWfPj6ujmAUZA8ZAZAblwJICndGCFXxX7KEhpkBCCiIRWYZB8kDWQTY6HsgPw8FwHh3YS7MLGfhXJSl0V5ZBbedjStMAiHAZDZD',
			fbid: 1380180326,
			username: 'zakin',
			uuid: '1',
			lat: 10.12343,
			lng: 123.312313,
			timestamp: timestamp,
			timestamp_threshold: 1
		},
		function(data){console.log(data);}
	);
	console.log(xhr);

},1400);

		//
*/
