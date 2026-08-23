"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";

const W=512,H=320,ASPECT=W/H;
type Mode="height"|"mask";
type Settings={frequency:number;octaves:number;persistence:number;redistribution:number;sea:number};
type HeightField={values:Float32Array;histogram:number[];min:number;max:number;mean:number;land:number};

function hash2(x:number,y:number,seed:number){let h=Math.imul(x^seed,374761393)+Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
const fade=(t:number)=>t*t*t*(t*(t*6-15)+10),mix=(a:number,b:number,t:number)=>a+(b-a)*t,clamp=(v:number)=>Math.max(0,Math.min(1,v));
const wrap=(v:number,n:number)=>((v%n)+n)%n;

type RGB=[number,number,number];
const OCEAN_COLORS:RGB[]=[[44,46,73],[66,75,130],[79,106,184],[100,143,190],[131,181,206],[162,221,225]];
const LAND_COLORS:RGB[]=[[58,142,98],[67,152,75],[102,162,78],[134,170,84],[162,177,89],[185,176,94],[192,163,104],[211,175,145],[232,203,194],[249,245,244]];
function bandColor(colors:RGB[],t:number):RGB{return colors[Math.min(colors.length-1,Math.floor(clamp(t)*colors.length))]}
function reliefColor(h:number,sea:number,min:number,max:number):RGB{return h<sea?bandColor(OCEAN_COLORS,(h-min)/Math.max(.001,sea-min)):bandColor(LAND_COLORS,(h-sea)/Math.max(.001,max-sea))}

function gradientNoise(x:number,y:number,seed:number,periodX:number){
  const xi=Math.floor(x),yi=Math.floor(y),tx=x-xi,ty=y-yi;
  const dot=(gx:number,gy:number,dx:number,dy:number)=>{const angle=hash2(wrap(gx,periodX),gy,seed)*Math.PI*2;return Math.cos(angle)*dx+Math.sin(angle)*dy};
  const u=fade(tx),v=fade(ty);
  return mix(mix(dot(xi,yi,tx,ty),dot(xi+1,yi,tx-1,ty),u),mix(dot(xi,yi+1,tx,ty-1),dot(xi+1,yi+1,tx-1,ty-1),u),v)*1.42;
}

function fractalNoise(nx:number,ny:number,seed:number,s:Settings){
  let value=0,amplitude=1,total=0,frequency=s.frequency;
  for(let octave=0;octave<s.octaves;octave++){
    value+=gradientNoise(nx*frequency,ny*frequency/ASPECT,seed+octave*1013,Math.max(1,Math.round(frequency)))*amplitude;
    total+=amplitude;amplitude*=s.persistence;frequency*=2;
  }
  return value/total;
}

function generate(seed:number,s:Settings):HeightField{
  const values=new Float32Array(W*H),histogram=Array(24).fill(0);let min=1,max=0,sum=0,land=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const nx=x/(W-1),ny=y/(H-1),raw=.5+fractalNoise(nx,ny,seed,s)*.5,elevation=clamp(Math.pow(clamp(raw),s.redistribution)),i=y*W+x;
    values[i]=elevation;min=Math.min(min,elevation);max=Math.max(max,elevation);sum+=elevation;if(elevation>=s.sea)land++;histogram[Math.min(23,Math.floor(elevation*24))]++;
  }
  const peak=Math.max(...histogram);return{values,histogram:histogram.map(v=>v/peak),min,max,mean:sum/values.length,land:Math.round(land/values.length*100)};
}

