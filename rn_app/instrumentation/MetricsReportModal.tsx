// MetricsReportModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Share, Platform } from 'react-native';
import { metrics, deriveKPIs } from './VideoMetrics';

type Row = ReturnType<typeof deriveKPIs> & {
  playId: string;
  videoId: string;
  eventsCount: number;
};

const ms = (v?: number) => (v == null ? '-' : `${Math.round(v)} ms`);
const pct = (p: number, arr: number[]) => {
  if (!arr.length) return undefined;
  const a = [...arr].sort((x,y)=>x-y);
  const idx = Math.max(0, Math.min(a.length - 1, Math.floor((p/100)*(a.length - 1))));
  return a[idx];
};

export const MetricsReportModal = ({ visible, onClose }:{
  visible: boolean; onClose: () => void;
}) => {
  const [sortKey, setSortKey] = useState<'startup'|'ready'|'stalls'|'stallMs'>('startup');
  const [descending, setDescending] = useState(true);
  const [showOnlyStalls, setShowOnlyStalls] = useState(false);

  const snapshot = useMemo(() => (visible ? metrics.snapshot() : []), [visible]);

  const rows: Row[] = useMemo(() => {
    if (!snapshot.length) return [];
    const byPlay = new Map<string, typeof snapshot>();
    for (const e of snapshot) {
      if (!byPlay.has(e.playId)) byPlay.set(e.playId, []);
      byPlay.get(e.playId)!.push(e);
    }
    const out: Row[] = [];
    for (const [playId, events] of byPlay) {
      const sorted = events.slice().sort((a,b)=>a.ts-b.ts);
      const k = deriveKPIs(sorted);
      out.push({
        playId,
        videoId: sorted[0]?.videoId ?? '',
        eventsCount: sorted.length,
        readyMs: k.readyMs,
        startupMs: k.startupMs,
        startupEffectiveMs: k.startupEffectiveMs,
        readyBeforePlay: k.readyBeforePlay,
        stalls: k.stalls ?? 0,
        stallTimeMs: k.stallTimeMs,
        timeToFirstStallMs: k.timeToFirstStallMs,
        lastEvent: k.lastEvent,
      } as Row);
    }
    return out;
  }, [snapshot]);

  const filtered = useMemo(
    () => rows.filter(r => (showOnlyStalls ? (r.stalls ?? 0) > 0 : true)),
    [rows, showOnlyStalls]
  );

  const sorted = useMemo(() => {
    const k = sortKey;
    const keyVal = (r: Row) =>
      k === 'startup' ? (r.startupEffectiveMs ?? Number.POSITIVE_INFINITY)
      : k === 'ready' ? (r.readyMs ?? Number.POSITIVE_INFINITY)
      : k === 'stalls' ? (r.stalls ?? 0)
      : (r.stallTimeMs ?? 0);

    const arr = [...filtered].sort((a,b)=> keyVal(a) - keyVal(b));
    return descending ? arr.reverse() : arr;
  }, [filtered, sortKey, descending]);

  // percentiles (use startupEffectiveMs)
  const pData = useMemo(() => {
    const se = rows.map(r => r.startupEffectiveMs!).filter(x => x != null);
    const r = rows.map(r => r.readyMs!).filter(x => x != null);
    return {
      startupP50: pct(50, se), startupP90: pct(90, se), startupP99: pct(99, se),
      readyP50: pct(50, r),   readyP90: pct(90, r),   readyP99: pct(99, r),
      total: rows.length
    };
  }, [rows]);

  const exportCSV = async () => {
    const header = ['playId','videoId','readyMs','startupMs','startupEffectiveMs','readyBeforePlay','stalls','stallMs','tTFStall','events'].join(',');
    const lines = sorted.map(r =>
      [r.playId, r.videoId, r.readyMs ?? '', r.startupMs ?? '', r.startupEffectiveMs ?? '',
       r.readyBeforePlay ? 1 : 0, r.stalls ?? 0, r.stallTimeMs ?? '', r.timeToFirstStallMs ?? '', r.eventsCount].join(',')
    );
    const csv = [header, ...lines].join('\n');
    try { await Share.share({ message: csv, title: 'metrics.csv' }); } catch {}
  };

  const HeaderButton = ({label, onPress, active}:{label:string; onPress:()=>void; active?:boolean}) => (
    <TouchableOpacity onPress={onPress} style={[styles.btn, active && styles.btnActive]}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Playback Metrics ({pData.total} plays)</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.link}>Close</Text></TouchableOpacity>
        </View>

        {/* Percentiles */}
        <View style={styles.badges}>
          <Badge label="startup p50" value={ms(pData.startupP50)} />
          <Badge label="p90" value={ms(pData.startupP90)} />
          <Badge label="p99" value={ms(pData.startupP99)} />
          <Badge label="ready p50" value={ms(pData.readyP50)} />
          <Badge label="p90" value={ms(pData.readyP90)} />
          <Badge label="p99" value={ms(pData.readyP99)} />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <HeaderButton label={`Sort: ${sortKey}`} onPress={()=>{
            const order: any = { startup:'ready', ready:'stalls', stalls:'stallMs', stallMs:'startup' };
            setSortKey(order[sortKey]);
          }} />
          <HeaderButton label={descending ? '↓ desc' : '↑ asc'} onPress={()=>setDescending(d=>!d)} />
          <HeaderButton label={showOnlyStalls ? 'Stalls: ON' : 'Stalls: OFF'} onPress={()=>setShowOnlyStalls(s=>!s)} />
          <HeaderButton label="Export CSV" onPress={exportCSV} />
        </View>

        {/* Table */}
        <View style={styles.headerRow}>
          <Text style={[styles.hcell, {flex:2}]}>videoId / playId</Text>
          <Text style={styles.hcell}>startup</Text>
          <Text style={styles.hcell}>ready</Text>
          <Text style={styles.hcell}>stalls</Text>
          <Text style={styles.hcell}>stall ms</Text>
        </View>
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.playId}
          renderItem={({item}) => (
            <View style={styles.row}>
              <View style={{flex:2}}>
                <Text style={styles.cellPrimary}>{item.videoId || '—'}</Text>
                <Text style={styles.cellSecondary} numberOfLines={1}>{item.playId}</Text>
              </View>
              <Text style={styles.cell}>
                {ms(item.startupEffectiveMs)}
                {item.readyBeforePlay ? '  (pre)' : ''}
              </Text>
              <Text style={styles.cell}>{ms(item.readyMs)}</Text>
              <Text style={styles.cell}>{item.stalls ?? 0}</Text>
              <Text style={styles.cell}>{ms(item.stallTimeMs)}</Text>
            </View>
          )}
        />
      </View>
    </Modal>
  );
};

