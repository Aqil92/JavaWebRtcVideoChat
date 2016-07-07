/**
 * This library require https://webrtc.github.io/samples/src/js/adapter.js
 */
// 'use strict';

function Message(signal, to, content, parameters) {
	this.signal = signal;
	this.to = to;
	this.content = content;
	this.parameters = parameters;
};

function NextRTC(config) {

	if (NextRTC.instance == null) {
		NextRTC.instance = this;
	} else {
		return NextRTC.instance;
	}

	this.mediaConfig = config.mediaConfig !== undefined ? config.mediaConfig : null;
	this.type = config.type;

	this.signaling = new WebSocket(config.wsURL);
	this.peerConnections = {};
	this.localStream = null;
	this.signals = {};

	this.on = function(signal, operation) {
		this.signals[signal] = operation;
	};

	this.call = function(event, data) {
		for ( var signal in this.signals) {
			if (event === signal) {
				return this.signals[event](this, data);
			}
		}
		console.log('Event ' + event + ' do not have defined function');
	};

	this.join = function(convId) {
		var nextRTC = this;
		navigator.mediaDevices.getUserMedia(nextRTC.mediaConfig)
		    .then(function(stream) {
              	    nextRTC.localStream = stream;
              	    nextRTC.call('localStream', {
              			stream : stream
              	    });
              	    nextRTC.request('join', null, convId);
              	    })
            .catch(error);
	};

	this.create = function(convId) {
		var nextRTC = this;
		navigator.mediaDevices.getUserMedia(nextRTC.mediaConfig)
		    .then(function(stream) {
            		nextRTC.localStream = stream;
            		nextRTC.call('localStream', {
            			stream : stream
            		});
            		nextRTC.request('create', null, convId);
            })
            .catch(error);
	};

	this.request = function(signal, to, convId) {
		var req = JSON.stringify(new Message(signal, to, convId));
		console.log("res: " + req);
		this.signaling.send(req);
	};

	this.signaling.onmessage = function(event) {
		console.log("req: " + event.data);
		var signal = JSON.parse(event.data);
		NextRTC.instance.call(signal.signal, signal);
	};

	this.signaling.onclose = function(event) {
		NextRTC.instance.call('close', event);
	};

	this.signaling.onerror = function(event) {
		NextRTC.instance.call('error', event);
	};

	this.offerRequest = function(nextRTC, from) {
		nextRTC.offerResponse(nextRTC, from);
	};

	this.offerResponse = function(nextRTC, signal) {
	    if(nextRTC.peerConnections[signal.from] === undefined){
	        nextRTC.createPeers(signal);
	    }
	    var pcLocal = nextRTC.peerConnections[signal.from]['local'];
        var pcRemote = nextRTC.peerConnections[signal.from]['remote'];
        pcLocal.createOffer()
        .then(
            function(desc) {
                pcLocal.setLocalDescription(desc)
                .then(function() {
                    nextRTC.request('offerResponse', signal.from, desc.sdp);
                }, error);
            });
	};

	this.createPeers = function(signal){
	    var pcLocal = new RTCPeerConnection(config.peerConfig);
    	var pcRemote = new RTCPeerConnection(config.peerConfig);
        nextRTC.peerConnections[signal.from] = {};
        nextRTC.peerConnections[signal.from]['local'] = pcLocal;
        nextRTC.peerConnections[signal.from]['remote'] = pcRemote;
        pcLocal.onicecandidate = function(e){
    	    nextRTC.onIceCandidate(signal.from, pcLocal, e);
    	};
    	pcRemote.onicecandidate = function(e){
            nextRTC.onIceCandidate(signal.from, pcRemote, e);
        };
        pcRemote.onaddstream = function(evt) {
            nextRTC.call('remoteStream', {
                    member : signal.from,
                    stream : evt.stream
                });
         };
         pcLocal.addStream(nextRTC.localStream);
	}

    this.onIceCandidate = function(member, pc, event) {
      if (event.candidate) {
        nextRTC.request('candidate', member, JSON.stringify(event.candidate));
      }
    }

	this.answerRequest = function(nextRTC, signal) {
		nextRTC.answerResponse(nextRTC, signal);
	};

	this.answerResponse = function(nextRTC, signal) {
	    if(nextRTC.peerConnections[signal.from] === undefined){
    	        nextRTC.createPeers(signal);
    	}
	    var pcLocal = nextRTC.peerConnections[signal.from]['local'];
	    var pcRemote = nextRTC.peerConnections[signal.from]['remote'];
	    pcRemote.setRemoteDescription(new RTCSessionDescription({
                                                 			type : 'offer',
                                                 			sdp : signal.content
                                                 		}));
	    pcRemote.createAnswer().then(function(desc){
	        pcRemote.setLocalDescription(desc).then(function(){
	            nextRTC.request('answerResponse', signal.from, desc.sdp);
	        }, error);
	        pcLocal.setRemoteDescription(desc);
	    });
	};

	this.finalize = function(nextRTC, signal) {
	    var pcLocal = nextRTC.peerConnections[signal.from]['local'];
    	pcLocal.setRemoteDescription(new RTCSessionDescription({
                                         			type : 'answer',
                                         			sdp : signal.content
                                         		}));
    };

	this.close = function(nextRTC, event) {
		nextRTC.signaling.close();
	};

	this.candidate = function(nextRTC, signal) {
    	var pcLocal = nextRTC.peerConnections[signal.from]['local'];
    	pcLocal.addIceCandidate(new RTCIceCandidate(JSON.parse(signal.content.replace(new RegExp('\'', 'g'), '"'))), success, error);
    }
	
	this.init = function() {
		this.on('offerRequest', this.offerRequest);
		this.on('answerRequest', this.answerRequest);
		this.on('finalize', this.finalize);
		this.on('candidate', this.candidate);
		this.on('close', this.close);
		this.on('ping', function(){});
	};

	this.init();
};

NextRTC.instance = null;

NextRTC.onReady = function() {
	console.log('It is highly recommended to override method NextRTC.onReady');
};

// it works for new Chrome, Opera and FF
if (document.addEventListener) {
	document.addEventListener('DOMContentLoaded', function() {
		NextRTC.onReady();
	});
}

var error = function(error) {
	console.log('error ' + JSON.stringify(error));
};

var success = function(success) {
	console.log('success ' + JSON.stringify(success));
};
