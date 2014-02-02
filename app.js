var version = '0.0.1.2014.01.18';
//Global variables
var conf = {
	x_max : 1000,
	x_off : 10,
	y_max : 800,
	y_off : 10,
	enemies_num : 6,
	enemies_interval : 100
};

/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);
// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//app.get('/', routes.index);
//app.get('/users', user.list);
app.get('/admin', function(req, res) {
	res.render('admin',{
		js: 'admin',
		title:'Administration',
		units:units,
		conf:conf
	});
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

//MAIN

for (var i = conf.enemies_num; i >= 0; i--) {
	var enemy = {
		id:id_count++,
		img:images_enemies[rand(images_enemies.length)],
		radio:rand(20)+10,
		x:rand(conf.x_max)+conf.x_off,
		y:rand(conf.y_max)+conf.y_off,
		speed:rand(10)+5
	};
	enemies[enemy.id] = enemy;
	units[enemy.id] = enemy;
};

var game = io.of('/game').on('connection', function (socket) {
	console.log('Client connected');
	var player = {
		id:id_count++,
		img:images_player[rand(images_player.length)],
		radio:rand(30)+20,
		x:rand(conf.x_max)+conf.x_off,
		y:rand(conf.y_max)+conf.y_off
	};
	socket.emit('game_init', player);
	units[player.id] = player;
	//game.emit('units', units);
	socket.on('player_update', function (data) {
		console.log(data);
		try{
			units[data.id].x = data.x;
			units[data.id].y = data.y;
			io.sockets.emit('units',units);
		}catch(e){
			console.log(e);
		}
	});
	socket.on('disconnect', function(){
		delete units[player.id];
		io.sockets.emit('units',units);
	});
});

var admin = io.of('/admin').on('connection', function (socket) {
	socket.on('lag', function(data,fn){
		fn();
	});
});

function rand(num){
	return Math.floor(Math.random()*num);
}

function move_units(){
	for (var i in enemies) {
		enemies[i].x = enemies[i].x>conf.x_max?0:enemies[i].x + enemies[i].speed;
	};
	game.emit('units',units);
}
setInterval(move_units,conf.enemies_interval);
