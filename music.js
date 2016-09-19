var	fs = require('fs');
var youtube = require('./youtube');
var soundcloud = require('./soundcloud');

var file;

try {
	file = require("./musics.json");
	console.log("Musics loaded from json");
}catch(e) {
	console.log(e);
	file = {};
	file.musics = [];
	console.log("Error loading json file of musics.")
}

module.exports = {
	add: function(id, name, url, duration, next)
	{
		console.log("Added : " + name);
		console.log("      |-> url      : " + url);
		console.log("      |-> duration : " + duration);
		file.musics.push({id: id, name: name, url: url, duration: parseInt(duration), ups: 0});
		module.exports.sort_and_save(function() {
			console.log("Musics sorted after add.")
			next();
		});
	},
	add_attribute_by_id: function (id, attr, value) {
		var music = module.exports.get_by_id(id);
		music[attr] = value;
		module.exports.sort_and_save(function() {});
	},
	get_unique_id: function get_unique_id() {
		var date = new Date();
		var components = [
		    date.getYear(),
	    	date.getMonth(),
	    	date.getDate(),
	    	date.getHours(),
	    	date.getMinutes(),
	    	date.getSeconds(),
	    	date.getMilliseconds()
		];
		var id = components.join("");
		while (!module.exports.check_id_uniqueness(id))
		{
			id = get_unique_id();
		}
		return (id);
	},
	sort_and_save: function(next)
	{
		function compare(a,b) {
  			if (a.ups > b.ups)
			    return -1;
	  		if (a.ups < b.ups)
		    	return 1;
  			return 0;
		}
		file.musics.sort(compare);
		module.exports.save_file();
		next();
	},
	get_by_id: function(id)
	{
		var musics = file.musics;
		for (var music in musics)
		{
			if (musics[music].id == id)
				return (musics[music])
		}
		return (null);
	},
	remove_by_id: function(id)
	{
		for (var music in file.musics)
		{
			if (file.musics[music].id == id)
			{
				var index = file.musics.indexOf(file.musics[music]);
				file.musics.splice(index, 1);
				fs.unlink(LAP.download_path + id + ".mp3", function (err) {
					if (err)
					{
						console.log("File not removed");
						return console.log(err);
					}
					module.exports.sort_and_save(function() { return console.log("File removed."); });
				});
			}
		}
	},
	download_file_if_empty_or_none: function(download_dir, obj, next)
	{
		var output_file = download_dir + obj.id + ".mp3";
		var cb_download = function(url) {
			if (!url)
				next("Cannot download file, no url");
			if (url.indexOf("soundcloud") !== -1)
			{
				soundcloud.get_mp3_from_base_track_url(url, output_file, function(err) {
					if (err)
						next(err);
					else
						next();
				});		
			}
			else if ((url.indexOf("youtube") !== -1) || (url.indexOf("youtu.be") !== -1))
			{
				youtube.download_mp3_from_video_url(url, output_file, function(err) {
					if (err)
						next(err);
					else
						next();
				});		
			}
			else
				next(-1);
		};

		fs.stat(output_file, function(err, stats) {
			if (err)
			{
				if (err.errno === -2)
				{
					console.log("Audio file doesn't exist, trying to redownload");
					cb_download(obj.url);
				}
				else
				{
					console.log(err);
					next(err);
				}
			} else {
				if (stats.size <= 0)
				{
					console.log("Audio file exists, but empty...");
					cb_download(obj.url)
				}
				next();
		    }
		});
	},
	check_url_uniqueness: function(url)
	{
		for (var music in file.musics)
		{
			if (file.musics[music].url == url)
			{
				console.log("Url already exists");
				return (false);
			}
		}
		return (true);
	},
	check_name_uniqueness: function(name)
	{
		for (var music in file.musics)
		{
			if (file.musics[music].name == name)
			{
				console.log("Name already exists");
				return (false);
			}
		}
		return (true);
	},
	check_id_uniqueness: function(id)
	{
		for (var music in file.musics)
		{
			if (file.musics[music].id == id)
			{
				console.log("Id already exists");
				return (false);
			}
		}
		return (true);
	},
	save_file: function ()
	{
		console.log("Saving musics file.");
		var data_to_save = JSON.stringify(file);
		fs.writeFile("musics.json", data_to_save, function (err) {
			if (err) console.log(err);
		});
	},
	get_next: function()
	{
		return ((typeof file.musics[0] == "object") ? file.musics[0] : null);
	}
}

module.exports.list = file.musics;