export default function Home(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [seed,setSeed]=useState(481726),[seedInput,setSeedInput]=useState("481726"),[mode,setMode]=useState<Mode>("height"),[vectors,setVectors]=useState(false),[busy,setBusy]=useState(false),[probe,setProbe]=useState<{x:number;y:number;h:number}|null>(null);
  const [settings,setSettings]=useState<Settings>({frequency:4,octaves:6,persistence:.52,redistribution:1.05,sea:.5});
  const field=useMemo(()=>generate(seed,settings),[seed,settings]);
  useEffect(()=>{setBusy(true);const t=window.setTimeout(()=>setBusy(false),80);return()=>window.clearTimeout(t)},[field]);

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;canvas.width=W*2;canvas.height=H*2;const ctx=canvas.getContext("2d");if(!ctx)return;
    const off=document.createElement("canvas");off.width=W;off.height=H;const ox=off.getContext("2d")!,img=ox.createImageData(W,H);
    for(let i=0;i<field.values.length;i++){
      const h=field.values[i],x=i%W,y=Math.floor(i/W);let r:number,g:number,b:number;
      if(mode==="height"){[r,g,b]=reliefColor(h,settings.sea,field.min,field.max)}else if(h>=settings.sea){r=222;g=213;b=190}else{r=12;g=45;b=64}
      const p=i*4;img.data[p]=r;img.data[p+1]=g;img.data[p+2]=b;img.data[p+3]=255;
    }
    ox.putImageData(img,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(off,0,0,canvas.width,canvas.height);
    if(vectors&&mode==="height"){
      const f=settings.frequency,stepX=canvas.width/f,stepY=stepX;ctx.lineWidth=1.5;ctx.strokeStyle="rgba(230,111,61,.82)";ctx.fillStyle="rgba(230,111,61,.9)";
      for(let gy=0;gy<=Math.ceil(canvas.height/stepY);gy++)for(let gx=0;gx<f;gx++){const a=hash2(gx,gy,seed)*Math.PI*2,cx=gx*stepX,cy=gy*stepY,len=Math.min(28,stepX*.2),ex=cx+Math.cos(a)*len,ey=cy+Math.sin(a)*len;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,2.5,0,Math.PI*2);ctx.fill()}
    }
  },[field,mode,settings.sea,settings.frequency,vectors,seed]);
  useEffect(()=>draw(),[draw]);

  const randomize=()=>{const n=Math.floor(Math.random()*999999);setSeed(n);setSeedInput(String(n))};
  const applySeed=()=>{const n=Math.abs(Number(seedInput)||1)%1000000;setSeed(n);setSeedInput(String(n))};
  const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(s=>({...s,[key]:value}));
  const inspect=(e:React.MouseEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(W-1,Math.floor((e.clientX-r.left)/r.width*W))),y=Math.max(0,Math.min(H-1,Math.floor((e.clientY-r.top)/r.height*H)));setProbe({x,y,h:field.values[y*W+x]})};
  const download=()=>{const a=document.createElement("a");a.download=`heightmap-${seed}.png`;a.href=canvasRef.current?.toDataURL("image/png")||"";a.click()};

  return <main className="app-shell height-lab">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">W</div><div><strong>World Forge</strong><span>лаборатория миров</span></div></div>
      <div className="side-section"><p className="side-label">ЭТАПЫ МИРА</p><button className="nav-button active"><span>01</span>Карта высот</button>{["Суша и океаны","Рельеф","Климат","Гидрология","Биомы"].map((x,i)=><button key={x} className="nav-button locked" disabled><span>{String(i+2).padStart(2,"0")}</span>{x}</button>)}</div>
      <div className="version-card"><span>Сейчас</span><strong>Только высоты</strong><small>Следующий этап закрыт, пока базовое поле не даёт убедительный результат.</small><div><i style={{width:"14%"}}/></div></div>
    </aside>
    <section className="workspace"><header className="topbar"><div><p className="eyebrow">ЭТАП 01</p><h1>Генерация карты высот <span>v0.7</span></h1></div><div className="top-actions"><button className="ghost-button" onClick={download}>Скачать PNG</button><button className="primary-button" onClick={randomize}>Новый seed</button></div></header>
      <div className="height-layout"><section className="map-card height-card"><div className="map-toolbar"><div className="seed-control"><span>SEED</span><input aria-label="Seed карты высот" value={seedInput} onChange={e=>setSeedInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&applySeed()}/><button onClick={applySeed}>Применить</button></div><div className="mode-switch"><button className={mode==="height"?"active":""} onClick={()=>setMode("height")}>Цветные высоты</button><button className={mode==="mask"?"active":""} onClick={()=>setMode("mask")}>Суша / море</button></div></div>
        <div className={`height-canvas ${busy?"loading":""}`}><canvas ref={canvasRef} onMouseMove={inspect} onMouseLeave={()=>setProbe(null)} aria-label="Процедурная карта высот"/>{probe&&<div className="height-probe"><strong>{probe.h>=settings.sea?"Суша":"Море"}</strong><span>x {probe.x} · y {probe.y}</span><span>Высота {probe.h.toFixed(3)}</span></div>}<div className="height-key">{mode==="height"?<><span>глубоко</span><i className="ocean-scale"/><em>берег</em><i className="land-scale"/><span>высоко</span></>:<><span>море</span><i className="mask-scale"/><span>суша</span></>}<b>{settings.sea.toFixed(2)}</b></div></div>
        <div className="histogram"><div>{field.histogram.map((v,i)=><i key={i} style={{height:`${Math.max(2,v*42)}px`}} className={i/24>=settings.sea?"land":"sea"}/>)}</div><span>Распределение значений высоты</span></div>
      </section>
      <aside className="control-panel height-controls"><div className="panel-head"><div><p className="eyebrow">ПАРАМЕТРЫ ШУМА</p><h2>Базовое поле</h2></div><span>512 × 320</span></div>
        <Control label="Размер базовой сетки" value={`${settings.frequency} ячейки`} min={2} max={9} step={1} n={settings.frequency} set={v=>update("frequency",v)}/><Control label="Количество октав" value={String(settings.octaves)} min={1} max={8} step={1} n={settings.octaves} set={v=>update("octaves",v)}/><Control label="Вклад мелких деталей" value={settings.persistence.toFixed(2)} min={.3} max={.72} step={.01} n={settings.persistence} set={v=>update("persistence",v)}/><Control label="Перераспределение высот" value={settings.redistribution.toFixed(2)} min={.65} max={1.55} step={.01} n={settings.redistribution} set={v=>update("redistribution",v)}/><Control label="Уровень моря" value={settings.sea.toFixed(2)} min={.3} max={.7} step={.01} n={settings.sea} set={v=>update("sea",v)}/>
        <label className="vector-toggle"><input type="checkbox" checked={vectors} onChange={e=>setVectors(e.target.checked)}/><span/><div><strong>Показать случайные векторы</strong><small>Стрелки базовой градиентной сетки, из которых интерполируется поле.</small></div></label>
        <div className="height-stats"><div><span>Суша</span><strong>{field.land}%</strong></div><div><span>Минимум</span><strong>{field.min.toFixed(2)}</strong></div><div><span>Среднее</span><strong>{field.mean.toFixed(2)}</strong></div><div><span>Максимум</span><strong>{field.max.toFixed(2)}</strong></div></div>
        <div className="info-callout"><span>i</span><p>Поле разбито на 6 уровней глубины и 10 уровней суши. Каждый диапазон получает один цвет без смешивания: от тёмно-синих впадин к светлому шельфу, затем от зелёных низменностей к охристым горам и белым вершинам.</p></div>
      </aside></div>
    </section>
  </main>
}

function Control({label,value,min,max,step,n,set}:{label:string;value:string;min:number;max:number;step:number;n:number;set:(v:number)=>void}){return <label className="range-block compact"><div><span>{label}</span><strong>{value}</strong></div><input type="range" min={min} max={max} step={step} value={n} onChange={e=>set(Number(e.target.value))}/></label>}
