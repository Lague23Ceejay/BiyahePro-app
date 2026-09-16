import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getServiceArea } from '@/src/lib/api';

type Props = { compact?: boolean };
const WebViewAny = WebView as any;
type Area = { latitude: number; longitude: number; radiusKm: number };

function buildHtml(area: Area) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>html,body,#map{height:100%;margin:0;padding:0}.driver-icon{width:24px;height:24px;border-radius:50%;background:#ff6412;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([${area.latitude},${area.longitude}],14);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);L.circle([${area.latitude},${area.longitude}],{radius:${area.radiusKm * 1000},color:'#ff6412',fillColor:'#ff6412',fillOpacity:.08}).addTo(map);L.marker([${area.latitude},${area.longitude}],{icon:L.divIcon({className:'driver-icon',iconSize:[24,24]})}).addTo(map).bindPopup('BiyahePro service area');</script></body></html>`;
}

export function LeafletDriverMap({ compact = false }: Props) {
  const [area, setArea] = useState<Area | null>(null);
  useEffect(() => { let mounted = true; const refresh = () => getServiceArea().then(next => { if (mounted) setArea(next); }).catch(() => undefined); refresh(); const timer = setInterval(refresh, 15000); return () => { mounted = false; clearInterval(timer); }; }, []);
  const html = useMemo(() => area ? buildHtml(area) : '', [area]);
  return <View style={[styles.wrap, compact && styles.compact]}>{area ? <WebViewAny source={{ html }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled style={styles.fill} /> : null}</View>;
}

const styles = StyleSheet.create({ wrap: { height: 205, overflow: 'hidden', backgroundColor: '#9CDCE9' }, compact: { height: 180 }, fill: { flex: 1 } });
