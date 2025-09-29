import { useEffect, useMemo, useRef, useState } from "react";
import { deriveKPIs, metrics, Rec } from "./VideoMetrics";
import { Text, View } from "react-native";

type HUDProps = {
    playId: string;          // IMPORTANT: pass the per-playback attempt ID
    visible?: boolean;       // show/hide
    maxLogs?: number;        // defaults to 4
    tickMs?: number;         // UI update cadence, defaults to 500ms
};

export const DebugHUD: React.FC<HUDProps> = ({
    playId,
    visible = true,
    maxLogs = 4,
    tickMs = 500
}) => {
    if (!visible || !playId) return null;
    
    const ringRef = useRef<Rec[]>([]);
    const [logs, setLogs] = useState<Rec[]>([]);
    const [version, setVersion] = useState(0);

    // Seed with last few; then batch updates at fixed cadence (cheap)
    useEffect(() => {
        ringRef.current = metrics.snapshot(playId).slice(-maxLogs);
        const unsub = metrics.onRecord(r => {
            if (r.playId !== playId) return;
            const b = ringRef.current;
            b.push(r);
            if (b.length > maxLogs) b.splice(0, b.length - maxLogs);
        });
        const iv = setInterval(() => {
            setLogs([...ringRef.current]);
            setVersion(v => v + 1);
        }, tickMs);
        return () => { clearInterval(iv); unsub(); };
    }, [playId, maxLogs, tickMs]);

    // KPIs must come from the FULL event history for this playId
    const allForPlay = useMemo(() => playId ? metrics.snapshot(playId) : [], [version, playId]);
    const kpis = useMemo(() => deriveKPIs(allForPlay), [allForPlay]);

    if (!visible) return null;

    return (
        <View style={{
            position: "absolute", top: 8, left: 8, right: 8,
            backgroundColor: "rgba(0,0,0,0.7)",
            padding: 8, borderRadius: 8
        }}>
            {/* Header with ID (helps debug "all tiles same KPIs" issues) */}
            <Text style={{ color: "#bbb", fontSize: 10, marginBottom: 4 }}>
                playId: {playId}
            </Text>

            {/* KPI badges */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
                {badge("startup", kpis.startupMs)}
                {badge("ready", kpis.readyMs)}
                {badge("stalls", kpis.stalls ?? 0, false)}
                {badge("stall ms", kpis.stallTimeMs)}
                {badge("tTFStall", kpis.timeToFirstStallMs)}
                {badge("last", kpis.lastEvent ?? "-", false)}
            </View>

            {/* Last few logs only (super light) */}
            {logs.map((r, i) => (
                <Text key={i} style={{ color: "#fff", fontSize: 11 }}>
                    {r.event}{r.dSincePrev != null ? `  +${Math.round(r.dSincePrev)}ms` : ""}
                </Text>
            ))}
        </View>
    );
};

const badge = (label: string, v?: number | string, ms: boolean = true) => (
    <View key={label} style={{
        backgroundColor: "rgba(255,255,255,0.12)",
        paddingHorizontal: 6, paddingVertical: 3,
        borderRadius: 4, marginRight: 6, marginBottom: 6
    }}>
        <Text style={{ color: "#fff", fontSize: 11 }}>
            {label}: <Text style={{ fontWeight: "600" }}>
                {fmt(v, ms)}
            </Text>
        </Text>
    </View>
);

const fmt = (v?: number | string, ms: boolean = true) =>
    v == null ? "-" : (typeof v === "number" ? (ms ? `${Math.round(v)}ms` : `${v}`) : String(v));
