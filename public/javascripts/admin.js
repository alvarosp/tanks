var timer = 1000;
var time = 0;
var socket = io.connect(location.origin+'/admin');

socket.on('connect', function(){
	console.log('Connected');
	calculate_lag();
})

function calculate_lag(){
	time = new Date().getTime();
	socket.emit('lag',{},function(){
		$('#lag').html(new Date().getTime() - time);
		setTimeout(calculate_lag, timer);
	});
}

function send_data(){
	var data = {};
	$('table input');
}