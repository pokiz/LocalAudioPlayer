global.LAP = {
	application_title: "El Jukebox",
	download_path: "./downloaded/",
	temp_path: "./temp/"
};

var uploads = {};
var client_count = 0;
var	fs = require('fs');
var timer = require("timers");
var volume = require('./volume');
var audio = require('./audio');
var music = require('./music');
var youtube = require("./youtube");
var soundcloud = require("./soundcloud");
var express = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io').listen(http),
	bodyParser = require('body-parser'),
	expressLayouts = require('express-ejs-layouts');

var routines = timer.setInterval(function() {
	var now = new Date().getTime();
	if (audio.last_start_timestamp == 0)
		console.log("Nothing to play...")
	else
	{
		if (audio.now_playing_duration_sec)
		{
			var remaining = audio.now_playing_duration_sec - ((now - audio.last_start_timestamp) / 1000);
			if (!volume.transition && (remaining < volume.fade_out_length))
			{
				volume.fade_out_effect();
			}
		}
	}
}, 1000);


try {
	fs.statSync(LAP.download_path);
} catch(e) {
	fs.mkdirSync(LAP.download_path);
}

try {
	fs.statSync("./temp/");
} catch(e) {
	fs.mkdirSync("./temp/");
}

/*----]
## 
## Http server part
##
[----*/

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(expressLayouts);
app.use("/static", express.static(__dirname + '/public'));
app.set('view engine', 'ejs'); 

app.get('/', function(req, res){
	res.render('index', {
		title: LAP.application_title,
		now_playing: audio.now_playing,
		now_playing_end: audio.last_start_timestamp + (audio.now_playing_duration_sec * 1000),
		musics: music.list
	});
});

