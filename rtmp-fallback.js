#!/usr/bin/env node
const spawn = require("child_process").spawn;

const input_rtmp = 'rtmp://127.0.0.1/feed/1';
const loop_file  	 = 'loop.mp4';
const out_rtmp   = 'rtmp://127.0.0.1/feed/3';
const timeout    = 10; // in 1/10th of a second

var fallback=0;
var mode = 'initial';

function initInputStream(){

	let toReturn = spawn("ffmpeg", ("-f live_flv -re -i "+input_rtmp+" -c copy -f mpegts -").split(" "));
	toReturn.on("exit", (code) => { console.log("ffmpegIn exited with code " + code); ffmpegIn = initInputStream() });
	toReturn.stdout.on("data", onData);

	return toReturn;
}

function initLoopStream(){

	let toReturn = spawn("ffmpeg", ("-stream_loop -1 -re -i "+loop_file+" -c copy -f mpegts -").split(" "));
	toReturn.on("exit", (code) => { console.log("ffmpegLoop exited with code " + code);});
	toReturn.stdout.on("data", onDataLoop);

	return toReturn;
}

const ffmpegOut = spawn("ffmpeg", ("-fflags +genpts -re -f mpegts -i - -c copy -bsf:a aac_adtstoasc -f flv "+out_rtmp).split(" "));
//ffmpegOut.stderr.on("data", (data) => { console.log(data.toString())});
//ffmpegOut.stdout.on("data", (data) => { console.log(data.toString())});
ffmpegOut.on("exit", (code) => { console.log("ffmpegOut exited with code "+code+"! Exiting..."); process.exit(code); });

var ffmpegIn = initInputStream();
var ffmpegLoop;

function onData(videoData) {
	if(mode != 'input') {
		if(mode == 'loop'){
			ffmpegLoop.kill('SIGKILL');
		}
		console.log('send input');
		mode = 'input';
		fallback=0;
	}
	ffmpegOut.stdin.write(videoData);
	fallback=0;

}

function onDataLoop(videoData) {

	ffmpegOut.stdin.write(videoData);
}

setInterval(function(){
	fallback++;

	if(fallback > timeout) {
		if(mode == 'input') {
			mode = 'loop';
			console.log('send loop');
			ffmpegLoop = initLoopStream();
		}
	}

}, 100);

