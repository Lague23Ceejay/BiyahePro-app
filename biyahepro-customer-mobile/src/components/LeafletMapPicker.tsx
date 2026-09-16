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
};

// Self-contained HTML string — no bundling step needed, the WebView loads
// this directly. Leaflet's JS/CSS come from unpkg's CDN.
function buildHtml({ latitude, longitude }: LatLng, zoom: number) {
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

    function post(message) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
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
  function LeafletMapPicker({ initialCenter, initialZoom = 15, pickup, dropoff, onMapPress, onReady }, ref) {
    const webviewRef = useRef<WebView>(null);
    // The HTML is only built once per mount — after that, marker/center
    // updates go through postMessage rather than reloading the page (a
    // reload would flash the tiles and reset zoom/pan on every keystroke).
    const htmlRef = useRef(buildHtml(initialCenter, initialZoom));
    const readyRef = useRef(false);

    useImperativeHandle(ref, () => ({
      flyTo(point, zoom) {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'flyTo', ...point, zoom }));
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
        } else if (data.type === 'ready') {
          readyRef.current = true;
          onReady?.();
          // Push current marker positions once the page has finished
          // initializing (it starts both markers at initialCenter).
          webviewRef.current?.postMessage(JSON.stringify({ type: 'setMarkers', pickup, dropoff }));
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