app.post('/add', function(req, res){
	var name = (typeof req.body["name"] == "string" ? req.body["name"].trim() : "");
	var url = (typeof req.body["url"] == "string" ? req.body["url"].trim() : "");
	var urlregex = new RegExp("^(http:\/\/www.|https:\/\/www.|ftp:\/\/www.|www.|http:\/\/|https:\/\/){1}([0-9A-Za-z]+\.)");
	var errors = [];
	var messages = [];
	var id = music.get_unique_id();
	var output_file = LAP.download_path + id + ".mp3";
	var cb_add_music = function(next) {
		audio.get_file_duration_sec(output_file, function (duration) {
			music.add(id, name, url, duration, function() {
				io.sockets.emit("add", {id: id});
				messages.push("Music added");
				next();
			});
		});
	};
	var cb_render_page = function () {
		res.render('index', {
			title: LAP.application_title,
			now_playing: audio.now_playing,
			now_playing_end: audio.last_start_timestamp + (audio.now_playing_duration_sec * 1000),
			musics: music.list,
			messages: {red: errors, green: messages}
		});
	};
	if (typeof url != "string" || !urlregex.test(url))
	{
		errors.push("Url is not valid.");
	}
	if (!music.check_url_uniqueness(url))
	{
		errors.push("Url is already used.");
	}
	if (typeof name != "string" || (name.length < 2 || name.length > 128))
	{
		errors.push("Name must be between 2 and 128 characters.");
	}
	if (!music.check_name_uniqueness(name))
	{
		errors.push("Name is already used.");
	}
	if (!errors.length)
	{
		if (url.indexOf("soundcloud") !== -1)
		{
			soundcloud.get_mp3_from_base_track_url(url, output_file, function(err) {
				if (err)
				{
					console.log(err);
					errors.push(err);
					cb_render_page();
				}else
				{
					messages.push("Song added !");
					cb_add_music(cb_render_page);
				}
			});		
		}
		else if ((url.indexOf("youtube") !== -1) || (url.indexOf("youtu.be") !== -1))
		{
			youtube.download_mp3_from_video_url(url, output_file, function(err) {
				if (err)
				{
					console.log(err);
					errors.push(err);
					cb_render_page();
				}else
				{
					messages.push("Song added !");
					cb_add_music(cb_render_page);
				}
			});		
		}
	}else
		cb_render_page();
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

io.sockets.on('connection', function (socket) {
	++client_count;
    io.sockets.emit('user join', {
    	count: client_count
    });

	socket.on('up', function (data) {
		var item = music.get_by_id(data.id);
		if (item)
		{
			(item["ups"])++;
			music.sort_and_save(function () {
			    io.sockets.emit('up', {id: data.id});
			});
		}
	});

	socket.on('remove', function (data) {
		music.remove_by_id(data.id);
		io.sockets.emit('remove', {id: data.id});
	});

	socket.on('disconnect', function () {
      	--client_count;
      	if (typeof uploads[socket.id] != "undefined")
      	{
			if (Object.keys(uploads[socket.id]).length)
			{
				var obj = Object.keys(uploads[socket.id])[0];
				fs.unlink(LAP.temp_path + obj.output_name, function(){
					if(err) {
						console.log("Error removing temp file, after socket disconnection.");
						console.log(err);
					}
				});
			}
		   	delete uploads[socket.id];
      	}
      	socket.broadcast.emit('user left', {
        	count: client_count
      	});
	});

  	socket.on('upload-start', function (data) { //data contains the variables that we passed through in the html file
      	if (typeof uploads[socket.id] != "undefined")
      		return;
      	var type = data['type'];
		var name = data['name'];
		var id = music.get_unique_id();
		var extension = null;
		if (typeof name != "string" || (name.length < 2 || name.length > 128))
		{
			socket.emit('upload-cancel', { 'message' : "Name is not valid" });
			return;
		}
		if (!music.check_name_uniqueness(name))
		{
			socket.emit('upload-cancel', { 'message' : "Name is already taken" });
			return;
		}
		if (type == "audio/mpeg")
			extension = "mp3";
		if (type == "audio/mp3")
			extension = "mp3";
		if (!extension)
			return;
		uploads[socket.id] = {};
		uploads[socket.id][name] = {  //Create a new Entry in The Files Variable
			size : data['size'],
			data	 : "",
			downloaded : 0,
			id: id,
			output_name: id + "." + extension
		};
		console.log("Upload launched : " + name + "(" + uploads[socket.id][name].size + ")");
		var place = 0;
		try{
			var stat = fs.statSync(LAP.temp_path + uploads[socket.id][name].output_name);
			if(stat.isFile())
			{
				uploads[socket.id][name]['downloaded'] = stat.size;
				place = stat.size / 524288;
				return;
			}
		}
	  	catch(er){
	  		console.log("File doesnt exists");
	  	}
		fs.open(LAP.temp_path + uploads[socket.id][name].output_name, 'a', 0755, function(err, fd){
			if(err)
			{
				console.log(err);
			}
			else
			{
				uploads[socket.id][name]['handler'] = fd; //We store the file handler so we can write to it later
				socket.emit('upload-continue', { 'place' : place, percent : 0 });
			}
		});
	});
	
	socket.on('upload', function (data){
			var name = data['name'];
			if (typeof uploads[socket.id] == "undefined" || typeof uploads[socket.id][name] == "undefined")
				return;
			uploads[socket.id][name]['downloaded'] += data['data'].length;
			uploads[socket.id][name]['data'] += data['data'];
			if(uploads[socket.id][name]['downloaded'] == uploads[socket.id][name]['size']) //If File is Fully Uploaded
			{
				fs.write(uploads[socket.id][name]['handler'], uploads[socket.id][name]['data'], null, 'Binary', function(err, Writen){
					fs.readFile(LAP.temp_path + uploads[socket.id][name].output_name, function(err, data) {
    					fs.writeFile(LAP.download_path + uploads[socket.id][name].output_name, data, function(err) {
    						if (err){
    							console.log("Error writing output file to download ");
    							console.log(err);
    						}
        					fs.unlink(LAP.temp_path + uploads[socket.id][name].output_name, function(){
            					if(err) {
									console.log("Error unlinkin file from temp");
									console.log(err);
            					}
								audio.get_file_duration_sec(LAP.download_path + uploads[socket.id][name].output_name, function (duration) {
									music.add(uploads[socket.id][name].id, name, null, duration, function() {
										socket.emit('done', {});
										io.sockets.emit("add", {id: uploads[socket.id][name].id});
										delete uploads[socket.id];
									});
								});
        					});
	    				}); 
					});
				});
			}
			else if(uploads[socket.id][name]['data'].length > 10485760){ //If the data Buffer reaches 10MB
				fs.write(uploads[socket.id][name]['handler'], uploads[socket.id][name]['data'], null, 'Binary', function(err, Writen){
					uploads[socket.id][name]['data'] = ""; //Reset The Buffer
					var place = uploads[socket.id][name]['downloaded'] / 524288;
					var percent = (uploads[socket.id][name]['downloaded'] / uploads[socket.id][name]['size']) * 100;
					socket.emit('upload-continue', { 'place' : place, 'percent' :  percent});
				});
			}
			else
			{
				var place = uploads[socket.id][name]['downloaded'] / 524288;
				var percent = (uploads[socket.id][name]['downloaded'] / uploads[socket.id][name]['size']) * 100;
				socket.emit('upload-continue', { 'place' : place, 'percent' :  percent});
			}
	});

});

/*
// Here start the loop part for playing music.
// Setting volume to 0 to simulate previous "fade_out"
*/

function loop_playing()
{
	console.log("Loop playing called.");
	var to_play = music.get_next();
	var cb_play = function () {
		music.download_file_if_empty_or_none(LAP.download_path, to_play, function(err) {
			if (err)
			{
				console.log(err);
				return loop_playing();
			}
			audio.now_playing = to_play;
			audio.now_playing_duration_sec = to_play.duration;
			io.sockets.emit("now-playing", {music: to_play});
			volume.fade_in_effect();
			audio.play_it(LAP.download_path + to_play.id + ".mp3", function () {
				audio.now_playing_duration_sec = 0;
				audio.now_playing = "";
				loop_playing();
			});
		});
	};
	if (!to_play)
	{
		audio.now_playing = "";
		console.log("No sound...waiting one to play...");
		timer.setTimeout(loop_playing, 5000);
	}
	else
	{
		to_play.ups = 0;
		music.list.push(music.list.shift());
		cb_play();
	}
}

volume.set(0, function (err) {
	loop_playing();
});