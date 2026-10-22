// File path in project: biyahepro-customer-mobile/src/components/LeafletMapPicker.tsx
//
// Replaces react-native-maps + Google Maps for the pickup/dropoff picker.
// Renders Leaflet (loaded from a CDN) with OpenStreetMap tiles inside a
// WebView — no API key, no billing account, no custom dev build required.
// Works in Expo Go, since WebView is a standard Expo-supported module
// (unlike react-native-maps' native Google Maps SDK, which Expo Go can't
// apply custom config to at all).
//
// OSM's tile server (tile.openstreetmap.org) is free for this volume of
// use under their tile usage policy — light personal/dev traffic is fine.
// If this app goes to real production with real user volume, the tile
// usage policy asks that you either self-host tiles or switch to a paid
// provider (e.g. MapTiler, Stadia Maps, Mapbox) at that point — but for
// building and testing right now, this costs nothing and needs no signup.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapZone } from '@/src/data/dapitanZones';

// react-native-webview's type definitions still model WebView as a class
// component with a single generic default (`WebView<P = undefined>`),
// which React 19's stricter component-type resolution can't match against
// a real props object — every valid prop gets rejected with a "Type X is
// not assignable to type 'never'" error. This is a types-only mismatch in
// the library, not a runtime issue (react-native-webview itself works
// fine on React 19). Casting to `any` for this one JSX usage sidesteps
// the broken overload resolution without disabling type-checking anywhere
// else in the file.
const WebViewAny = WebView as any;

export type LatLng = { latitude: number; longitude: number };

export type LeafletMapPickerHandle = {
  /** Recenter the map (e.g. after "Use my location" or switching pickup/dropoff focus). */
  flyTo: (point: LatLng, zoom?: number) => void;
  /**
   * Zoom to one fare zone and show its places as tappable dots. Pass null to
   * clear the highlight and zoom back out to show every zone.
   */
  focusZone: (zoneId: string | null) => void;
};

type Props = {
  initialCenter: LatLng;
  initialZoom?: number;
  pickup: LatLng;
  dropoff: LatLng;
  /** Called with the tapped coordinate every time the user taps the map. */
  onMapPress: (point: LatLng) => void;
  /** Called once, when the Leaflet page has finished loading and is interactive. */
  onReady?: () => void;
  serviceArea?: { latitude: number; longitude: number; radiusKm: number };
  /** Fare zones to draw as coloured areas with a tappable "Zone N" label. */
  zones?: MapZone[];
  /** Zone to zoom into as soon as the map is ready (used when the picker opens on a chosen zone). */
  initialFocusZoneId?: string | null;
  /** Called when the user taps a "Zone N" label on the map. */
  onZonePress?: (zoneId: string) => void;
  /** Called when the user taps one of a focused zone's place dots. */
  onPlacePress?: (zoneId: string, placeId: string) => void;
};

