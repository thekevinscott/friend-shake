var express = require("express");
var app = express();
var https = require("https");
var querystring = require("querystring");
var util = require('util');
var exec = require('child_process').exec;

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

	response.send('What are you doing here? Go away.');
});
app.get('/jquery', function(request, response) {
          response.send('<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.8.0/jquery.min.js"></script>');
});
app.get('/meetings/*', function(request, response) {
	var uuid = connection.escape(request.params[0]);
	
	var meetings_query = "SELECT s.timestamp, u.username, u.fbid, u.uuid, u.firstname FROM (SELECT m.created as timestamp, m.user_b as target_user \
							FROM meetings m \
							LEFT JOIN users u ON u.id = m.user_a \
							WHERE u.uuid = "+uuid+" \
							) s LEFT JOIN users u ON u.id = s.target_user ";
console.log(meetings_query);
	query(meetings_query, function(rows){
		if (rows.length) {
			response.json({meetings : rows});
		} else {
			response.json({meetings : [], message: 'No meetings found.'});
		}
	});

});


var query = function(query,callback,error) {
console.log('query',query);

	connection.query(query, function(err, rows, fields) {
		if (err) {
			if (error) { error(err);}
			else { console.log('query',query); console.log('err',err); }
		} else {

			if (callback) { callback(rows); }
		}
	});
}


var createUser = function(params, callback, error_callback) {
	var query_string = 'INSERT INTO users (uuid, fbid, username, firstname, created) VALUES ('+params.uuid+', '+params.fbid+','+params.username+','+params.firstname+',NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id), uuid='+params.uuid+',fbid='+params.fbid+',username='+params.username;
	query(query_string,callback,error_callback);

};

var createHandshake = function(user_id,params,callback,error_callback){
	var create_handshake = 'INSERT INTO shakes (user_id, lat, lng, timestamp, created) VALUES ('+user_id+','+params.lat+','+params.lng+',FROM_UNIXTIME('+params.timestamp+'), NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';

	query(create_handshake,function(rows){

		params.timestamp_threshold /= 2;
		params.location_threshold /= 2;
		
		var lat = parseFloat(params.lat.replace(/'/g,''));
		var lng = parseFloat(params.lng.replace(/'/g,''));
		

		var grab_partner = '	SELECT shakes.*, u.fbid, u.username, u.firstname, \
								ABS(UNIX_TIMESTAMP(timestamp)-'+params.timestamp+') as timestamp_difference, \
								ABS(lat-'+params.lat+') as lat_distance, \
								ABS(lng-'+params.lng+') as lng_distance \
								FROM shakes \
								LEFT JOIN users u ON u.id = shakes.user_id \
								WHERE 1=1 \
									AND timestamp >= DATE_SUB(FROM_UNIXTIME('+params.timestamp+'),INTERVAL '+params.timestamp_threshold+' SECOND) \
									AND timestamp <= DATE_ADD(FROM_UNIXTIME('+params.timestamp+'),INTERVAL '+params.timestamp_threshold+' SECOND) \
									AND user_id != '+user_id+' ';
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
		query(grab_partner,callback,error_callback);
	},error_callback);
};

var createAccessToken = function(user_id,access_token,callback,error_callback){
	var query_string = 'INSERT INTO access_tokens (user_id, access_token, created) VALUES ('+user_id+','+access_token+', NOW()) ON DUPLICATE KEY UPDATE id= LAST_INSERT_ID(id)';
	query(query_string,callback,error_callback);
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
		params[require] = connection.escape(request.body[require]);
	}
	console.log("params",params);

	params.location_threshold = parseFloat(request.body.location_threshold || 0.0005);
	params.timestamp_threshold = parseFloat(request.body.timestamp_threshold || 10);

	createUser(params, function(rows){
		var user_id = rows.insertId;
		var username = params.username;
		createAccessToken(user_id,params.access_token,function(rows){
			createHandshake(user_id,params,function(rows){


				var pebble_response = {};

				if (rows.length) {
					console.log('rows were found, woot woot',rows);

					// have we already made a meet request?
					var meeting_query = "SELECT * FROM meetings \
										WHERE created > DATE_SUB(NOW(), INTERVAL 1 MINUTE) \
										AND user_a = "+user_id+" \
										AND user_b = "+rows[0]['user_id']+" ";

					query(meeting_query,function(meeting_rows){
						if (! meeting_rows.length) {
							console.log("**** go ahead and make the meeting: "+username.replace(/'/g,'')+" met "+rows[0]['username']+" ****");
							query("INSERT INTO meetings (user_a,user_b,created) VALUES ('"+user_id+"','"+rows[0]['user_id']+"',NOW()) ", function(m_rows){
								var meeting_id = m_rows.insertId;

								// no meet request has been made, proceed

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
									target_username : rows[0].username, // their username
									target_firstname : rows[0].firstname, // their firstname
									access_token : params.access_token, // my access token
									me : params.username, // me
									firstname : params.firstname,
									fbid : params.fbid
								},function(){
									// here we should check if we need to make a second query
									var second_meeting_query = "SELECT * FROM meetings \
														WHERE created > DATE_SUB(NOW(), INTERVAL 1 MINUTE) \
														AND user_b = "+user_id+" \
														AND user_a = "+rows[0]['user_id']+" ";
									query(second_meeting_query,function(second_meeting_rows) {
										if (! second_meeting_rows.length) {
											console.log("**** go ahead and make the meeting: "+rows[0]['username'] +" met "+username.replace(/'/g,'')+" ****");
											query("INSERT INTO meetings (user_a,user_b,created) VALUES ('"+user_id+"','"+rows[0]['user_id']+"',NOW()) ", function(m_rows){
												var meeting_id2 = m_rows.insertId;
												var access_token_query = 'SELECT a.access_token, u.username, u.firstname, u.fbid FROM access_tokens a \
																			LEFT JOIN users u ON u.id = a.user_id \
																			WHERE a.user_id = '+rows[0].user_id+' \
																			ORDER BY a.id DESC ';

												query(access_token_query,function(rows){
													console.log('rows',rows);
													if (rows.length) {

														makeMeetRequest({
															target_username : params.username, // their username
															target_firstname : params.firstname, // their first name
															access_token : rows[0].access_token, // my access token
															me : rows[0].username, // me
															firstname : rows[0].firstname,
															fbid : rows[0].fbid
														},function(){
															sendResponse();
														});
													} else {
														console.log('What the fuck is this, why are there no rows');
														console.log(access_token_query);
														//res.json({error: 'No rows found, what the fuck'});
													}

												});
											});
											
										} else {
											sendResponse();
										}
									});
								});
							});


/*
								*/
						} else {
							res.json({ message: 'A meeting has already happened between these users within the time threshold.' });
						}
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
