import { useEffect, useRef, useState } from 'react';

function buildMapSource(center, radiusKm) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0}.driver{width:22px;height:22px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 1px 5px #334155}.coordinates{background:#0f172a;color:#f8fafc;padding:6px 9px;border-radius:6px;font:12px Arial;box-shadow:0 1px 4px #334155}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
    const map=L.map('map').setView([${center.lat},${center.lng}],13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const icon=L.divIcon({className:'driver',iconSize:[22,22]});
    const marker=L.marker([${center.lat},${center.lng}],{icon,draggable:true}).addTo(map).bindPopup('Drag this marker or tap the map to move the service area');
    const area=L.circle([${center.lat},${center.lng}],{radius:${radiusKm * 1000},color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:.12}).addTo(map);
    const coordinates=L.control({position:'bottomleft'});
    coordinates.onAdd=function(){this.el=L.DomUtil.create('div','coordinates');this.el.innerHTML='Center: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}';return this.el};
    coordinates.addTo(map);
    map.fitBounds(area.getBounds(),{padding:[24,24]});
    function updateArea(point,radius,recenter){
      marker.setLatLng(point);
      area.setLatLng(point);
      if(Number.isFinite(radius)&&radius>0)area.setRadius(radius*1000);
      coordinates.el.innerHTML='Center: '+point.lat.toFixed(5)+', '+point.lng.toFixed(5);
      if(recenter)map.setView(point,map.getZoom());
    }
    function move(point){
      updateArea(point,area.getRadius()/1000,false);
      window.parent.postMessage({type:'service-area-move',latitude:point.lat,longitude:point.lng},'*');
    }
    marker.on('dragend',function(){move(marker.getLatLng());marker.openPopup()});
    map.on('click',function(event){move(event.latlng)});
    window.addEventListener('message',function(event){
      if(event.data?.type!=='service-area-set')return;
      const {latitude,longitude,radiusKm}=event.data;
      if(Number.isFinite(latitude)&&Number.isFinite(longitude))updateArea(L.latLng(latitude,longitude),radiusKm,true);
    });
    function resizeMap(){map.invalidateSize()}
    setTimeout(resizeMap,100);
    setTimeout(resizeMap,400);
    window.addEventListener('resize',resizeMap);
  </script></body></html>`;
}

export default function LeafletMap({ center, radiusKm = 5, onMove }) {
  const wrapRef = useRef(null);
  const iframeRef = useRef(null);
  const onMoveRef = useRef(onMove);
  const [source] = useState(() => buildMapSource(center, radiusKm));
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === wrapRef.current);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    function onMapMessage(event) {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.type !== 'service-area-move') return;
      const { latitude, longitude } = event.data;
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        onMoveRef.current?.({ lat: latitude, lng: longitude });
      }
    }
    window.addEventListener('message', onMapMessage);
    return () => window.removeEventListener('message', onMapMessage);
  }, []);

  useEffect(() => {
    function sendServiceArea() {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'service-area-set',
        latitude: center.lat,
        longitude: center.lng,
        radiusKm,
      }, '*');
    }
    sendServiceArea();
  }, [center.lat, center.lng, radiusKm]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapRef.current?.requestFullscreen?.();
    }
  }

  return (
    <div ref={wrapRef} className={isFullscreen ? 'relative h-screen w-screen bg-slate-950' : 'relative'}>
      <iframe
        ref={iframeRef}
        title="BiyahePro service area map"
        srcDoc={source}
        onLoad={() => iframeRef.current?.contentWindow?.postMessage({
          type: 'service-area-set',
          latitude: center.lat,
          longitude: center.lng,
          radiusKm,
        }, '*')}
        className={isFullscreen ? 'h-full w-full border-0' : 'h-64 w-full border-0'}
      />
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Expand map'}
        className="absolute top-2 right-2 h-8 w-8 rounded-md bg-slate-950/70 text-white text-sm flex items-center justify-center hover:bg-slate-950/90"
      >
        {isFullscreen ? '⤬' : '⛶'}
      </button>
    </div>
  );
}
