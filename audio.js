var exec = require('child_process').exec;

module.exports = {
	last_start_timestamp: 0,
	now_playing: "",
	now_playing_duration_sec: 0,
	play_it: function (url, next)
	{
		var cmd = 'mplayer "' + url + '"';
		module.exports.last_start_timestamp = new Date().getTime();
		exec(cmd, {maxBuffer: 1024 * 500}, function(error, stdout, stderr) {
		//if (error) console.log(error);
		//if (stdout) console.log(stdout);
		//if (stderr) console.log(stderr);
			next();
		});
	},
	get_file_duration_sec: function(path, next)
	{
		exec('ffmpeg -i '+ path, function  (error, stdout, stderr) {
			stdout+= stderr;
  			stdout= stdout.split('Duration: ')[1].split(', start: ')[0];
			var hours = stdout.split(':')[0];
			var minutes = stdout.split(':')[1];
			var seconds = stdout.split(':')[2].split(".")[0];
			var seconds_total = parseInt((hours * 3600)) + parseInt((minutes * 60)) + parseInt(seconds);
			next(seconds_total);
		});
	}
}