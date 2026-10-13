// Live trip map: pickup + drop-off pins and a moving driver marker.
//
// The Leaflet page is built ONCE and then driven by injectJavaScript, so a new
// GPS ping just moves the marker — it never reloads the WebView (which would
// flash blank and reset the user's pan/zoom every few seconds).
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '@/src/theme/colors';
import { isValidPoint, type LatLng } from '@/src/lib/geo';

const WebViewAny = WebView as any;

type Props = {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  driver: LatLng | null;
  // Where the driver is currently heading — decides which point the dashed
  // guide line runs to and what the map re-frames around.
  target: 'pickup' | 'dropoff';
  driverLabel?: string;
  height?: number;
};

function buildHtml(center: LatLng) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>
html,body,#map{height:100%;margin:0;padding:0}
.dot{width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)}
.dot.pickup{background:#16a34a}.dot.dropoff{background:#dc2626;border-radius:6px}.dot.driver{background:#ff6412}
.lbl{font:700 11px sans-serif;padding:2px 6px}
</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var map=L.map('map',{zoomControl:true}).setView([${center.latitude},${center.longitude}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
var markers={},line=null,lastFit=null;
function dot(c){return L.divIcon({className:'',html:'<div class="dot '+c+'"></div>',iconSize:[22,22],iconAnchor:[11,11]});}
function setMarker(key,pt,cls,label){
  if(!pt){if(markers[key]){map.removeLayer(markers[key]);markers[key]=null;}return;}
  var ll=[pt.latitude,pt.longitude];
  if(!markers[key]){markers[key]=L.marker(ll,{icon:dot(cls)}).addTo(map).bindTooltip(label,{permanent:true,direction:'top',offset:[0,-12],className:'lbl'});}
  else{markers[key].setLatLng(ll);}
}
window.render=function(p){
  setMarker('pickup',p.pickup,'pickup','Pickup');
  setMarker('dropoff',p.dropoff,'dropoff','Drop-off');
  setMarker('driver',p.driver,'driver',p.driverLabel);
  var tgt=p.target==='dropoff'?p.dropoff:p.pickup;
  if(line){map.removeLayer(line);line=null;}
  if(p.driver&&tgt){line=L.polyline([[p.driver.latitude,p.driver.longitude],[tgt.latitude,tgt.longitude]],{color:'#ff6412',weight:4,dashArray:'8 8',opacity:.85}).addTo(map);}
  if(p.fitKey!==lastFit){
    lastFit=p.fitKey;
    var pts=(p.driver&&tgt)?[p.driver,tgt]:[p.pickup,p.dropoff].filter(Boolean);
    if(pts.length===1){map.setView([pts[0].latitude,pts[0].longitude],16);}
    else if(pts.length>1){map.fitBounds(pts.map(function(x){return [x.latitude,x.longitude];}),{padding:[48,48],maxZoom:17});}
  }
};
window.addEventListener('resize',function(){map.invalidateSize();});
</script></body></html>`;
}

export function LiveTripMap({ pickup, dropoff, driver, target, driverLabel = 'Driver', height = 260 }: Props) {
  const webRef = useRef<any>(null);
  const readyRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  // Built once from whatever point we know first; later updates go through
  // injectJavaScript so this string (and the WebView source) never changes.
  const [html] = useState(() => {
    const first = isValidPoint(pickup) ? pickup : isValidPoint(dropoff) ? dropoff : { latitude: 8.6552, longitude: 123.4241 };
    return buildHtml(first);
  });

  function push() {
    if (!readyRef.current || !webRef.current) return;
    const payload = {
      pickup: isValidPoint(pickup) ? pickup : null,
      dropoff: isValidPoint(dropoff) ? dropoff : null,
      driver: isValidPoint(driver) ? driver : null,
      target,
      driverLabel,
      // Re-frame only when the situation changes (first fix, or heading to a
      // new target) — NOT on every ping, which would fight the user's panning.
      fitKey: `${target}|${isValidPoint(driver) ? 'driver' : 'nodriver'}`,
    };
    webRef.current.injectJavaScript(`window.render(${JSON.stringify(payload)});true;`);
  }

  // Push on every relevant change. Depending on the individual numbers (not
  // the objects) keeps this from re-running on every parent re-render.
  useEffect(() => {
    push();
  }, [
    pickup?.latitude, pickup?.longitude, dropoff?.latitude, dropoff?.longitude,
    driver?.latitude, driver?.longitude, target, driverLabel,
  ]);

  const hasAnyPoint = isValidPoint(pickup) || isValidPoint(dropoff);
  if (!hasAnyPoint) {
    return (
      <View style={[styles.card, styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>Map will appear once the trip location is available.</Text>
      </View>
    );
  }

  function surface(isExpanded: boolean) {
    return (
      <>
        <WebViewAny
          ref={webRef}
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          style={styles.fill}
          // A freshly mounted WebView (first render, or after toggling
          // fullscreen) is blank until this fires — mark not-ready on start so
          // pushes are held back, then send the current state once it's up.
          onLoadStart={() => { readyRef.current = false; }}
          onLoadEnd={() => { readyRef.current = true; push(); }}
        />
        <Pressable style={styles.expandButton} onPress={() => setExpanded(!isExpanded)} hitSlop={10}>
          <Text style={styles.expandIcon}>{isExpanded ? '⤬' : '⛶'}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      {!expanded && <View style={[styles.card, { height }]}>{surface(false)}</View>}
      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={styles.fullscreen}>{expanded ? surface(true) : null}</View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: '#9CDCE9', position: 'relative' },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.surface },
  placeholderText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  fullscreen: { flex: 1, backgroundColor: '#9CDCE9', position: 'relative' },
  fill: { flex: 1 },
  expandButton: {
    position: 'absolute', top: 10, right: 12, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  expandIcon: { color: '#fff', fontSize: 17 },
});