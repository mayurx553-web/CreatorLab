const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let file=null, objectURL=null, audioBuffer=null, ffmpeg=null, audioCtx=null;

const status=m=>$("#status").textContent=m;
const progress=n=>$("#progress").style.width=n+"%";

$("#theme").onclick=()=>document.body.classList.toggle("light");
$("#drop").onclick=()=>$("#file").click();
$("#file").onchange=e=>loadFile(e.target.files[0]);
$("#drop").ondragover=e=>{e.preventDefault()};
$("#drop").ondrop=e=>{e.preventDefault();loadFile(e.dataTransfer.files[0])};

async function loadFile(f){
 if(!f||!f.type.startsWith("audio/"))return alert("Choose an audio file.");
 file=f;
 if(objectURL)URL.revokeObjectURL(objectURL);
 objectURL=URL.createObjectURL(f);
 $("#audio").src=objectURL;
 $("#fileInfo").textContent=`${f.name} · ${(f.size/1048576).toFixed(2)} MB`;
 $("#editor").classList.remove("hidden");
 $("#audio").onloadedmetadata=()=>{$("#end").value=$("#audio").duration.toFixed(2);drawWave()};
 try{
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  audioBuffer=await audioCtx.decodeAudioData(await f.arrayBuffer());
  drawWave();
 }catch(e){status("Preview loaded. Export may require a browser with Web Audio support.")}
}

$("#speed").oninput=e=>{$("#speedOut").textContent=(+e.target.value).toFixed(2)+"×";$("#audio").playbackRate=+e.target.value};
$("#pitch").oninput=e=>$("#pitchOut").textContent=e.target.value+" st";
$("#volume").oninput=e=>{$("#volumeOut").textContent=Math.round(+e.target.value*100)+"%";$("#audio").volume=+e.target.value};
$("#bass").oninput=e=>$("#bassOut").textContent=e.target.value+" dB";
$("#treble").oninput=e=>$("#trebleOut").textContent=e.target.value+" dB";
$("#reverb").oninput=e=>$("#reverbOut").textContent=e.target.value+"%";

$$("[data-preset]").forEach(b=>b.onclick=()=>{
 const p=b.dataset.preset;
 if(p==="normal"){set("speed",1);set("pitch",0);set("reverb",0);set("bass",0);set("treble",0)}
 if(p==="slow"){set("speed",.8);set("pitch",0);set("reverb",0)}
 if(p==="slowedReverb"){set("speed",.8);set("pitch",-2);set("reverb",45);set("bass",2);set("treble",-1)}
 sync();
});
function set(id,v){$("#"+id).value=v}
function sync(){
 ["speed","pitch","volume","bass","treble","reverb"].forEach(id=>$("#"+id).dispatchEvent(new Event("input")));
}
$("#play").onclick=()=>$("#audio").paused?$("#audio").play():$("#audio").pause();
$("#preview").onclick=()=>{$("#audio").currentTime=+$("#start").value||0;$("#audio").play()};

function drawWave(){
 if(!audioBuffer)return;
 const c=$("#wave"),ctx=c.getContext("2d"),w=c.clientWidth,h=c.clientHeight,d=devicePixelRatio||1;
 c.width=w*d;c.height=h*d;ctx.scale(d,d);
 const data=audioBuffer.getChannelData(0), step=Math.ceil(data.length/w), amp=h/2;
 ctx.strokeStyle="#777";ctx.beginPath();
 for(let i=0;i<w;i++){let min=1,max=-1;for(let j=0;j<step;j++){let v=data[i*step+j]||0;min=Math.min(min,v);max=Math.max(max,v)}ctx.moveTo(i,(1+min)*amp);ctx.lineTo(i,(1+max)*amp)}ctx.stroke();
}
$("#audio").ontimeupdate=()=>{if($("#audio").duration)$("#playhead").style.left=(($("#audio").currentTime/$("#audio").duration)*100)+"%"};

