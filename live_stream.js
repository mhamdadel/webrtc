"use strict";

const startButton = document.getElementById("startButton");
const callButton = document.getElementById("callButton");
const hangupButton = document.getElementById("hangupButton");

callButton.disabled = true;
hangupButton.disabled = true;

startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

let localStream;
let remoteStream;
let pc1;
let pc2;

const offerOptions = {
    offerToReceiveVideo: 1,
    offerToReceiveAudio: 1,
};

function gotStream(stream) {
    console.log("Received local stream");
    localVideo.srcObject = stream;
    localStream = stream;
    callButton.disabled = false;
}

function start() {
    console.log("Requesting local stream");
    startButton.disabled = true;
    navigator.mediaDevices
        .getUserMedia({
            audio: true,
            video: true,
        })
        .then(gotStream)
        .catch((e) => {
            alert(`${getUserMedia()} error: ${e.name}`);
        });
}

function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    console.log("Starting call");

    const servers = null;

    pc1 = new RTCPeerConnection(servers);
    pc1.onicecandidate = (e) => onIceCandidate(pc1, e);

    pc2 = new RTCPeerConnection(servers);
    pc2.onicecandidate = (e) => onIceCandidate(pc2, e);
    pc2.ontrack = gotRemoteStream;

    localStream
        .getTracks()
        .forEach((track) => pc1.addTrack(track, localStream));

    console.log("pc1 createOffer start");
    pc1.createOffer(offerOptions).then(
        onCreateOfferSuccess,
        onCreateSessionDescriptionError
    );
}

function onCreateSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}`);
}

function onCreateOfferSuccess(desc) {
    console.log(`Offer from pc1\n${desc.sdp}`);
    console.log("pc1 setLocalDescription start");
    pc1.setLocalDescription(desc).then(() => {
        onSetLocalSuccess(pc1);
    }, onSetSessionDescriptionError);
    console.log("pc2 setRemoteDescription start");
    pc2.setRemoteDescription(desc).then(() => {
        onSetRemoteSuccess(pc2);
    }, onSetSessionDescriptionError);
    console.log("pc2 createAnswer start");
    pc2.createAnswer().then(
        onCreateAnswerSuccess,
        onCreateSessionDescriptionError
    );
}

function onSetLocalSuccess(pc) {
    console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
}

function onCreateAnswerSuccess(desc) {
    console.log(`Answer from pc2:\n${desc.sdp}`);
    console.log("pc2 setLocalDescription start");
    pc2.setLocalDescription(desc).then(() => {
        onSetLocalSuccess(pc2);
    }, onSetSessionDescriptionError);
    console.log("pc1 setRemoteDescription start");
    pc1.setRemoteDescription(desc).then(() => {
        onSetRemoteSuccess(pc1);
    }, onSetSessionDescriptionError);
}

function onIceCandidate(pc, event) {
    getOtherPc(pc)
        .addIceCandidate(event.candidate)
        .then(
            () => {
                onAddIceCandidateSuccess(pc);
            },
            (err) => {
                onAddIceCandidateError(pc, err);
            }
        );
    console.log(
        `${getName(pc)} ICE candidate:\n${
            event.candidate ? event.candidate.candidate : "null"
        }`
    );
}

function onAddIceCandidateSuccess(pc) {
    console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
    console.log(
        `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`
    );
}

function getOtherPc(pc) {
    return pc === pc1 ? pc2 : pc1;
}

function getName(pc) {
    return pc === pc1 ? "pc1" : "pc2";
}

function onSetLocalSuccess(pc) {
    console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
}

function maybeStart() {
    if (!started && localStream && channelReady) {
        console.log(">>>>>> creating peer connection");
        createPeerConnection();
        pc1.addStream(localStream);
        started = true;
        console.log("isInitiator", isInitiator);
        if (isInitiator) {
            doCall();
        }
    }
}

function doCall() {
    console.log("Sending offer to peer");
    pc1.createOffer(setLocalAndSendMessage, onCreateSessionDescriptionError);
}

function doAnswer() {
    console.log("Sending answer to peer.");
    pc2.createAnswer().then(
        onCreateAnswerSuccess,
        onCreateSessionDescriptionError
    );
}

function setLocalAndSendMessage(sessionDescription) {
    pc1.setLocalDescription(sessionDescription);
    console.log("setLocalAndSendMessage sending message", sessionDescription);
    sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}`);
}

function requestTurn(turnURL) {
    let turnExists = false;
    for (let i in pcConfig.iceServers) {
        if (pcConfig.iceServers[i].urls.substr(0, 5) === "turn:") {
            turnExists = true;
            turnReady = true;
            break;
        }
    }
    if (!turnExists) {
        console.log("Getting TURN server from ", turnURL);
        // No TURN server. Get one from computeengineondemand.appspot.com:
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                let turnServer = JSON.parse(xhr.responseText);
                console.log("Got TURN server: ", turnServer);
                pcConfig.iceServers.push({
                    urls: `turn:${turnServer.username}@${turnServer.turn}`,
                    credential: turnServer.password,
                });
                turnReady = true;
            }
        };
        xhr.open(
            "GET",
            `${turnURL}?username=${encodeURIComponent(
                Math.random().toString(36).substr(2, 10)
            )}`,
            true
        );
        xhr.send();
    }
}

function sendMessage(message) {
    console.log("Client sending message: ", message);
    socket.emit("message", message);
}

function handleRemoteStreamAdded(event) {
    console.log("Remote stream added.");
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
    console.log("Remote stream removed. Event: ", event);
}

function hangup() {
    console.log("Hanging up.");
    stop();
    sendMessage("bye");
}

function handleRemoteHangup() {
    console.log("Session terminated.");
    stop();
    isInitiator = false;
}

function stop() {
    isStarted = false;
    // isAudioMuted = false;
    // isVideoMuted = false;
    pc1.close();
    pc2.close();
    pc1 = null;
    pc2 = null;
}

function toggleVideoMute() {
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) {
        console.log("No local video available.");
        return;
    }
    console.log(`Toggling video mute state: ${isVideoMuted}`);
    isVideoMuted = !isVideoMuted;
    for (let i = 0; i < videoTracks.length; ++i) {
        videoTracks[i].enabled = !isVideoMuted;
    }
    console.log(`Video ${isVideoMuted ? "muted" : "unmuted"}.`);
}

function toggleAudioMute() {
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
        console.log("No local audio available.");
        return;
    }
    console.log(`Toggling audio mute state: ${isAudioMuted}`);
    isAudioMuted = !isAudioMuted;
}
function gotRemoteStream(event) {
    console.error("gotRemoteStream");
    if ("srcObject" in remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        console.log(event.streams[0]);
    } else {
        remoteVideo.src = URL.createObjectURL(event.streams[0]);
    }
}