const Badge = ({ label, value }:{label:string; value?:string}) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{label}: <Text style={{fontWeight:'600'}}>{value ?? '-'}</Text></Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#101014', paddingTop: Platform.select({ ios: 12, android: 0 }), paddingHorizontal:12 },
  topRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginVertical:12 },
  title: { color:'#fff', fontSize:18, fontWeight:'700' },
  link: { color:'#8ab4ff', fontSize:16 },
  badges: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 },
  badge: { backgroundColor:'rgba(255,255,255,0.12)', borderRadius:6, paddingHorizontal:8, paddingVertical:4, marginRight:8, marginBottom:8 },
  badgeText: { color:'#fff', fontSize:12 },

  controls: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 },
  btn: { backgroundColor:'rgba(255,255,255,0.08)', borderRadius:6, paddingHorizontal:10, paddingVertical:6, marginRight:8, marginBottom:8 },
  btnActive: { backgroundColor:'rgba(255,255,255,0.18)' },
  btnText: { color:'#fff', fontSize:12 },

  headerRow: { flexDirection:'row', borderBottomColor:'rgba(255,255,255,0.12)', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical:6, marginTop:4 },
  hcell: { color:'#bbb', flex:1, fontSize:12 },

  row: { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomColor:'rgba(255,255,255,0.06)', borderBottomWidth: StyleSheet.hairlineWidth },
  cellPrimary: { color:'#fff', fontSize:13, fontWeight:'600' },
  cellSecondary: { color:'#bbb', fontSize:11, marginTop:2, maxWidth:240 },
  cell: { color:'#fff', flex:1, fontSize:13 },
});
