import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, Crosshair, MapPin, CloudRain, ShieldAlert } from 'lucide-react'
import { fetchDemoPrediction, VarshaNetraPrediction } from '@services/varshanetraApi'
import LeafletMap,{MapMarker} from '@components/maps/LeafletMap'

const regions = [
  { id:'assam', label:'Assam', lat:26.20, lon:92.90, color:'bg-emerald-400' },
  { id:'meghalaya', label:'Meghalaya', lat:25.50, lon:91.30, color:'bg-red-500' },
  { id:'manipur', label:'Manipur', lat:24.70, lon:93.90, color:'bg-amber-400' },
  { id:'mizoram', label:'Mizoram', lat:23.70, lon:92.70, color:'bg-emerald-400' },
]

export default function Home(){
  const navigate=useNavigate()
  const [selected,setSelected]=useState('assam'); const [p,setP]=useState<VarshaNetraPrediction|null>(null); const [playing,setPlaying]=useState(false); const [offset,setOffset]=useState(0)
  useEffect(()=>{fetchDemoPrediction(selected,3,6).then(setP).catch(()=>setP(null))},[selected])
  useEffect(()=>{if(!playing)return; const t=window.setInterval(()=>setOffset(v=>v>=72?0:v+12),700); return()=>window.clearInterval(t)},[playing])
  const selectedRegion=regions.find(r=>r.id===selected)!
  const markers:MapMarker[]=regions.map(r=>({id:r.id,label:r.label,lat:r.lat,lon:r.lon,rainfall:r.id===selected?(p?.rainfall_mm||0):0,warning:r.id===selected?(p?.warning_level||'GREEN'):'GREEN',flood:r.id===selected?(p?.flood_probability||0):0}))
  const timeline=useMemo(()=>[-24,-12,0,12,24,36,48,72],[ ])
  return <div className="relative h-full overflow-hidden bg-[#08141b]">
    <div className="absolute inset-0"><LeafletMap markers={markers} satellite /></div>
    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#07101a]/10 via-transparent to-[#07101a]/50" />
    <div className="absolute left-5 top-5 z-10 w-[340px] max-w-[calc(100%-40px)]">
      <div className="glass-control flex items-center gap-2 px-4 py-3"><MapPin className="w-4 h-4 text-status-info"/><input value={selectedRegion.label} readOnly className="bg-transparent outline-none text-sm w-full"/><span className="text-text-muted">⌄</span></div>
    </div>
    <div className="absolute top-5 right-5 z-10 glass-control px-4 py-2 text-xs font-mono flex items-center gap-2"><span>{new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>Live</div>
    <div className="absolute left-5 bottom-28 z-10 w-64 glass-panel p-4"><div className="flex items-center gap-2 mb-2"><ShieldAlert className="w-5 h-5 text-status-info"/><b>Current Status</b></div><p className="text-sm text-text-secondary">{p?`${p.warning_level} warning · ${p.rainfall_mm.toFixed(1)} mm rainfall forecast for ${selectedRegion.label}.`:'Loading model status...'}</p><button onClick={()=>navigate(`/alerts?region=${selected}`)} className="mt-3 text-xs text-status-info border border-status-info/40 rounded px-3 py-1.5">View Details</button></div>
    <button onClick={()=>{setSelected('assam');setOffset(0)}} aria-label="Recenter map" title="Recenter map" className="absolute right-5 bottom-28 z-10 glass-control p-2 hover:bg-surface-secondary"><Crosshair className="w-5 h-5 text-text-secondary"/></button>
    <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-20 w-[calc(100%-40px)] max-w-[1400px] glass-panel px-4 py-3"><div className="flex items-center gap-4"><button onClick={()=>setPlaying(v=>!v)} className="w-10 h-10 rounded-full bg-status-info text-surface-base flex items-center justify-center">{playing?<Pause className="w-5 h-5"/>:<Play className="w-5 h-5 ml-0.5"/>}</button><div className="relative flex-1 h-10"><div className="absolute top-3 left-0 right-0 h-1 bg-slate-600 rounded"/><div className="absolute top-3 left-0 h-1 bg-status-info rounded" style={{width:`${((offset+24)/96)*100}%`}}/><div className="flex justify-between pt-5 text-[10px] text-text-muted">{timeline.map(v=><span key={v}>{v===0?'Now':v>0?`+${v}h`:`${v}h`}</span>)}</div><div className="absolute top-1 -translate-x-1/2" style={{left:`${((offset+24)/96)*100}%`}}><div className="w-3 h-3 rounded-full bg-status-info ring-4 ring-status-info/20"/></div></div></div></div>
    <div className="absolute bottom-5 right-5 text-[10px] text-white/60">Leaflet-style command map · demo inputs</div>
  </div>
}
