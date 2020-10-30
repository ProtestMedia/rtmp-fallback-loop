#!/usr/bin/env node
const spawn = require("child_process").spawn;

const input_rtmp = 'rtmp://127.0.0.1/feed/in';
const loop_file  = 'loop.mp4';
const out_rtmp   = 'rtmp://127.0.0.1/feed/out';
const timeout    = 30; // in 1/10th of a second

function log(data){
console.log('['+(new Date(Date.now())).toISOString()+'] '+data);
}

var fallback=0;
var mode = 'loop';
//var mode = 'initial';

function initInputStream()
{
	let toReturn = spawn("ffmpeg", ("-hide_banner -re -f live_flv -i "+input_rtmp+" -g 1 -s 1280x720 -pix_fmt nv12 -c:v mpeg2_qsv -b:v 35000k -maxrate 35000k -bufsize 60000k -c:a aac -f mpegts -").split(" "));
	toReturn.on("exit", (code) => { ffmpegIn = initInputStream() });
	toReturn.stderr.on("data", (data) => {});
	toReturn.stdout.on("data", onData);
	return toReturn;
}

const ffmpegLoop = spawn("ffmpeg", ("-hide_banner -stream_loop -1 -re -c:v h264_qsv -i "+loop_file+" -g 1 -s 1280x720 -pix_fmt nv12 -c:v mpeg2_qsv -b:v 35000k -maxrate 35000k -bufsize 60000k -c:a aac -f mpegts -").split(" "));
ffmpegLoop.stderr.on("data", (data) => { });
ffmpegLoop.stdout.on("data", onDataLoop);

const ffmpegOut = spawn("ffmpeg",  ("-init_hw_device qsv=hw -hwaccel qsv -hide_banner -fflags +flush_packets -c:a aac -c:v mpeg2_qsv -f mpegts -i - -err_detect ignore_err -r 30 -g 60 -c:v h264_qsv -b:v 3500k -maxrate 3500k -bufsize 6000k -preset fast -c:a aac -f fifo -fifo_format flv -map 0:v -map 0:a -drop_pkts_on_overflow 1 -attempt_recovery 1 -recovery_wait_time 1 "+out_rtmp+" -vf vpp_qsv=w=568:h=320 -r 30 -g 60 -c:v h264_qsv -b:v 500k -maxrate 350k -bufsize 600k -preset fast -c:a aac -f fifo -fifo_format flv -map 0:v -map 0:a -drop_pkts_on_overflow 1 -attempt_recovery 1 -recovery_wait_time 1 rtmp://127.0.0.1/feed/dummy_sd").split(" "));
ffmpegOut.stderr.on("data", (data) => { 
	console.log('OUT  '+data.toString());
});
ffmpegOut.stdout.on("data", (data) => { });
ffmpegOut.on("exit", (code) => { log("ffmpegOut exited with code "+code+"! Exiting..."); process.exit(code); });

var ffmpegIn = initInputStream();

function onData(videoData) {
	if(mode != 'input') {
		log('switch to input');
		mode = 'input';
	}
	else{
		ffmpegOut.stdin.write(videoData);
	}
	fallback=0;
}

function onDataLoop(videoData)
{
	if(mode == 'loop'){
		ffmpegOut.stdin.write(videoData);
	}
}

setInterval(function(){
	fallback++;

	if(fallback > timeout) {
		if(mode == 'input') {
			mode = 'loop';
			log('switch to loop');
		}
	}
}, 100);

log('wating for input');
