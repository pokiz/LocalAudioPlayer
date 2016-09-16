var ytdl = require('ytdl-core')
var FFmpeg = require('fluent-ffmpeg')
var through = require('through2')
var xtend = require('xtend')
var fs = require('fs')

module.exports = {
	download_mp3_from_video_url: function(url, filename, next)
	{
		var streamify = function(uri, opt, cb) {
			opt = xtend({
				videoFormat: 'mp4',
				quality: 'lowest',
				audioFormat: 'mp3',
				applyOptions: function () {}
			}, opt)

			var video = ytdl(uri, {filter: filterVideo, quality: opt.quality})

			function filterVideo (format) {
				return format.container === (opt.videoFormat)
			}
			var stream = opt.file
			? fs.createWriteStream(opt.file)
			: through()

			var ffmpeg = new FFmpeg(video)
			opt.applyOptions(ffmpeg)
			var output = ffmpeg
			.format(opt.audioFormat)
			.pipe(stream);
			output.on('finish', cb);
			output.on('error', video.end.bind(video))
			output.on('error', stream.emit.bind(stream, 'error'))
			return stream
		}
		var output_audio_file = fs.createWriteStream(filename);
		streamify(url, null, next).pipe(output_audio_file);
	},
}