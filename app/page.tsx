"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {generate,hash2,reliefColor,type GeneratorMode,type HeightField,type HeightSettings as Settings,type MapScope} from "../lib/heightfield/core";
import {analyzeLandmasses} from "../lib/heightfield/analysis";

type Mode="height"|"mask";
type Quality="draft"|"sharp";
const RESOLUTIONS:Record<Quality,{width:number;height:number;label:string}>={
  draft:{width:512,height:320,label:"512 × 320"},
  sharp:{width:768,height:480,label:"768 × 480"},
};

export default function Home(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [seed,setSeed]=useState(481726),[seedInput,setSeedInput]=useState("481726"),[mode,setMode]=useState<Mode>("height"),[generatorMode,setGeneratorMode]=useState<GeneratorMode>("balanced"),[scope,setScope]=useState<MapScope>("world"),[quality,setQuality]=useState<Quality>("sharp"),[vectors,setVectors]=useState(false),[busy,setBusy]=useState(false),[probe,setProbe]=useState<{x:number;y:number;h:number}|null>(null);
  const [settings,setSettings]=useState<Settings>({frequency:4,octaves:6,persistence:.52,redistribution:1.05,sea:.5});
  const resolution=RESOLUTIONS[quality];
  const field:HeightField=useMemo(()=>generate(seed,settings,generatorMode,scope,resolution.width,resolution.height),[seed,settings,generatorMode,scope,resolution.width,resolution.height]);
  const landAnalysis=useMemo(()=>analyzeLandmasses(field,settings.sea),[field,settings.sea]);
  useEffect(()=>{setBusy(true);const t=window.setTimeout(()=>setBusy(false),90);return()=>window.clearTimeout(t)},[field]);

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    canvas.width=field.width;canvas.height=field.height;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const img=ctx.createImageData(field.width,field.height);
    for(let i=0;i<field.values.length;i++){
      const h=field.values[i];let r:number,g:number,b:number;
      if(mode==="height"){[r,g,b]=reliefColor(h,settings.sea,field.min,field.max)}else if(h>=settings.sea){r=222;g=213;b=190}else{r=12;g=45;b=64}
      const p=i*4;img.data[p]=r;img.data[p+1]=g;img.data[p+2]=b;img.data[p+3]=255;
    }
    ctx.putImageData(img,0,0);
    if(vectors&&mode==="height"&&generatorMode==="legacy"){
      const f=settings.frequency,stepX=canvas.width/f,stepY=stepX;ctx.lineWidth=Math.max(1,canvas.width/680);ctx.strokeStyle="rgba(230,111,61,.82)";ctx.fillStyle="rgba(230,111,61,.9)";
      for(let gy=0;gy<=Math.ceil(canvas.height/stepY);gy++)for(let gx=0;gx<f;gx++){const a=hash2(gx,gy,seed)*Math.PI*2,cx=gx*stepX,cy=gy*stepY,len=Math.min(canvas.width*.028,stepX*.2),ex=cx+Math.cos(a)*len,ey=cy+Math.sin(a)*len;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,Math.max(2,canvas.width/410),0,Math.PI*2);ctx.fill()}
    }
  },[field,mode,settings.sea,settings.frequency,vectors,seed,generatorMode]);
  useEffect(()=>draw(),[draw]);

  const randomize=()=>{const n=Math.floor(Math.random()*999999);setSeed(n);setSeedInput(String(n))};
  const applySeed=()=>{const n=Math.abs(Number(seedInput)||1)%1000000;setSeed(n);setSeedInput(String(n))};
  const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(s=>({...s,[key]:value}));
  const inspect=(e:React.MouseEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(field.width-1,Math.floor((e.clientX-r.left)/r.width*field.width))),y=Math.max(0,Math.min(field.height-1,Math.floor((e.clientY-r.top)/r.height*field.height)));setProbe({x,y,h:field.values[y*field.width+x]})};
  const download=()=>{const a=document.createElement("a");a.download=`heightmap-${generatorMode}-${scope}-${quality}-${seed}.png`;a.href=canvasRef.current?.toDataURL("image/png")||"";a.click()};
  const setAlgorithm=(next:GeneratorMode)=>{setGeneratorMode(next);if(next==="balanced")setVectors(false)};
  const worldBalanced=generatorMode==="balanced"&&scope==="world";

  return <main className="app-shell height-lab">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">W</div><div><strong>World Forge</strong><span>лаборатория миров</span></div></div>
      <div className="side-section"><p className="side-label">ЭТАПЫ МИРА</p><button className="nav-button active"><span>01</span>Карта высот</button>{["Суша и океаны","Рельеф","Климат","Гидрология","Биомы"].map((x,i)=><button key={x} className="nav-button locked" disabled><span>{String(i+2).padStart(2,"0")}</span>{x}</button>)}</div>
      <div className="version-card"><span>Эксперимент</span><strong>Balanced heightfield</strong><small>Ищем средний вариант между шумным Legacy и слишком крупным Macro. Следующие этапы по-прежнему закрыты.</small><div><i style={{width:"17%"}}/></div></div>
    </aside>
    <section className="workspace"><header className="topbar"><div><p className="eyebrow">ЭТАП 01</p><h1>Генерация карты высот <span>v0.7.3 preview</span></h1></div><div className="top-actions"><button className="ghost-button" onClick={download}>Скачать PNG</button><button className="primary-button" onClick={randomize}>Новый seed</button></div></header>
      <div className="height-layout"><section className="map-card height-card"><div className="map-toolbar"><div className="seed-control"><span>SEED</span><input aria-label="Seed карты высот" value={seedInput} onChange={e=>setSeedInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&applySeed()}/><button onClick={applySeed}>Применить</button></div><div className="map-context"><span>{generatorMode==="legacy"?"Legacy":scope==="world"?"Весь мир":"Материк"}</span><i/><b>{field.width} × {field.height}</b></div><div className="mode-switch"><button className={mode==="height"?"active":""} onClick={()=>setMode("height")}>Цветные высоты</button><button className={mode==="mask"?"active":""} onClick={()=>setMode("mask")}>Суша / море</button></div></div>
        <div className={`height-canvas ${busy?"loading":""}`}><canvas ref={canvasRef} onMouseMove={inspect} onMouseLeave={()=>setProbe(null)} aria-label="Процедурная карта высот"/>{probe&&<div className="height-probe"><strong>{probe.h>=settings.sea?"Суша":"Море"}</strong><span>x {probe.x} · y {probe.y}</span><span>Высота {probe.h.toFixed(3)}</span></div>}<div className="height-key">{mode==="height"?<><span>глубоко</span><i className="ocean-scale"/><em>берег</em><i className="land-scale"/><span>высоко</span></>:<><span>море</span><i className="mask-scale"/><span>суша</span></>}<b>{settings.sea.toFixed(2)}</b></div>{worldBalanced&&<div className="seam-note">Океанический шов центрирован · сдвиг {field.seamShift}px</div>}</div>
        <div className="histogram"><div>{field.histogram.map((v,i)=><i key={i} style={{height:`${Math.max(2,v*42)}px`}} className={i/24>=settings.sea?"land":"sea"}/>)}</div><span>Распределение значений высоты</span></div>
      </section>
      <aside className="control-panel height-controls"><div className="panel-head"><div><p className="eyebrow">ГЕНЕРАЦИЯ</p><h2>Поле высот</h2></div><span>{resolution.label}</span></div>
        <div className="scope-control"><div><span>Масштаб карты</span><small>{generatorMode==="legacy"?"Для Legacy используется исходный режим v0.7.":scope==="world"?"Полный мир: карта разворачивается океаном по бокам.":"Локальный масштаб: суша может уходить за границы кадра."}</small></div><div className="scope-switch"><button disabled={generatorMode==="legacy"} className={scope==="world"&&generatorMode!=="legacy"?"active":""} onClick={()=>setScope("world")}>Весь мир</button><button disabled={generatorMode==="legacy"} className={scope==="continent"&&generatorMode!=="legacy"?"active":""} onClick={()=>setScope("continent")}>Материк</button></div></div>
        <div className="algorithm-control"><div><span>Алгоритм</span><small>Legacy оставлен как контрольная точка.</small></div><div className="algorithm-switch"><button className={generatorMode==="legacy"?"active":""} onClick={()=>setAlgorithm("legacy")}>v0.7 Legacy</button><button className={generatorMode==="balanced"?"active":""} onClick={()=>setAlgorithm("balanced")}>Balanced</button></div></div>
        <div className="quality-control"><div><span>Качество расчёта</span><small>Меняется количество реально рассчитанных точек, а не масштаб готовой картинки.</small></div><div className="quality-switch"><button className={quality==="draft"?"active":""} onClick={()=>setQuality("draft")}>Быстро · 512×320</button><button className={quality==="sharp"?"active":""} onClick={()=>setQuality("sharp")}>Чётко · 768×480</button></div></div>
        <Control disabled={generatorMode==="balanced"} label="Размер базовой сетки" value={`${settings.frequency} ячейки`} min={2} max={9} step={1} n={settings.frequency} set={v=>update("frequency",v)}/><Control disabled={generatorMode==="balanced"} label="Количество октав" value={String(settings.octaves)} min={1} max={8} step={1} n={settings.octaves} set={v=>update("octaves",v)}/><Control disabled={generatorMode==="balanced"} label="Вклад мелких деталей" value={settings.persistence.toFixed(2)} min={.3} max={.72} step={.01} n={settings.persistence} set={v=>update("persistence",v)}/><Control label="Перераспределение высот" value={settings.redistribution.toFixed(2)} min={.65} max={1.55} step={.01} n={settings.redistribution} set={v=>update("redistribution",v)}/><Control label="Уровень моря" value={settings.sea.toFixed(2)} min={.3} max={.7} step={.01} n={settings.sea} set={v=>update("sea",v)}/>
        <label className={`vector-toggle ${generatorMode==="balanced"?"disabled":""}`}><input type="checkbox" disabled={generatorMode==="balanced"} checked={vectors} onChange={e=>setVectors(e.target.checked)}/><span/><div><strong>Показать случайные векторы</strong><small>{generatorMode==="balanced"?"Balanced использует несколько полей разных масштабов; одна сетка уже не описывает алгоритм.":"Стрелки исходной градиентной сетки v0.7."}</small></div></label>
        <div className="height-stats"><div><span>Суша</span><strong>{field.land}%</strong></div><div><span>Минимум</span><strong>{field.min.toFixed(2)}</strong></div><div><span>Среднее</span><strong>{field.mean.toFixed(2)}</strong></div><div><span>Максимум</span><strong>{field.max.toFixed(2)}</strong></div></div>
        <div className="qa-stats"><div><span>Крупных массивов</span><strong>{landAnalysis.majorLandmasses}</strong></div><div><span>Крупнейший</span><strong>{Math.round(landAnalysis.largestShare*100)}%</strong></div><div><span>Второй</span><strong>{Math.round(landAnalysis.secondShare*100)}%</strong></div><div><span>Мелкие острова</span><strong>{Math.round(landAnalysis.smallIslandsShare*100)}%</strong></div></div>
        <div className="info-callout"><span>i</span><p>{generatorMode==="balanced"?(scope==="world"?"Balanced World: крупный каркас стал мельче, чем в предыдущем Macro, берег сохраняет региональную неровность, мелкий шум около воды подавлен, а океанические глубины строятся более крупными бассейнами. Карта автоматически поворачивается так, чтобы наиболее океанический шов оказался по бокам.":"Balanced Continent: макроформы крупнее относительно кадра, региональная и локальная структура усилены, поэтому суша может продолжаться за границами изображения."):"Legacy — исходный алгоритм v0.7 без изменения геометрии."}</p></div>
      </aside></div>
    </section>
  </main>
}

function Control({label,value,min,max,step,n,set,disabled=false}:{label:string;value:string;min:number;max:number;step:number;n:number;set:(v:number)=>void;disabled?:boolean}){return <label className={`range-block compact ${disabled?"disabled":""}`}><div><span>{label}</span><strong>{value}</strong></div><input disabled={disabled} type="range" min={min} max={max} step={step} value={n} onChange={e=>set(Number(e.target.value))}/></label>}
