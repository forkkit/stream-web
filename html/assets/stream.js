function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getBlob(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], {type: mimeString});
  return blob;

}

function startClient(e) {
	if (e != undefined) {
		e.preventDefault();
	}

	var vid = document.getElementById('video-container');
	var img = document.createElement('img');
	vid.innerHTML = '';
	vid.prepend(img);
	
	var proto = (window.location.protocol == "http:") ? "ws://" : "wss://"
	var url = proto + window.location.host + window.location.pathname + "/video" + window.location.search;
	var aurl = proto + window.location.host + window.location.pathname + "/audio" + window.location.search;

	// new websocket
	const ws = new WebSocket(url);
	const aws = new WebSocket(aurl);

	// video socket
	ws.onopen = () => console.log(`Connected to ${url}`);
	ws.onmessage = message => {
		console.log("now");
	    console.log(message.data);
	    img.src = URL.createObjectURL(message.data);
	};

	// audio playback
	var count = 0;
	var startTime;
	var audioCtx = new AudioContext();

	var playSound = function(buffer, playTime) {
		var source = audioCtx.createBufferSource(2, 4096, audioCtx.sampleRate); //Create a new BufferSource fr the
		source.buffer = buffer; // Put the sample content into the buffer
		source.connect(audioCtx.destination); // Also Connect the source to the audio output
		source.start(playTime); // Set the starting time of the sample to the scheduled play time
	};

	// audio socket
	aws.onopen = () => console.log(`Connected to ${url}`);

	aws.onmessage = message => {
	    if (count == 0) {
		startTime = audioCtx.currentTime;
	    }

	    var reader = new FileReader();
	    reader.onload = function() {
		
		//audioCtx.decodeAudioData(reader.result, function(data) {
		//	var buffer = data;	
		//	count++; // Keep a count of how many messages have been received
		//	var playTime = startTime + (count * 0.2); // Play each at file 200ms
		//	playSound(buffer, playTime); //call the function to play the sample at the appropriate time
		//}, function(e) { }); //console.log("err: " + e) });
	    };
	    reader.readAsArrayBuffer(message.data);
	}

	// controls
	var stop = document.getElementById('stop');
	stop.onclick = function(e) {
		e.preventDefault();
		ws.close();
		aws.close();
	}

	// mute button
	var mute = document.getElementById('mute')

	mute.onclick = function(e) {
		e.preventDefault();
		var text = mute.innerText;
		if (text == "Mute") {
			mute.innerText = 'Unmute';
			audioCtx.suspend();
		} else {
			mute.innerText = 'Mute';
			audioCtx.resume();
		}
	};
};

function startServer(e) {
  e.preventDefault();

  // Normalize the various vendor prefixed versions of getUserMedia.
  navigator.getUserMedia = (navigator.getUserMedia ||
                            navigator.webkitGetUserMedia ||
                            navigator.mozGetUserMedia || 
                            navigator.msGetUserMedia);

	// Check that the browser supports getUserMedia.
	// If it doesn't show an alert, otherwise continue.
	if (navigator.getUserMedia) {
	  // Request the camera.
	  navigator.getUserMedia(
	    // Constraints
	    {
	      audio: true,
	      video: true
	    },

	    // Success Callback
	    function(stream) {
		// Get a reference to the video element on the page.
		var video = document.getElementById('camera-stream');
		var mute = document.getElementById('mute')

		// Create an object URL for the video stream and use this 
		// to set the video source.
		video.srcObject = stream
		video.muted = true;

		mute.onclick = function(e) {
			e.preventDefault();
			var text = mute.innerText;
			if (text == "Mute") {
				video.muted = true;
				mute.innerText = 'Unmute';
			} else {
				video.muted = false;
				mute.innerText = 'Mute';
			}
		};

		// returns a frame encoded in base64
		const getFrame = () => {
		    const canvas = document.createElement('canvas');
		    canvas.width = video.videoWidth;
		    canvas.height = video.videoHeight;
		    canvas.getContext('2d').drawImage(video, 0, 0);
		    const data = canvas.toDataURL('image/png', 0.2); //('image/png', 0.2);
		    return getBlob(data);
		}

		// unique id for stream
		var id = uuid()
		// protocol
		var proto = (window.location.protocol == "http:") ? "ws://" : "wss://"
		// video url
		var vurl = proto + window.location.host + window.location.pathname + "/video?id=" + id;
		// audio url
		var aurl = proto + window.location.host + window.location.pathname + "/audio?id=" + id;
		// share link
		var share = document.getElementById('share');

		// Frames per second
		const FPS = 9;

		// create websocket
		const vws = new WebSocket(vurl);
		const aws = new WebSocket(aurl);

		var send;

	        var context = new AudioContext();
	        var source = context.createMediaStreamSource(stream);
	        var processor = context.createScriptProcessor(4096, 1, 1);

	        source.connect(processor);
	        processor.connect(context.destination);

		// send the audio stream
	        processor.onaudioprocess = function(e) {
		  aws.send(e.inputBuffer, {binary: true});
	        };

		// send video stream to server
		vws.onopen = () => {
		    console.log(`Connected to ${vws}`);
		    send = setInterval(() => {
		        vws.send(getFrame(), {binary: true});
		    }, 1000 / FPS);
		}

		// create stop event
		const stop = (e) => {
  		  e.preventDefault();
		  var stream = video.srcObject;
		  var tracks = stream.getTracks();

		  for (var i = 0; i < tracks.length; i++) {
		    var track = tracks[i];
		    track.stop();
		  }

		  video.srcObject = null;

		  source.disconnect();
		  processor.disconnect();

		  // clear the sender
		  clearInterval(send)

		  // close the websockets
		  vws.close();
		  aws.close();

		  // remove the share linke
		  share.innerHTML = '';
		}

		// stop stream
		document.getElementById('stop').onclick = stop;

		// set share link
		shareURL = window.location.href + "?id=" + id + "&type=client"
		share.innerHTML = 'Share your stream <a href="'+ shareURL + '">' + shareURL + '</a>';
	    },

   
	    // Error Callback
	    function(err) {
	      // Log the error to the console.
	      console.log('The following error occurred when trying to use getUserMedia: ' + err);
	    }
	  );

	} else {
	  alert('Sorry, your browser does not support getUserMedia');
	}

}

function getParam(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

window.onload = function() {
	var front = false;
	var id = getParam("id");
	var type = getParam("type");

	// flip camera
	//document.getElementById('flip').onclick = function() { front = !front; };
	//var constraints = { video: { facingMode: (front? "user" : "environment") } };

	// start client or server
	if (id.length > 0 && type == "client") {
		startClient();

		// start stream
		document.getElementById('start').onclick = startClient;
	} else {
		// start stream
		document.getElementById('start').onclick = startServer;
	}

}
