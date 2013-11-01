var express = require("express");
var app = express();
app.use(express.logger());

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'us-cdbr-east-04.cleardb.com',
  user     : 'b6204b17cbb96d',
  password : '9a9cd260',
  database : 'heroku_b378eaa431255a3'
});

connection.connect();

connection.query('INSERT INTO users (fbid, created) VALUES ("123", NOW())', function(err, rows, fields) {
  if (err) throw err;

  console.log(rows);
});

connection.end();

app.get('/', function(request, response) {
    response.send('Hello World!');
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);

});
