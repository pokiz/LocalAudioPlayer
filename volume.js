var loudness = require('loudness');
var timer = require("timers");

var fade_in_effect_to = null;
var fade_out_effect_to = null;

module.exports = {
	actual: 50,
	transition: false,
	before_fadeout: 50,
	fade_in_length: 5,
	fade_in_step: 10,
	fade_in_actual_step: 0,
	fade_out_length: 6,
	fade_out_step: 10,
	fade_out_actual_step: 0,
	get_fade_in_interval: function () { return ((module.exports.fade_in_length * 1000) / module.exports.fade_in_step) },
	get_fade_out_interval: function () { return ((module.exports.fade_out_length * 1000) / module.exports.fade_out_step) },
	fade_in_effect: function (next, retry)
	{
		if (typeof retry)
		if (module.exports.fade_in_actual_step)
		{
			return ((typeof next == "function") ? next(true) : null);
		}
		if (module.exports.fade_out_actual_step)
		{
			//return ((typeof next == "function") ? next(true) : null);
			timer.setTimeout(module.exports.fade_in_effect, 500);
		}
		console.log("Fading in...");		
		var cb = function cb(){
		var value = parseInt(module.exports.fade_in_actual_step * (module.exports.actual / module.exports.fade_in_step));
			loudness.setVolume(value, function (err) {
				++module.exports.fade_in_actual_step;
				if (module.exports.fade_in_actual_step < module.exports.fade_in_step)
					timer.setTimeout(cb, module.exports.get_fade_in_interval());
				else
				{
					module.exports.transition = false;
					module.exports.fade_in_actual_step = 0;
				}
			});
		};
		module.exports.fade_in_actual_step = 0;
		loudness.getVolume(function (err, vol) {
			if (err) return console.log(err);
			if (!module.exports.before_fadeout)
			{
				module.exports.before_fadeout = vol;
				module.exports.actual = vol;
			}
			else
				module.exports.actual = module.exports.before_fadeout;
			timer.setTimeout(cb, module.exports.get_fade_in_interval());
		});	
	},
	fade_out_effect: function(next)
	{	
		if (module.exports.fade_in_actual_step)
		{
			return ((typeof next == "function") ? next(true) : null);
		}
		if (module.exports.fade_out_actual_step)
		{
			return ((typeof next == "function") ? next(true) : null);
		}
		module.exports.transition = true;
		console.log("Fading out...");
		var cb = function cb(){
			var value = parseInt(module.exports.actual - (module.exports.fade_out_actual_step * (module.exports.actual / module.exports.fade_out_step)));
			loudness.setVolume(value, function (err) {
				++module.exports.fade_out_actual_step;
				if (module.exports.fade_out_actual_step < module.exports.fade_out_step)
					timer.setTimeout(cb, module.exports.get_fade_out_interval());
				else
				{
					module.exports.fade_out_actual_step = 0;
					return ((typeof next == "function") ? next(true) : true);
				}
			});
		};
		module.exports.fade_out_actual_step = 0;
		loudness.getVolume(function (err, vol) {
			if (err) return console.log(err);
			module.exports.actual = vol;
			module.exports.before_fadeout = vol;
			timer.setTimeout(cb, module.exports.get_fade_out_interval());
		});
	},
	set: function(value, next) {
		loudness.setVolume(value, function (err) {
			if (err) console.log(err);
			next();
		});
	}
};
