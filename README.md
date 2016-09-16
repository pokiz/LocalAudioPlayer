# LocalAudioPlayer
(from SoundCloud and Youtube)
Local audio player with a playlist gracefully filled by clients via a web interface.


1. Clone this repository

2. Run "npm install" in the cloned folder, take a coffee (or/and go to step 3.)

3. Create a new SoundCloud app if you don't have one (http://soundcloud.com/you/apps/new)

4. Replace variables in soundcloud.js by your client_id, client_secret, username, and password


Now just type "node index.js", and try to add some musics via http://127.0.0.1:3000 !

NB : Not all soundcloud tracks can be played, some artists/label remove access to it via API (You will be notified when adding it from web interface). In this case, give YouTube a try ! ;)
