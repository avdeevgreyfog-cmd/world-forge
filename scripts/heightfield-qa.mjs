// Batch QA runner for the current v0.7 algorithm.
// This intentionally mirrors the legacy generator so baseline statistics can be tracked
// before the macrogeometry algorithm is changed.
const W=256,H=160,ASPECT=W/H;
const settings={frequency:4,octaves:6,persistence:.52,redistribution:1.05,sea:.5};
const clamp=v=>Math.max(0,Math.min(1,v));
const fade=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const wrap=(v,n)=>((v%n)+n)%n;
function hash2(x,y,seed){let h=Math.imul(x^seed,374761393)+Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
function gradientNoise(x,y,seed,periodX){const xi=Math.floor(x),yi=Math.floor(y),tx=x-xi,ty=y-yi;const dot=(gx,gy,dx,dy)=>{const a=hash2(wrap(gx,periodX),gy,seed)*Math.PI*2;return Math.cos(a)*dx+Math.sin(a)*dy};const u=fade(tx),v=fade(ty);return mix(mix(dot(xi,yi,tx,ty),dot(xi+1,yi,tx-1,ty),u),mix(dot(xi,yi+1,tx,ty-1),dot(xi+1,yi+1,tx-1,ty-1),u),v)*1.42}
function fractalNoise(nx,ny,seed,s){let value=0,amplitude=1,total=0,frequency=s.frequency;for(let octave=0;octave<s.octaves;octave++){value+=gradientNoise(nx*frequency,ny*frequency/ASPECT,seed+octave*1013,Math.max(1,Math.round(frequency)))*amplitude;total+=amplitude;amplitude*=s.persistence;frequency*=2}return value/total}
function generate(seed,s){const values=new Float32Array(W*H);let land=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const raw=.5+fractalNoise(x/(W-1),y/(H-1),seed,s)*.5;const elevation=clamp(Math.pow(clamp(raw),s.redistribution));values[y*W+x]=elevation;if(elevation>=s.sea)land++}return{values,land:land/values.length}}
function analyze(values,sea){const visited=new Uint8Array(values.length),sizes=[];let totalLand=0;for(const v of values)if(v>=sea)totalLand++;const stack=[];const push=(x,y)=>{if(y<0||y>=H)return;const xx=wrap(x,W),i=y*W+xx;if(visited[i]||values[i]<sea)return;visited[i]=1;stack.push(i)};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const start=y*W+x;if(visited[start]||values[start]<sea)continue;visited[start]=1;stack.push(start);let size=0;while(stack.length){const i=stack.pop();size++;const cx=i%W,cy=Math.floor(i/W);push(cx-1,cy);push(cx+1,cy);push(cx,cy-1);push(cx,cy+1)}sizes.push(size)}sizes.sort((a,b)=>b-a);const threshold=totalLand*.02,major=sizes.filter(s=>s>=threshold),small=sizes.filter(s=>s<threshold).reduce((a,b)=>a+b,0);return{components:sizes.length,major:major.length,largest:(sizes[0]||0)/Math.max(1,totalLand),second:(sizes[1]||0)/Math.max(1,totalLand),small:small/Math.max(1,totalLand)}}
const rows=[];for(let seed=1000;seed<1100;seed++){const field=generate(seed,settings),a=analyze(field.values,settings.sea);rows.push({seed,land:field.land,...a})}
const median=values=>{const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const summary={sample:rows.length,landMedian:median(rows.map(r=>r.land)),componentsMedian:median(rows.map(r=>r.components)),majorMedian:median(rows.map(r=>r.major)),largestMedian:median(rows.map(r=>r.largest)),secondMedian:median(rows.map(r=>r.second)),smallMedian:median(rows.map(r=>r.small))};
console.log(JSON.stringify(summary,null,2));
