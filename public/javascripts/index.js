//CONFIG
var canvas = $("#canvas");
var interface = $('#interface');
var ctx = canvas[0].getContext("2d");
var ctx_if = interface[0].getContext("2d");
var conf = {
	frame_delay: 30,
	handle: {},
	time: 0,
	friction: 0.1,
	color_background: '#9E501C',
	color_tank: '#606060',
	mouse: {x:0,y:0},
	log: {},
	id_count: 0,
	redraw_interface: true,
	mouse_m: 0,
	lag:0,
	game_paused: true
}
//Data
var player_data = {
	lvl: 1,
	speed_max: 6,
	acceleration: 10,
	angle: 0,
	delta_angle: 5,
	img: '',
	turret: {delta_angle: Math.PI/60},
	hp : {max:100,regen:0,delay:0},
	shield : {max:10,regen:2/1000,delay:5000},
	heat : {current:0,max:100,regen:1,delay:20},
	shot : {delay:400,time:-1,dmg:{armor:5,shield:5}},
	is_player : true,
	keys : {
		87: 'forward',	//W
		65: 'left',		//A
		83: 'backwards',//S
		68: 'right',	//D
		80: 'pause'
	}
};
var map = {
	conf:{
		x0:0,y0:0,
		x1:-10000,y1:10000,
		buildings:500
	},
	buildings:[],
	waves:[]
};
var player = {};
var units = [];
var shots = [];

//Images
var images_src_tanks = [[0,'images/tank01.svg'],
						[1,'images/tank02.svg']];
var images_src_turrets = [[0,'images/turret01.svg']];
var images_tanks = {};
var images_turrets = {};
for (var i in images_src_tanks) {
	images_tanks[images_src_tanks[i][0]] = new Image();
	images_tanks[images_src_tanks[i][0]].src = images_src_tanks[i][1];
};
for (var i in images_src_turrets) {
	images_turrets[images_src_turrets[i][0]] = new Image();
	images_turrets[images_src_turrets[i][0]].src = images_src_turrets[i][1];
};

