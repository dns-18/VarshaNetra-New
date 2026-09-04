import React, { useEffect, useRef } from 'react'

export interface MapMarker {
  id:string; label:string; lat:number; lon:number; rainfall:number; warning:string; flood:number
}

declare global { interface Window { L:any } }

function loadLeaflet(){
  return new Promise<any>((resolve,reject)=>{
    if(window.L){resolve(window.L);return}
    const cssId='leaflet-css'
    if(!document.getElementById(cssId)){
      const link=document.createElement('link'); link.id=cssId; link.rel='stylesheet'
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link)
    }
    const script=document.createElement('script'); script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload=()=>resolve(window.L); script.onerror=reject; document.head.appendChild(script)
  })
}

export default function LeafletMap({
  markers, satellite=false, onSelect
}:{markers:MapMarker[]; satellite?:boolean; onSelect?:(m:MapMarker)=>void}){
  const ref=useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    let map:any, street:any, sat:any, markerLayer:any, rainfallLayer:any, inundationLayer:any, boundaryLayer:any, reflectivityLayer:any
    let cancelled=false

    const savedLayers=()=>{
      try { return {...{satellite, raster:true, rainfall:true, inundation:false, boundaries:false}, ...JSON.parse(localStorage.getItem('varshanetra_layers')||'{}')} }
      catch { return {satellite, raster:true, rainfall:true, inundation:false, boundaries:false} }
    }

    loadLeaflet().then(L=>{
      if(cancelled||!ref.current)return
      map=L.map(ref.current,{zoomControl:true,attributionControl:true}).setView([25.2,92.4],6)
      street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'})
      sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'© Esri'})
      markerLayer=L.layerGroup().addTo(map)
      rainfallLayer=L.layerGroup()
      inundationLayer=L.layerGroup()
      boundaryLayer=L.layerGroup()
      reflectivityLayer=L.layerGroup()

      const boundaryCoords=[
        [[26.8,89.5],[28.2,95.0],[24.0,95.0],[22.0,92.0],[24.0,89.5]],
        [[24.0,89.5],[26.0,89.5],[25.0,92.0],[23.0,92.0]],
      ]
      boundaryCoords.forEach((poly:any)=>L.polygon(poly,{color:'#22d3ee',weight:1,fill:false,dashArray:'4 4'}).addTo(boundaryLayer))
      markers.forEach(m=>{
        const color=m.warning==='RED'?'#ef4444':m.warning==='ORANGE'?'#f97316':m.warning==='YELLOW'?'#f59e0b':'#10b981'
        const icon=L.divIcon({className:'vn-marker',html:`<div style="width:34px;height:34px;border-radius:50%;background:${color};opacity:.9;border:3px solid rgba(255,255,255,.85);box-shadow:0 0 20px ${color}88"></div>`,iconSize:[34,34],iconAnchor:[17,17]})
        const marker=L.marker([m.lat,m.lon],{icon}).addTo(markerLayer)
        marker.bindTooltip(`${m.label}<br>${m.rainfall.toFixed(0)} mm · ${m.warning}`,{direction:'top'})
        marker.on('click',()=>onSelect?.(m))
        L.circle([m.lat,m.lon],{radius:Math.max(8000,Math.min(40000,m.rainfall*120)),color:color,weight:1,fillOpacity:.12}).addTo(rainfallLayer)
        L.circle([m.lat,m.lon],{radius:Math.max(5000,Math.min(30000,m.flood*30000)),color:'#8b5cf6',weight:1,fillOpacity:.16}).addTo(inundationLayer)
        L.circle([m.lat,m.lon],{radius:Math.max(4000,Math.min(22000,(m.rainfall+10)*70)),color:'#60a5fa',weight:1,dashArray:'3 5',fillOpacity:.05}).addTo(reflectivityLayer)
      })

      const applyLayers=(state:any)=>{
        const useSat=state.satellite
        ;(useSat?sat:street).addTo(map)
        ;(useSat?street:sat).removeFrom(map)
        if(state.rainfall) rainfallLayer.addTo(map); else rainfallLayer.removeFrom(map)
        if(state.inundation) inundationLayer.addTo(map); else inundationLayer.removeFrom(map)
        if(state.boundaries) boundaryLayer.addTo(map); else boundaryLayer.removeFrom(map)
        if(state.raster) reflectivityLayer.addTo(map); else reflectivityLayer.removeFrom(map)
        markerLayer.addTo(map)
      }
      applyLayers(savedLayers())
      const onLayers=(e:any)=>applyLayers({...savedLayers(),...(e.detail||{})})
      window.addEventListener('varshanetra:layers',onLayers)
      setTimeout(()=>map.invalidateSize(),100)

      ;(map as any).__vnCleanup=()=>window.removeEventListener('varshanetra:layers',onLayers)
    }).catch(()=>{})

    return ()=>{
      cancelled=true
      if(map){(map as any).__vnCleanup?.();map.remove()}
    }
  },[markers,satellite,onSelect])

  return <div ref={ref} className="absolute inset-0 z-0" />
}
