const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)};
const titles={dashboard:"Dashboard",audio:"Audio Lab",seo:"YouTube SEO",visualizer:"Visualizer",tools:"Quick Tools"};

function openTab(id){$$(".tab").forEach(x=>x.classList.toggle("active",x.id===id));$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));$("#pageTitle").textContent=titles[id]}
$$(".nav-item").forEach(b=>b.onclick=()=>openTab(b.dataset.tab));
$$("[data-open]").forEach(b=>b.onclick=()=>openTab(b.dataset.open));

$("#themeBtn").onclick=()=>document.body.classList.toggle("light");

const player=$("#audioPlayer"), fileInput=$("#audioFile");
fileInput.onchange=e=>loadAudio(e.target.files[0]);
$("#dropzone").ondragover=e=>{e.preventDefault();$("#dropzone").style.borderColor="#fff"};
$("#dropzone").ondragleave=()=>$("#dropzone").style.borderColor="";
$("#dropzone").ondrop=e=>{e.preventDefault();$("#dropzone").style.borderColor="";loadAudio(e.dataTransfer.files[0])};
function loadAudio(file){
  if(!file)return;
  if(!file.type.startsWith("audio/"))return toast("Please choose an audio file.");
  player.src=URL.createObjectURL(file);player.classList.remove("hidden");
  $("#audioInfo").textContent=`${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`;
  $("#audioInfo").classList.remove("hidden");
  player.onloadedmetadata=()=>{$("#trimEnd").value=player.duration.toFixed(2);$("#endOut").value=player.duration.toFixed(2)};
}
$("#speed").oninput=e=>{player.playbackRate=+e.target.value;$("#speedOut").value=(+e.target.value).toFixed(2)+"×"};
$("#volume").oninput=e=>{player.volume=+e.target.value;$("#volumeOut").value=Math.round(+e.target.value*100)+"%"};
$("#trimStart").oninput=e=>$("#startOut").value=e.target.value;
$("#trimEnd").oninput=e=>$("#endOut").value=e.target.value;
$("#playBtn").onclick=()=>player.paused?player.play():player.pause();

$("#downloadClip").onclick=async()=>{
 if(!player.src)return toast("Load an audio file first.");
 const start=Math.max(0,+$("#trimStart").value||0), end=Math.min(player.duration,+$("#trimEnd").value||player.duration);
 if(end<=start)return toast("Trim end must be after start.");
 const AudioCtx=window.AudioContext||window.webkitAudioContext;
 try{
   const res=await fetch(player.src), buf=await res.arrayBuffer(), ctx=new AudioCtx(), decoded=await ctx.decodeAudioData(buf);
   const s=Math.floor(start*decoded.sampleRate), e=Math.floor(end*decoded.sampleRate), len=e-s;
   const out=ctx.createBuffer(decoded.numberOfChannels,len,decoded.sampleRate);
   for(let ch=0;ch<decoded.numberOfChannels;ch++)out.copyToChannel(decoded.getChannelData(ch).slice(s,e),ch);
   const wav=encodeWav(out), blob=new Blob([wav],{type:"audio/wav"}), a=document.createElement("a");
   a.href=URL.createObjectURL(blob);a.download="creatorlab-clip.wav";a.click();URL.revokeObjectURL(a.href);toast("WAV exported.");
 }catch(err){toast("Export failed in this browser.")}
};
function encodeWav(buffer){
 const channels=buffer.numberOfChannels, rate=buffer.sampleRate, len=buffer.length, dataLen=len*channels*2;
 const ab=new ArrayBuffer(44+dataLen),v=new DataView(ab);
 const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
 str(0,"RIFF");v.setUint32(4,36+dataLen,true);str(8,"WAVE");str(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,"data");v.setUint32(40,dataLen,true);
 let o=44;for(let i=0;i<len;i++)for(let c=0;c<channels;c++){let x=Math.max(-1,Math.min(1,buffer.getChannelData(c)[i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2}return ab;
}

$("#generateSeo").onclick=()=>{
 const song=$("#songName").value.trim()||"Your Song",artist=$("#artistName").value.trim()||"Artist",style=$("#styleName").value.trim()||"slow reverb";
 const clean=style.split(",").map(x=>x.trim()).filter(Boolean);
 $("#seoTitle").value=`${song} - ${artist} | ${clean[0]||"Slowed + Reverb"} ✦`;
 $("#seoDesc").value=`${song} by ${artist} — ${style}.\\n\\nListen with headphones for the best experience.\\n\\n#${song.replace(/\\s+/g,"")} #${artist.replace(/\\s+/g,"")} #slowedandreverb #music`;
 $("#seoTags").value=[song,artist,...clean,"slowed reverb","slowed and reverb","music","night drive","phonk","lofi","edit audio"].join(", ");
 toast("SEO pack generated.");
};
$$("[data-copy-target]").forEach(b=>b.onclick=()=>{navigator.clipboard.writeText($("#"+b.dataset.copyTarget).value);toast("Copied.")});

$("#counterText").oninput=e=>{const v=e.target.value;$("#countResult").textContent=`${v.length} characters · ${v.trim()?v.trim().split(/\\s+/).length:0} words`};
$("#ratioBtn").onclick=()=>{let w=+$("#ratioW").value,h=+$("#ratioH").value;if(!w||!h)return toast("Enter width and height.");const g=(a,b)=>b?g(b,a%b):a,d=g(w,h);$("#ratioResult").textContent=`${w/d}:${h/d}  •  ${(w/h).toFixed(3)} ratio`};
$("#jsonBtn").onclick=()=>{try{$("#jsonInput").value=JSON.stringify(JSON.parse($("#jsonInput").value),null,2);toast("JSON formatted.")}catch{toast("Invalid JSON.")}};
$("#timestampBtn").onclick=()=>{const n=+$("#timestampInput").value;if(!n)return toast("Enter a timestamp.");$("#timestampResult").textContent=new Date(n*1000).toLocaleString()};

let visualAudio=$("#visualAudio"), analyser, anim, sourceNode;
$("#visualFile").onchange=e=>{const f=e.target.files[0];if(!f)return;visualAudio.src=URL.createObjectURL(f);visualAudio.classList.remove("hidden");setupVisualizer()};
$("#visualPlay").onclick=()=>visualAudio.paused?visualAudio.play():visualAudio.pause();
function setupVisualizer(){
 if(sourceNode)return;
 const ctx=new (window.AudioContext||window.webkitAudioContext)();analyser=ctx.createAnalyser();analyser.fftSize=256;
 sourceNode=ctx.createMediaElementSource(visualAudio);sourceNode.connect(analyser);analyser.connect(ctx.destination);
 draw();
}
function draw(){
 const c=$("#visualCanvas"),x=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
 c.width=w*dpr;c.height=h*dpr;x.scale(dpr,dpr);const data=new Uint8Array(analyser.frequencyBinCount);
 function frame(){anim=requestAnimationFrame(frame);analyser.getByteFrequencyData(data);x.clearRect(0,0,w,h);x.strokeStyle="rgba(255,255,255,.12)";x.beginPath();x.moveTo(0,h/2);x.lineTo(w,h/2);x.stroke();const bw=w/data.length*1.5;data.forEach((v,i)=>{const bh=(v/255)*h*.8;x.fillStyle=`hsl(${i/data.length*360},70%,65%)`;x.fillRect(i*bw,h/2-bh/2,bw-2,bh)});}
 frame();
}