//SERVER CONF
var socket = null;
if (typeof io !== 'undefined'){
	socket = io.connect(location.origin+'/game');
	socket.on('connect', function () {
		console.log('Connected to server');
	});
	socket.on('game_init', function (data) {
		console.log('Game data received');
		//TODO
		conf.handle = setInterval(controller, conf.frame_delay);
	});
	socket.on('disconnect', function(){
		console.log('Disconnected from server. Trying to reconnect.');
		clearInterval(conf.handle);
	});
	socket.on('units', function (data) {
		//data.img = tokenGoblin;
		units = {};
		units = data;
		units[id].x = arcx;
		units[id].y = arcy;
		//console.log(units);
	});
}
//Model
function tank(data){
	this.id = conf.id_count++;
	this.img = data.img||images_tanks[1];
	this.x = data.x||rand(map.conf.x1-map.conf.x0,map.conf.x0);
	this.y = data.y||rand(map.conf.y1-map.conf.y0,map.conf.y0);
	this.width = data.width||data.lvl+30;
	this.height = data.height||this.img.height/(this.img.width/this.width);
	this.radius = data.radius||Math.sqrt(Math.pow(this.width/2,2)+Math.pow(this.height/2,2));
	this.speed = 0;
	this.speed_max = data.speed_max||rand(8,2);
	this.acceleration = data.acceleration||rand(2,4);
	this.movement = {forward:0,backwards:0,left:0,right:0}
	this.angle = data.angle||0;
	this.delta_angle = data.delta_angle||Math.PI/rand(100,10);
	this.turret = {
		angle:			data.turret&&data.turret.angle||0,
		delta_angle:	data.turret&&data.turret.delta_angle||Math.PI/rand(100,10),
		img:			data.turret&&data.turret.img||images_turrets[0]
	};
	this.turret.width = data.turret&&data.turret.width||data.lvl+20;
	this.turret.height = data.turret&&data.turret.height||this.turret.img.height/(this.turret.img.width/this.turret.width);
	this.hp = {
		max:	data.hp&&data.hp.max||data.lvl*5+rand(20,10),
		regen:	data.hp&&data.hp.regen||0,
		delay:	data.hp&&data.hp.delay||rand(50,10)
	};
	this.hp.current = this.hp.max;
	this.shield = {
		max:	data.shield&&data.shield.max||data.lvl*2+rand(8,5),
		regen:	data.shield&&data.shield.regen||data.lvl/1000,
		delay:	data.shield&&data.shield.delay||Math.max(10000-data.lvl*10,1000),
		time:	0
	};
	this.shield.current = this.shield.max;
	this.heat = {
		max:	data.heat&&data.heat.max||1000,
		regen:	data.heat&&data.heat.regen||20,
		delay:	data.heat&&data.heat.delay||1
	};
	this.heat.current = 0;
	this.shot = {
		delay:	data.shot&&data.shot.delay||rand(200,900)-10*data.lvl,
		time:	data.shot&&data.shot.time||0,
		dmg:	{armor: data.shot&&data.shot.dmg&&data.shot.dmg.armor||1+data.lvl/3,
				shield: data.shot&&data.shot.dmg&&data.shot.dmg.shield||1+data.lvl/3}
	};
	this.shot.radius = data.shot&&data.shot.radius||(this.shot.dmg+1);
	this.is_player = data.is_player||false;
	if(data.is_player){
		this.keys = data.keys;
	} else {
		this.ia = {
			movement_type: rand(2)
		}
		this.ia.movement_data = rand(2);
		this.runIa = function(){
			if (this.ia.movement_type == 0){
				this.movement.forward = 1;
				this.movement.left = this.ia.movement_data==0?1:0;
				this.movement.right = this.ia.movement_data==1?1:0;
			} else if (this.ia.movement_type == 1){
				this.movement.forward = 1;
				var ang = Math.atan2(player.y-this.y,player.x-this.x)-this.angle;
				ang = (ang+3*Math.PI)%(2*Math.PI)-Math.PI;
				this.movement.left = ang<-Math.PI/8?1:0;
				this.movement.right = ang>Math.PI/8?1:0;
			}
		}
	}
	this.move = function(time){
		this.speed += (this.movement.forward-this.movement.backwards)*this.acceleration*time/1000;
		this.speed = (this.speed>=0?1:-1)*Math.min(Math.max(Math.abs(this.speed)-conf.friction,0),this.speed_max);
		var delta_angle = (this.movement.right-this.movement.left)*this.acceleration/5*time/1000;
		this.angle += delta_angle;
		this.x += this.speed*Math.cos(this.angle);
		this.y += this.speed*Math.sin(this.angle);
		this.turret.angle += delta_angle;
		this.rotateTurret(time);
		this.shoot(time);
		this.regen(time);
	};
	this.rotateTurret = function(){
		this.turret.angle = (this.turret.angle+Math.PI)%(2*Math.PI)-Math.PI;
		var ang = this.is_player?	Math.atan2(conf.mouse.y-canvas.height()/2,conf.mouse.x-canvas.width()/2)-this.turret.angle:
									Math.atan2(player.y-this.y,player.x-this.x)-this.turret.angle;
		this.turret.angle += Math.max(Math.min((ang+3*Math.PI)%(2*Math.PI)-Math.PI,this.turret.delta_angle),-this.turret.delta_angle);
	};
	this.regen = function(time){
		this.shield.time += time;
		if(this.shield.time > this.shield.delay){
			this.shield.current = Math.min(this.shield.current+this.shield.regen*time,this.shield.max);
			if(this.is_player){
				conf.redraw_interface = true;
			}
		}
	}
	this.shoot = function(time){
		if(this.shot.time>=0){
			this.shot.time += time;
			if (this.shot.time >= this.shot.delay){
				shots.push(new shot({x:this.x,y:this.y,deltaX:Math.cos(this.turret.angle)*10,deltaY:Math.sin(this.turret.angle)*10,owner:this.id,dmg:this.shot.dmg}));
				this.shot.time -= this.shot.delay;
				log('Shots',shots.length);
			}
		}
	};
	this.hit = function (shot){
		if (this.shield.current>0){
			this.shield.current = Math.max(this.shield.current-shot.dmg.shield,0);
			this.shield.time = 0;
		} else {
			this.hp.current -= shot.dmg.armor;
		}
		if(this.hp.current <= 0){
			units.splice(units.indexOf(this), 1);
			log('Tanks',units.length);
			if(this.is_player){
				pause_toggle();//GAME OVER
			}
		}
		if(this.is_player){
			conf.redraw_interface = true;
		}
		shot.remove();
	}
};
function shot(data){
	this.id = conf.id_count++;
	this.x = data.x;
	this.y = data.y;
	this.deltaX = data.deltaX;
	this.deltaY = data.deltaY;
	this.time = 4000;
	this.dmg = data.dmg||{armor:1,shield:1};
	this.owner = data.owner;
	this.radius = data.radius||(this.dmg.armor+5)/3;
	this.move = function (time){
		this.x += this.deltaX;
		this.y += this.deltaY;
		this.time -= time;
		if(this.time <= 0){
			shots.splice(shots.indexOf(this),1);
		} else {
			for (var i = units.length - 1; i >= 0; i--) {
				if(units[i].id!=this.owner&&Math.sqrt(Math.pow(this.x-units[i].x,2)+Math.pow(this.y-units[i].y,2))<=units[i].radius){
					units[i].hit(this);
				}
			}
			for (var i = map.buildings.length - 1; i >= 0; i--) {
				if(this.x>map.buildings[i].x&&this.x<map.buildings[i].x1&&
					this.y>map.buildings[i].y&&this.y<map.buildings[i].y1){
					map.buildings[i].hit(this);
				}
			}
		}
	}
	this.remove = function(){
		shots.splice(shots.indexOf(this), 1);
		log('Shots',shots.length);
	}
};
function building(data){
	this.x = data.x||rand(map.conf.x1-map.conf.x0,map.conf.x0);
	this.y = data.y||rand(map.conf.y1-map.conf.y0,map.conf.y0);
	this.width = data.width||rand(300,100);
	this.height = data.height||rand(300,100);
	this.x1 = this.x+this.width;
	this.y1 = this.y+this.height;
	this.hit = function(shot){
		shot.remove();
	}
}
var keys = {
	'forward': function(val){movement('forward',val)},	//W
	'left': function(val){movement('left',val)},		//A
	'backwards': function(val){movement('backwards',val)},//S
	'right': function(val){movement('right',val)},	//D
	'pause': function(val){pause_toggle(val)}
}
//Controller
function init(){
	conf.time = new Date().getTime();
	player = new tank(player_data);
	units.push(player);
	for (var i = 0; i < 5; i++) {
		createTanks(70,i);
	};
	createTanks(4,50);
	for (var i = 0; i < map.conf.buildings; i++) {
		map.buildings.push(new building({}));
	};
	//Listeners
	$(window).keydown(function(e){keyPressed(e.keyCode,1)});
	$(window).keyup(function(e){keyPressed(e.keyCode,0)});
	$(window).resize(resizeCanvas);
	$('#interface').mousedown(mouseDown);
	$('#interface').mouseup(mouseUp);
	$('#interface').mousemove(mouseMove);
	resizeCanvas();
	draw();
	pause_toggle();
	log('Tanks',units.length);
};
setTimeout(init,500);
function mouseDown (e) {
	player.shot.time = 0;
};
function mouseUp (e) {
	player.shot.time = -1;
};
function mouseMove (e) {
	conf.mouse = {x:e.pageX, y:e.pageY};
	player.angle_m 
	log('Mouse',e.pageX+','+e.pageY+' '+conf.mouse_m++);
};
function keyPressed(key,value) {
	log('Key',key);
	if(key){
		keys[player.keys[key]](value);
	}
};
function movement(mov,val){
	player.movement[mov] = val;
}
function resizeCanvas(){
	canvas[0].width = window.innerWidth;
	canvas[0].height = window.innerHeight;
	interface[0].width = window.innerWidth;
	interface[0].height = window.innerHeight;
	conf.redraw_interface = true;
	draw();
};
function createTanks(num,lvl){
	for (var i = 0; i < num; i++) {
		units.push(new tank({lvl:lvl}));
	};
}
function pause_toggle(val){
	if(val == 0){
		return;
	}
	if(conf.game_paused){
		conf.time = new Date().getTime();
		conf.handle = setInterval(controller, conf.frame_delay);
	} else {
		clearInterval(conf.handle);
	}
	conf.game_paused = !conf.game_paused;
}
function controller(){
	var time = new Date().getTime()-conf.time;
	conf.time += time;
	if(time > 1.5*conf.frame_delay){
		conf.lag++;
		log('Lag',conf.lag);
	}
	//Tank
	player.move(time);
	//Rotate turret
	player.rotateTurret();
	for (var i = units.length - 1; i >= 1; i--) {
		units[i].runIa();
		units[i].move(time);
		units[i].rotateTurret();
		units[i].shoot(time);
	};
	player.shoot(time);
	//Shots
	for (var i = shots.length - 1; i >= 0; i--) {
		shots[i].move(time);
	};
	draw();
};
//View
function draw() {
	ctx.fillStyle = conf.color_background;
	ctx.fillRect(0, 0, canvas.width(), canvas.height());
	ctx.fillStyle = 'black';
	ctx.save();
	ctx.translate(canvas.width()/2-player.x,canvas.height()/2-player.y);
	//Buildings
	for(var i in map.buildings){
		ctx.fillRect(map.buildings[i].x,map.buildings[i].y,map.buildings[i].width,map.buildings[i].height);
	}
	//Units
	for (var i = units.length - 1; i >= 0; i--) {
		drawTank(units[i]);
	};
	for (var i = shots.length - 1; i >= 0; i--) {
		drawCircle(shots[i].x,shots[i].y,shots[i].radius);
	};
	//Interface
	ctx.restore();
	drawInfo();
	if(conf.redraw_interface){
		drawInterface();
	}
};
function drawCircle(x,y,radio,color){
	ctx.beginPath();
	ctx.arc(x, y, radio||4, 0, Math.PI*2, true); 
	ctx.closePath();
	ctx.fillStyle = color||'black';
	ctx.fill();
};
function drawTank(unit){
	ctx.save();
	//ctx.fillStyle = conf.color_tank;
	ctx.translate(unit.x,unit.y);
	ctx.rotate(unit.angle);
	//ctx.fillRect(-unit.width/2,-unit.length/2,unit.width,unit.length);
	ctx.drawImage(unit.img,-unit.width/2,-unit.height/2,unit.width,unit.height);
	ctx.fillStyle = 'white';
	ctx.fillText(unit.id,-unit.width/2+2,0);
	ctx.rotate(unit.turret.angle-unit.angle);
	ctx.drawImage(unit.turret.img,-unit.turret.width/2,-unit.turret.height/2,unit.turret.width,unit.turret.height);
	//ctx.fillStyle = 'black';
	//ctx.fillRect(-unit.turret.width/2,-unit.turret.width/2,unit.turret.length,unit.turret.width);
	drawCircle(0,0,unit.radius,'rgba(0,0,225,'+unit.shield.current/unit.shield.max/3+')');
	ctx.restore();
};
function drawInfo(){
	ctx.fillStyle = 'black';
	var i = 0;
	var offY = 100;
	var deltaY = 15;
	var coor_x = canvas.width()-150;
	ctx.fillText('Speed: '+player.speed,coor_x,offY+deltaY*i++);
	ctx.fillText('Angle: '+player.angle,coor_x,offY+deltaY*i++);
	ctx.fillText('Turret Angle: '+player.turret.angle,coor_x,offY+deltaY*i++);
	ctx.fillText('Shot: '+player.shot.time,coor_x,offY+deltaY*i++);
	ctx.fillText('X:'+player.x+' Y:'+player.y,coor_x,offY+deltaY*i++);
	for(var j in conf.log){
		ctx.fillText(j+': '+conf.log[j],coor_x,offY+deltaY*i++);
	}
};
function drawInterface(){
	conf.redraw_interface = false;
	ctx_if.clearRect(0, 0, interface.width(), interface.height());
	//HP
	ctx_if.fillStyle = 'red';
	ctx_if.fillRect(20,20,100*player.hp.current/player.hp.max,40);
	ctx_if.strokeStyle = 'black';
	ctx_if.strokeRect(20,20,100,40);
	ctx_if.fillStyle = 'black';
	ctx_if.fillText(player.hp.current+'/'+player.hp.max,30,35);
	//Shield
	ctx_if.fillStyle = 'blue';
	ctx_if.fillRect(20,60,100*player.shield.current/player.shield.max,40);
	ctx_if.strokeStyle = 'black';
	ctx_if.strokeRect(20,60,100,40);
	ctx_if.fillStyle = 'black';
	ctx_if.fillText(player.shield.current+'/'+player.shield.max,30,75);
	//Speed
	ctx_if.fillStyle = 'grey';
	ctx_if.fillRect(70,100,50*player.speed/player.speed_max,40);
	ctx_if.fillStyle = 'black';
	ctx_if.fillText(player.speed,player.speed<0?70:40,115);
}
//Helpers
function rand(val,off){
	return Math.floor(Math.random()*val)+(off||0);
};
function log(key,value){
	conf.log[key] = value;
};
