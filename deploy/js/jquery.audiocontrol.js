(function ($) {
  $.fn.audiocontrol = function(options) {
		/********************
		 ** Provide default settings and a mechanism for overriding with options object
		 ********************/
		var defaults = {
			audioButtonClass: "audioButton",  			//class applied to DOM elements used as buttons
			defaultMediaExtension: ".mp3",				//file extension used by flash version of audio player
			flashAudioPlayerPath: "swf/player.swf",		//path to flash version of audio player
			flashObjectID: "audioPlayer",				//id of flash object
			loadingClass: "loading",					//class applied to buttons while media loads
			playerContainer: "player",					//id of DOM element that contains audio element (or is replaced by flash)
			playingClass: "playing",					//class applied to buttons while media plays
			swfobjectPath: "js/swfobject.js"			//path to swfobject.js used to embed flash movie in page
		};
	
		var currentTrack;							//reference to the current(or last played) track
		var isPlaying = false;						//track play state of track
		var isFlash = false;						//force player into flash mode for testing
		var audio;									//audio element or id of embedded flash player	

		//vars for caching jQuery wrapped sets
		var $player;								
		var $buttons;
		var $tgt;

		/********************
		 ** The play, resume and pause methods differ depending on the playback mode (html5 or flash) of the player. 
		 ** Instead of repeatedly testing isFlash every time one of those methods is called, I test once 
		 ** in init() and use playTrack, resumeTrack and pauseTrack to hold references to the functions that are properties
		 ** of the htmlFunctions or flashFunctions object.
		 **
		 ** I create a new instance of the Audio element for every new track in html5 mode. This is because Audio events (canplay, ended, etc)
		 ** don't fire consistently across all browsers when resetting the src attribute of a previously created Audio element. 
		 ********************/
		var playTrack;
		var resumeTrack;
		var pauseTrack;
		/********************
		 ** Some actions such as updating UI and vars are necessary on change of track state regardless of playback mode.
		 ** These common functions are called from both htmlFunctions and flashFunctions.
		 ********************/
		var common = {
			playTrack: function() {
				currentTrack = $tgt.attr("href");
				isPlaying = true;
				$tgt.addClass(defaults.loadingClass);
				$buttons.removeClass(defaults.playingClass);
			},
			pauseTrack: function() {
				$tgt.removeClass(defaults.playingClass);
				isPlaying = false;
			},
			resumeTrack: function() {
				$tgt.addClass(defaults.playingClass);
				isPlaying = true;
			}
		}
		var htmlFunctions = {
			playTrack: function(evt) {
				common.playTrack();
				if(audio) {
					audio.pause();
					removeListeners(audio);
					$player.remove(audio);
				}

			    audio = new Audio('');
			    audio.id = "audio";
				addListeners(audio);

			    $player.append(audio);
			    audio.src = currentTrack + defaults.defaultMediaExtension;
			    audio.play();
			},
			pauseTrack: function() {
				audio.pause();
				common.pauseTrack();
			},
			resumeTrack: function() {
				audio.play();
				common.resumeTrack();
			}
		};
		var flashFunctions = {
			playTrack: function(evt) {
				common.playTrack();
				audio = document.getElementById(defaults.flashObjectID);
				addListeners(window);
				audio.playFlash(currentTrack + defaults.defaultMediaExtension);

			},
			pauseTrack: function() {
				audio.pauseFlash();
				common.pauseTrack();
			},
			resumeTrack: function() {
				audio.playFlash();
				common.resumeTrack();
			}
		};
	
		if (options) {
			$.extend(defaults, options);
		}

		$player = $("#"+defaults.playerContainer);
		$buttons = $("."+defaults.audioButtonClass);
	
		playTrack = htmlFunctions.playTrack;
		resumeTrack = htmlFunctions.resumeTrack;
		pauseTrack = htmlFunctions.pauseTrack;

		$('.controls').bind('click',function(event){
			                              updateTrackState(event)
		                            });

		if(isFlash || !document.createElement('audio').canPlayType) {
			return useFlash();
		}
			

		if(canPlay("OGG")) {
			defaults.defaultMediaExtension = ".ogg";
		} else if(canPlay("MP3")) {
			defaults.defaultMediaExtension = ".mp3";
		} else {
			return useFlash();
		}
	
		function useFlash() {
			playTrack = flashFunctions.playTrack;
			resumeTrack = flashFunctions.resumeTrack;
			pauseTrack = flashFunctions.pauseTrack;
			$.getScript(defaults.swfobjectPath,loadFlash);		
		}

		function loadFlash() {
			swfobject.embedSWF(defaults.flashAudioPlayerPath, defaults.playerContainer, "0", "0", "9.0.0", "swf/expressInstall.swf", false, false, {id:defaults.flashObjectID});
		}

		function updateTrackState(evt) {
			$tgt = $(evt.target);

			if(!$tgt.hasClass("audioButton"))
				return;

		    if(!audio || (audio && currentTrack !== $tgt.attr("href")))
				playTrack(evt);
			else if(!isPlaying)
				resumeTrack();
			else
				pauseTrack();
		}

		/********************
		 ** These methods exist because I must add/remove listeners every time a new Audio element is created.
		 ** It's necessary to add event listeners to different elements depending on playback mode.
		 ** Flash dispatches events from the window and html5 from the audio element so we bind to those
		 ** elements respectively. It was primarily an issue in IE8 and below because the audio events being
		 ** dispatched from the Flash are custom events. I need to investigate further.
		 ********************/
		function addListeners(elem) {
			$(elem).bind({"canplay" : onLoaded,
						  "error" : onError,
						  "ended" : onEnded});
		}

		function removeListeners(elem) {
			$(elem).unbind({"canplay" : onLoaded,
							"error" : onError,
							"ended" : onEnded});
		}

		/********************
		 ** event handlers
		 ********************/
	
		function onLoaded() {
			$buttons.removeClass(defaults.loadingClass);
			$tgt.addClass(defaults.playingClass);
		}

		function onError() {
			$buttons.removeClass(defaults.loadingClass);
			alert("There was an error loading this file.");
			removeListeners(audio);
		}

		function onEnded() {
			isPlaying = false;
			$tgt.removeClass(defaults.playingClass);
			currentTrack = "";
			removeListeners(audio);
		}
	
		/********************
		 ** canPlay is a utility method used to test if we have browser support for an audio codec
		 ********************/

		function canPlay(type) {
			var fmt;
			switch (type) {
				case "OGG":
					fmt = 'audio/ogg; codecs="vorbis"';
					break;
				case "MP3":
					fmt = 'audio/mpeg';
					break;
			}
			return document.createElement('audio').canPlayType(fmt).match(/maybe|probably/i) ? true : false;
		}
		
		return {
			kill : function() {
				pauseTrack();
			}
		}
    }
})(jQuery);