var	fs = require('fs');
var request = require("request");
var exec = require('child_process').exec;
var SC = require('soundcloud-nodejs-api-wrapper');

var sc = new SC({
	client_id 		: 'YOUR_SECRET_ID',
	client_secret	: 'YOUR_CLIENT_SECRET',
	username		: 'YOUR_USERNAME(MAIL)',
	password		: 'YOUR_PASSWORD'
});

var soundcloud_access_token = null;

var client = sc.client();

module.exports = {
	get_mp3_from_base_track_url: function(base_url, filename, next) {
		var log_and_return_string_on_sc_error = function (err) {
			if (err.statusCode == "503" || err.statusCode == "500")
			{
				console.log("[Soundcloud] Soundcloud have a problem, not us...x)")
				return ("Sorry, Soundcloud has a problem, not us...x)");
			}
			else if (err.statusCode == "403")
			{
				console.log("[Soundcloud] Access to this sound is not authorized...")
				return ("Sorry, access to this sound is not authorized due to author/label restriction...");
			}
			else if ((typeof err.code == "string") && err.code == "EAI_AGAIN")
			{
				console.log("[Soundcloud] Error : No connection");
				return ("No internet access from the server...");
			}
			else
			{
				console.log(err);
				return ("Unknown error, please retry later...");
			}
		};
		var get_access_token = function(next) {
			client.exchange_token(function(err, results) {
				if (arguments[0])
				{
					if (arguments[0].statusCode == 401)
					{
						console.log("[Soundcloud] 401 ERROR: " + arguments[0].data);
					}
					else if ((typeof arguments[0].code == "string") && arguments[0].code == "EAI_AGAIN")
						console.log("[Soundcloud] Error : No connection");
					else
						console.log(arguments[0]);
					return next(null);
				}
				data = arguments[3];
				access_token = data.access_token;
				expires_in = data.expires_in;
				console.log('Our new access token "'+access_token+'" will expire in '+expires_in); // should show your new user token and when it will expire
				return next(access_token);
			});
		};
		var cb = function cb() {
			var clientnew = sc.client({access_token : access_token});
			console.log('/resolve?url='+ base_url);
			clientnew.get('/resolve', {url: base_url}, function(err, result) {
				if (err)
					return next(log_and_return_string_on_sc_error(err));
				if (result)
				{
					var splitted_location = result.location.split("/");
					var track_id = splitted_location[4].split("?")[0];
					clientnew.get("/tracks/" + track_id, function(err, result) {
						if (err)
							return next(log_and_return_string_on_sc_error(err));
						clientnew.get("/tracks/" + track_id + "/stream", function(err, result) {
							if (err)
								return next(log_and_return_string_on_sc_error(err));
							console.log("Trying to retreive file from: " + result.location);
							request
							.get(result.location)
							.on('error', function(err) {
								console.log(err);
								return next("Error when download file...");
							})
 							.pipe(fs.createWriteStream(filename))
 							.on( 'finish', function(){
	 							next(null);
 							});;
						});
					});
				}
			});
		};
		if (!soundcloud_access_token)
			get_access_token(function (token) {
				if (!token) return next("Error when fetching token from Soundcloud...");
				soundcloud_access_token = token;
				return cb();
			});
		else
			return cb();
	}
};