async function getTrimmedBuffer(){
 if(!audioBuffer)throw Error("No decoded audio");
 const sr=audioBuffer.sampleRate,ch=audioBuffer.numberOfChannels;
 let start=Math.max(0,+$("#start").value||0),end=Math.min(audioBuffer.duration,+$("#end").value||audioBuffer.duration);
 if(end<=start)throw Error("End must be after start");
 const out=audioCtx.createBuffer(ch,Math.floor((end-start)*sr),sr);
 const fi=Math.floor((+$("#fadeIn").value||0)*sr),fo=Math.floor((+$("#fadeOut").value||0)*sr);
 for(let c=0;c<ch;c++){
  const src=audioBuffer.getChannelData(c),dst=out.getChannelData(c),base=Math.floor(start*sr);
  for(let i=0;i<dst.length;i++){
   let gain=1;if(fi&&i<fi)gain*=i/fi;if(fo&&i>dst.length-fo)gain*=Math.max(0,(dst.length-i)/fo);
   dst[i]=src[base+i]*gain;
  }
 }
 return out;
}
function wavBlob(b){
 const ch=b.numberOfChannels,sr=b.sampleRate,len=b.length,ab=new ArrayBuffer(44+len*ch*2),v=new DataView(ab);
 const str=(o,s)=>[...s].forEach((x,i)=>v.setUint8(o+i,x.charCodeAt(0)));
 str(0,"RIFF");v.setUint32(4,36+len*ch*2,true);str(8,"WAVE");str(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,sr,true);v.setUint32(28,sr*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);str(36,"data");v.setUint32(40,len*ch*2,true);
 let o=44;for(let i=0;i<len;i++)for(let c=0;c<ch;c++){let x=Math.max(-1,Math.min(1,b.getChannelData(c)[i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2}return new Blob([ab],{type:"audio/wav"});
}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

$("#exportWav").onclick=async()=>{
 try{status("Rendering WAV…");progress(30);download(wavBlob(await getTrimmedBuffer()),"creatorlab-edited.wav");progress(100);status("WAV exported.");setTimeout(()=>progress(0),700)}
 catch(e){status(e.message)}
};

$("#exportMp3").onclick=async()=>{
 try{
  if(!file)return;
  status("Loading MP3 encoder…");progress(10);
  if(!ffmpeg){
   ffmpeg=new FFmpegWASM.FFmpeg();
   ffmpeg.on("progress",({progress:p})=>progress(20+p*75));
   await ffmpeg.load({coreURL:"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",wasmURL:"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm"});
  }
  status("Encoding MP3…");await ffmpeg.writeFile("input."+((file.name.split(".").pop()||"wav").toLowerCase()),new Uint8Array(await file.arrayBuffer()));
  const ext=(file.name.split(".").pop()||"wav").toLowerCase();
  const input="input."+ext, bitrate=$("#bitrate").value;
  const start=+$("#start").value||0,end=+$("#end").value||0,fadeIn=+$("#fadeIn").value||0,fadeOut=+$("#fadeOut").value||0;
  const filters=[];
  if(end>start)filters.push(`atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS`);
  if(fadeIn>0)filters.push(`afade=t=in:st=0:d=${fadeIn}`);
  if(fadeOut>0&&end>start)filters.push(`afade=t=out:st=${Math.max(0,end-start-fadeOut)}:d=${fadeOut}`);
  const speed=+$("#speed").value;if(speed!==1)filters.push(`atempo=${speed}`);
  const bass=+$("#bass").value,treble=+$("#treble").value;
  if(bass)filters.push(`bass=g=${bass}`);
  if(treble)filters.push(`treble=g=${treble}`);
  const rev=+$("#reverb").value;if(rev)filters.push(`aecho=0.8:0.9:${Math.round(80+rev*3)}:${Math.min(.8,rev/125)}`);
  const args=["-i",input];if(filters.length)args.push("-af",filters.join(","));
  args.push("-b:a",bitrate+"k","-y","output.mp3");
  await ffmpeg.exec(args);const data=await ffmpeg.readFile("output.mp3");
  download(new Blob([data.buffer],{type:"audio/mpeg"}),"creatorlab-"+bitrate+"kbps.mp3");
  progress(100);status(`MP3 exported at ${bitrate} kbps.`);setTimeout(()=>progress(0),800);
 }catch(e){console.error(e);status("MP3 export failed. Check console/network/CDN access.")}
};
