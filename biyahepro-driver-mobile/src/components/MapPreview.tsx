import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LeafletDriverMap } from '@/src/components/LeafletDriverMap';
import { colors } from '@/src/theme/colors';

export function MapPreview({ compact = false }: { compact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Shared between the inline preview and the fullscreen Modal so the map
  // itself, the badge, and the status pill only have to be written once.
  // `expanded` only swaps which icon the corner button shows.
  function renderContent(expanded: boolean) {
    return (
      <>
        <LeafletDriverMap compact={compact && !expanded} />
        <View style={styles.badge}><Text style={styles.badgeText}>Maps</Text></View>
        <View style={styles.status}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>Accepting rides</Text>
        </View>
        <Pressable
          style={styles.expandButton}
          onPress={() => setIsExpanded(!expanded)}
          hitSlop={10}
        >
          <Text style={styles.expandIcon}>{expanded ? '⤬' : '⛶'}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      <View style={[styles.wrap, compact && styles.compact]}>{renderContent(false)}</View>
      <Modal visible={isExpanded} animationType="slide" onRequestClose={() => setIsExpanded(false)}>
        <View style={styles.fullscreen}>{renderContent(true)}</View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 205, overflow: 'hidden', backgroundColor: '#9CDCE9', position: 'relative' },
  compact: { height: 180 },
  fullscreen: { flex: 1, backgroundColor: '#9CDCE9', position: 'relative' },
  badge: { position: 'absolute', top: 10, left: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 2 },
  badgeText: { color: '#1671D9', fontSize: 12, fontWeight: '700' },
  status: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  statusText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  expandButton: {
    position: 'absolute', top: 10, right: 12, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  expandIcon: { color: '#fff', fontSize: 16 },
});