// Self-contained HTML string — no bundling step needed, the WebView loads
// this directly. Leaflet's JS/CSS come from unpkg's CDN.
function buildHtml({ latitude, longitude }: LatLng, zoom: number, serviceArea?: Props['serviceArea'], zones: MapZone[] = []) {
  const circle = serviceArea ? `L.circle([${serviceArea.latitude}, ${serviceArea.longitude}], { radius: ${serviceArea.radiusKm * 1000}, color: '#FF6412', fillColor: '#FF6412', fillOpacity: 0.08 }).addTo(map);` : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .pickup-icon, .dropoff-icon {
      width: 22px; height: 22px; border-radius: 11px; border: 3px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
    .pickup-icon { background: #1F8A56; }
    .dropoff-icon { background: #E85D5D; }
    .zone-label {
      width: 74px; height: 22px; line-height: 22px; text-align: center; border-radius: 11px;
      color: #fff; font: 800 11px/22px sans-serif; white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35); border: 2px solid #fff; box-sizing: border-box;
    }
    .place-dot {
      width: 14px; height: 14px; border-radius: 7px; background: #fff; border: 3px solid #555;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4); box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: true })
      .setView([${latitude}, ${longitude}], ${zoom});

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var pickupIcon = L.divIcon({ className: 'pickup-icon', iconSize: [22, 22] });
    var dropoffIcon = L.divIcon({ className: 'dropoff-icon', iconSize: [22, 22] });

    var pickupMarker = L.marker([${latitude}, ${longitude}], { icon: pickupIcon }).addTo(map);
    var dropoffMarker = L.marker([${latitude}, ${longitude}], { icon: dropoffIcon }).addTo(map);
    ${circle}

    function post(message) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    }

    // ── Fare zones ─────────────────────────────────────────────────────
    // The shapes are non-interactive on purpose: taps inside a zone must
    // still fall through to the map so the user can drop a pin anywhere.
    // Only the "Zone N" labels and (for a focused zone) the place dots are
    // tappable.
    var ZONES = ${JSON.stringify(zones)};
    var zoneLayers = {};
    ZONES.forEach(function (z) {
      var style = { color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.12, interactive: false };
      var shape = z.circle
        ? L.circle([z.circle.latitude, z.circle.longitude], Object.assign({ radius: z.circle.radiusKm * 1000 }, style))
        : L.polygon(z.outline, style);
      shape.addTo(map);

      var label = L.marker([z.labelAt.latitude, z.labelAt.longitude], {
        icon: L.divIcon({
          className: '',
          html: '<div class="zone-label" style="background:' + z.color + '">' + z.label + '</div>',
          iconSize: [74, 22],
          iconAnchor: [37, 11]
        }),
        zIndexOffset: 500
      }).addTo(map);
      label.on('click', function () { post({ type: 'zonePress', zoneId: z.id }); });

      var places = L.layerGroup();
      z.places.forEach(function (pl) {
        var dot = L.marker([pl.latitude, pl.longitude], {
          icon: L.divIcon({
            className: '',
            html: '<div class="place-dot" style="border-color:' + z.color + '"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        }).bindTooltip(pl.name, { direction: 'top', offset: [0, -8] });
        dot.on('click', function () { post({ type: 'placePress', zoneId: z.id, placeId: pl.id }); });
        places.addLayer(dot);
      });
      zoneLayers[z.id] = { shape: shape, places: places };
    });

    function focusZone(zoneId) {
      var ids = Object.keys(zoneLayers);
      ids.forEach(function (id) {
        var layer = zoneLayers[id];
        var on = id === zoneId;
        layer.shape.setStyle({ fillOpacity: on ? 0.28 : (zoneId ? 0.05 : 0.12), weight: on ? 3 : 2 });
        if (on) { map.addLayer(layer.places); } else { map.removeLayer(layer.places); }
      });
      if (zoneId && zoneLayers[zoneId]) {
        map.fitBounds(zoneLayers[zoneId].shape.getBounds(), { padding: [30, 30], maxZoom: 15 });
      } else if (ids.length) {
        map.fitBounds(L.featureGroup(ids.map(function (id) { return zoneLayers[id].shape; })).getBounds(), { padding: [20, 20] });
      }
    }

    map.on('click', function (e) {
      post({ type: 'press', latitude: e.latlng.lat, longitude: e.latlng.lng });
    });

    // Handles commands sent from the RN side (update markers, recenter).
    // Registered on both 'message' and 'document' events — Android fires
    // through 'document', iOS through 'window'.
    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'setMarkers') {
          pickupMarker.setLatLng([data.pickup.latitude, data.pickup.longitude]);
          dropoffMarker.setLatLng([data.dropoff.latitude, data.dropoff.longitude]);
        } else if (data.type === 'flyTo') {
          map.setView([data.latitude, data.longitude], data.zoom || map.getZoom());
        } else if (data.type === 'focusZone') {
          focusZone(data.zoneId);
        }
      } catch (err) {}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    post({ type: 'ready' });
  </script>
</body>
</html>`;
}

export const LeafletMapPicker = forwardRef<LeafletMapPickerHandle, Props>(
  function LeafletMapPicker({
    initialCenter, initialZoom = 15, pickup, dropoff, onMapPress, onReady, serviceArea,
    zones, initialFocusZoneId, onZonePress, onPlacePress,
  }, ref) {
    const webviewRef = useRef<WebView>(null);
    // The HTML is only built once per mount — after that, marker/center
    // updates go through postMessage rather than reloading the page (a
    // reload would flash the tiles and reset zoom/pan on every keystroke).
    const htmlRef = useRef(buildHtml(initialCenter, initialZoom, serviceArea, zones));
    const readyRef = useRef(false);

    useImperativeHandle(ref, () => ({
      flyTo(point, zoom) {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'flyTo', ...point, zoom }));
      },
      focusZone(zoneId) {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'focusZone', zoneId }));
      },
    }));

    // Keep the on-map markers in sync whenever pickup/dropoff change from
    // the RN side (typed address, "Use my location", reverse-geocode
    // result, etc.) — not just on the initial mount.
    useEffect(() => {
      if (!readyRef.current) return;
      webviewRef.current?.postMessage(JSON.stringify({ type: 'setMarkers', pickup, dropoff }));
    }, [pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude]);

    function handleWebViewMessage(event: { nativeEvent: { data: string } }) {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'press') {
          onMapPress({ latitude: data.latitude, longitude: data.longitude });
        } else if (data.type === 'zonePress') {
          onZonePress?.(data.zoneId);
        } else if (data.type === 'placePress') {
          onPlacePress?.(data.zoneId, data.placeId);
        } else if (data.type === 'ready') {
          readyRef.current = true;
          onReady?.();
          // Push current marker positions once the page has finished
          // initializing (it starts both markers at initialCenter).
          webviewRef.current?.postMessage(JSON.stringify({ type: 'setMarkers', pickup, dropoff }));
          if (initialFocusZoneId) {
            webviewRef.current?.postMessage(JSON.stringify({ type: 'focusZone', zoneId: initialFocusZoneId }));
          }
        }
      } catch {
        // Ignore malformed messages rather than crashing the screen.
      }
    }

    return (
      <View style={styles.fill}>
        <WebViewAny
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: htmlRef.current }}
          onMessage={handleWebViewMessage}
          style={styles.fill}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});