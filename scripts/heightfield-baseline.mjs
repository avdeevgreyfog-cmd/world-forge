const W=512,H=320,ASPECT=W/H;
const settings={frequency:4,octaves:6,persistence:.52,redistribution:1.05,sea:.5};
const seed=481726;

function hash2(x,y,seedValue){let h=Math.imul(x^seedValue,374761393)+Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
const fade=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=v=>Math.max(0,Math.min(1,v));
const wrap=(v,n)=>((v%n)+n)%n;
function gradientNoise(x,y,seedValue,periodX){const xi=Math.floor(x),yi=Math.floor(y),tx=x-xi,ty=y-yi;const dot=(gx,gy,dx,dy)=>{const angle=hash2(wrap(gx,periodX),gy,seedValue)*Math.PI*2;return Math.cos(angle)*dx+Math.sin(angle)*dy};const u=fade(tx),v=fade(ty);return mix(mix(dot(xi,yi,tx,ty),dot(xi+1,yi,tx-1,ty),u),mix(dot(xi,yi+1,tx,ty-1),dot(xi+1,yi+1,tx-1,ty-1),u),v)*1.42}
function fractalNoise(nx,ny,seedValue,s){let value=0,amplitude=1,total=0,frequency=s.frequency;for(let octave=0;octave<s.octaves;octave++){value+=gradientNoise(nx*frequency,ny*frequency/ASPECT,seedValue+octave*1013,Math.max(1,Math.round(frequency)))*amplitude;total+=amplitude;amplitude*=s.persistence;frequency*=2}return value/total}
function generate(seedValue,s){const values=new Float32Array(W*H);let min=1,max=0,sum=0,land=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const nx=x/(W-1),ny=y/(H-1),raw=.5+fractalNoise(nx,ny,seedValue,s)*.5,elevation=clamp(Math.pow(clamp(raw),s.redistribution)),i=y*W+x;values[i]=elevation;min=Math.min(min,elevation);max=Math.max(max,elevation);sum+=elevation;if(elevation>=s.sea)land++}return{values,min,max,mean:sum/values.length,land:Math.round(land/values.length*100)}}
function checksum(values){let hash=2166136261>>>0;const bytes=new Uint8Array(values.buffer,values.byteOffset,values.byteLength);for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0;return hash>>>0}
const field=generate(seed,settings);let seam=0;for(let y=0;y<H;y++)seam=Math.max(seam,Math.abs(field.values[y*W]-field.values[y*W+W-1]));
const actual={checksum:checksum(field.values),land:field.land,min:field.min,max:field.max,mean:field.mean,seam};
const expected={checksum:1471391727,land:31,min:0.2056825608210136,max:0.7265650219086217,mean:0.46266782064842815,seam:0};
const epsilon=1e-12;
const ok=actual.checksum===expected.checksum&&actual.land===expected.land&&Math.abs(actual.min-expected.min)<epsilon&&Math.abs(actual.max-expected.max)<epsilon&&Math.abs(actual.mean-expected.mean)<epsilon&&actual.seam===expected.seam;
console.log(JSON.stringify({ok,actual,expected},null,2));
if(!ok)process.exit(1);
