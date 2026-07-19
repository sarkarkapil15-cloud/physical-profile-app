import React, { useState, useEffect, useMemo } from "react";
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Platform, StatusBar
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Line, Path, Circle, Text as SvgText, Rect } from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/* ---------- Tokens ---------- */
const COLORS = {
  bg: "#EEF3F5",
  surface: "#FFFFFF",
  ink: "#1C2B36",
  inkSoft: "#5B6B76",
  steel: "#2E5C8A",
  steelDark: "#274d75",
  amber: "#E8A33D",
  teal: "#4A7C6F",
  red: "#D64545",
  line: "#D8E1E6",
  rowAlt: "#F7FAFB",
};

const POINTS = [
  "C40_DS_P_01","P_02","P_03","P_04","P_05","P_06","P_07","P_08","P_09","P_10",
  "Cen_P_11","P_12","P_13","P_14","P_15","P_16","P_17","P_18","P_19","P_20","C40_OS_P_21"
];

const STORAGE_KEY = "physical_profile_entries_v1";
const uid = () => Math.random().toString(36).slice(2, 9);

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function dateOnly(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function pad3(v) {
  if (v === "" || v === null || v === undefined) return "";
  return String(v).padStart(3, "0").slice(-3);
}

/* ---------- Storage helpers ---------- */
async function loadEntries() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function saveEntries(entries) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

/* ---------- Logo ---------- */
function Logo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="2" y="20" width="44" height="6" rx="1.5" fill={COLORS.amber} />
      <Rect x="2" y="20" width="14" height="6" rx="1.5" fill={COLORS.red} />
      {Array.from({ length: 9 }).map((_, i) => (
        <Rect key={i} x={4 + i * 5} y="14" width="1.4" height={i % 2 === 0 ? 6 : 4} fill={COLORS.ink} />
      ))}
      <Rect x="2" y="8" width="4" height="14" rx="1" fill={COLORS.ink} />
      <Rect x="42" y="8" width="4" height="14" rx="1" fill={COLORS.ink} />
      <Rect x="16" y="24" width="4" height="16" rx="1" fill={COLORS.ink} />
    </Svg>
  );
}

/* ---------- Tick rule divider ---------- */
function TickRule() {
  const ticks = Array.from({ length: 30 });
  return (
    <Svg width="100%" height={14} style={{ marginBottom: 10 }}>
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={COLORS.line} strokeWidth="1" />
      {ticks.map((_, i) => (
        <Line
          key={i}
          x1={`${(i / (ticks.length - 1)) * 100}%`}
          x2={`${(i / (ticks.length - 1)) * 100}%`}
          y1="1"
          y2={i % 5 === 0 ? "10" : "6"}
          stroke="#B9C7CF"
          strokeWidth="1"
        />
      ))}
    </Svg>
  );
}

/* ---------- App Bar ---------- */
function AppBar({ title, onBack, rightLabel, onRight }) {
  return (
    <View style={styles.appBar}>
      <View style={styles.appBarLeft}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
        ) : (
          <Logo size={24} />
        )}
        <Text style={styles.appBarTitle}>{title}</Text>
      </View>
      {rightLabel ? (
        <TouchableOpacity onPress={onRight} style={styles.iconBtn}>
          <Text style={styles.appBarRightText}>{rightLabel}</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 32 }} />}
    </View>
  );
}

function Watermark() {
  return (
    <View style={styles.watermarkWrap} pointerEvents="none">
      <Text style={styles.watermarkText}>Kapil</Text>
    </View>
  );
}

/* ================= ENTRY SCREEN ================= */
function EntryScreen({ draft, setDraft, onSave, onOpenHistory }) {
  const [popup, setPopup] = useState(null);
  const [activeInput, setActiveInput] = useState(null);

  const schDisplay = pad3(draft.sch);
  const srDisplay = pad3(draft.sr);
  const idLabel = (draft.sch !== "" || draft.sr !== "") ? `${schDisplay || "000"}/${srDisplay || "000"}` : "—/—";
  const filledCount = draft.values.filter(v => v !== "").length;
  const canSave = draft.sample && draft.sch !== "" && draft.sr !== "" && filledCount === POINTS.length;

  function handleNumField(field, raw) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setDraft(d => ({ ...d, [field]: digits }));
  }

  function validateAndCommit(idx, raw) {
    let v = raw.replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    const [wholePart, decPart] = v.split(".");
    let safeWhole = (wholePart || "").slice(0, 2);
    let safeV = decPart !== undefined ? `${safeWhole}.${decPart.slice(0, 3)}` : safeWhole;

    setDraft(d => {
      const values = [...d.values];
      values[idx] = safeV;
      return { ...d, values };
    });
  }

  function clearField(idx) {
    setDraft(d => {
      const values = [...d.values];
      values[idx] = "";
      return { ...d, values };
    });
  }

  function onBlurPoint(idx) {
    const raw = draft.values[idx];
    if (raw === "" || raw === undefined) return;
    const hasDot = raw.includes(".");
    let normalized = raw;

    if (!hasDot) {
      normalized = `${parseInt(raw, 10)}.000`;
    } else {
      const [whole, dec] = raw.split(".");
      if (dec.length !== 3) {
        clearField(idx);
        setPopup({ msg: "3 digit after decimal should be written in box." });
        return;
      }
      normalized = `${parseInt(whole || "0", 10)}.${dec}`;
    }

    const num = parseFloat(normalized);

    if (idx !== 0 && draft.values[0] !== "" && draft.values[0] !== undefined) {
      const refNum = parseFloat(draft.values[0]);
      if (!isNaN(refNum)) {
        const lo = refNum - 1;
        const hi = refNum + 1;
        if (num < lo || num > hi) {
          clearField(idx);
          setPopup({
            msg: `Value should stay within ±1.000 mm of the first point (${refNum.toFixed(3)} mm). Allowed range: ${lo.toFixed(3)}–${hi.toFixed(3)} mm.`,
          });
          return;
        }
      }
    }

    setDraft(d => {
      const values = [...d.values];
      values[idx] = normalized;
      return { ...d, values };
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <AppBar title="Physical_Profile" rightLabel="History" onRight={onOpenHistory} />

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={styles.sectionLabel}>SAMPLE SECTION</Text>
        <View style={styles.sampleRow}>
          {["HE", "TE", "Body"].map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setDraft(d => ({ ...d, sample: s }))}
              style={[styles.sampleBtn, draft.sample === s && styles.sampleBtnActive]}
            >
              <Text style={[styles.sampleBtnText, draft.sample === s && styles.sampleBtnTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.idRow}>
          <View style={{ flex: 1 }}>
            <View style={[styles.chip, { backgroundColor: "#E4F1E9" }]}>
              <Text style={[styles.chipText, { color: "#2E6B4F" }]}>Sch: No</Text>
            </View>
            <TextInput
              value={draft.sch}
              onChangeText={t => handleNumField("sch", t)}
              keyboardType="number-pad"
              placeholder="1–3 digit"
              placeholderTextColor="#B9C7CF"
              style={styles.input}
              maxLength={3}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={[styles.chip, { backgroundColor: "#FBE7F0" }]}>
              <Text style={[styles.chipText, { color: "#A73E75" }]}>Sr: No</Text>
            </View>
            <TextInput
              value={draft.sr}
              onChangeText={t => handleNumField("sr", t)}
              keyboardType="number-pad"
              placeholder="1–3 digit"
              placeholderTextColor="#B9C7CF"
              style={styles.input}
              maxLength={3}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={[styles.chip, { backgroundColor: COLORS.bg }]}>
              <Text style={[styles.chipText, { color: COLORS.inkSoft }]}>ID</Text>
            </View>
            <View style={[styles.input, styles.idBox]}>
              <Text style={styles.idBoxText}>{idLabel}</Text>
            </View>
          </View>
        </View>

        <TickRule />

        <View style={styles.tableHeaderRow}>
          <Text style={styles.sectionTitle}>Physical Measurement</Text>
          <Text style={styles.filledCount}>{filledCount}/{POINTS.length} filled</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadText, { flex: 1.1 }]}>POINTS</Text>
            <Text style={[styles.tableHeadText, { flex: 1 }]}>THICKNESS (mm)</Text>
          </View>
          {POINTS.map((p, idx) => (
            <View key={p} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? COLORS.rowAlt : COLORS.surface }]}>
              <Text style={styles.pointLabel}>{p}</Text>
              <View style={{ flex: 1, padding: 7 }}>
                <TextInput
                  value={draft.values[idx]}
                  onChangeText={t => validateAndCommit(idx, t)}
                  onFocus={() => setActiveInput(idx)}
                  onBlur={() => { setActiveInput(null); onBlurPoint(idx); }}
                  keyboardType="decimal-pad"
                  placeholder="0.000"
                  placeholderTextColor="#B9C7CF"
                  style={[styles.valueInput, activeInput === idx && styles.valueInputActive]}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.saveBar}>
        <TouchableOpacity
          disabled={!canSave}
          onPress={onSave}
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        >
          <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>Save Measurement</Text>
        </TouchableOpacity>
      </View>

      <Watermark />

      <Modal visible={!!popup} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconCircle}>
                <Text style={{ color: COLORS.amber, fontWeight: "800", fontSize: 16 }}>!</Text>
              </View>
              <Text style={styles.modalTitle}>Check this value</Text>
            </View>
            <Text style={styles.modalMsg}>{popup?.msg}</Text>
            <TouchableOpacity onPress={() => setPopup(null)} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= GRAPH VIEW ================= */
function GraphView({ entry }) {
  const nums = entry.values.map(v => parseFloat(v));
  const min = Math.min(...nums), max = Math.max(...nums);
  const yMin = Math.floor((min - 0.02) * 40) / 40;
  const yMax = Math.ceil((max + 0.02) * 40) / 40;
  const steps = 6;
  const yTicks = Array.from({ length: steps + 1 }, (_, i) => yMin + (i * (yMax - yMin)) / steps);

  const W = 640, H = 310, ML = 54, MR = 16, MT = 20, MB = 78;
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const xFor = i => ML + (i / (nums.length - 1)) * plotW;
  const yFor = v => MT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const pathD = nums.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");

  const dsVal = nums[0], osVal = nums[nums.length - 1], cenVal = nums[POINTS.indexOf("Cen_P_11")];
  const wedge = Math.abs(dsVal - osVal);
  const crown = cenVal - ((dsVal + osVal) / 2);

  return (
    <View style={styles.graphCard}>
      <View style={styles.tagRow}>
        <View style={[styles.tag, { backgroundColor: COLORS.bg }]}><Text style={[styles.tagText, { color: "#33454F" }]}>{pad3(entry.sch)}/{pad3(entry.sr)}</Text></View>
        <View style={[styles.tag, { backgroundColor: COLORS.steel }]}><Text style={[styles.tagText, { color: "#fff" }]}>{entry.sample}</Text></View>
        <View style={[styles.tag, { backgroundColor: "#F7F1E4" }]}><Text style={[styles.tagText, { color: "#8A6412" }]}>{fmtDate(entry.ts)} · {fmtTime(entry.ts)}</Text></View>
        <View style={[styles.tag, { backgroundColor: "#EAF3EE" }]}><Text style={[styles.tagText, { color: "#2E6B4F" }]}>W: {wedge.toFixed(3)}</Text></View>
        <View style={[styles.tag, { backgroundColor: "#EDEBF7" }]}><Text style={[styles.tagText, { color: "#5B4B9E" }]}>C: {crown.toFixed(3)}</Text></View>
      </View>
      <Svg width="100%" height={200} viewBox={`0 0 ${W} ${H}`}>
        {yTicks.map((t, i) => (
          <React.Fragment key={i}>
            <Line x1={ML} x2={W - MR} y1={yFor(t)} y2={yFor(t)} stroke={COLORS.bg} strokeWidth="1" />
            <SvgText x={ML - 8} y={yFor(t) + 4} fontSize="9" fill={COLORS.inkSoft} textAnchor="end">{t.toFixed(3)}</SvgText>
          </React.Fragment>
        ))}
        <Path d={pathD} fill="none" stroke={COLORS.steel} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {nums.map((v, i) => (
          <Circle key={i} cx={xFor(i)} cy={yFor(v)} r="2.6" fill={COLORS.amber} stroke="#fff" strokeWidth="1" />
        ))}
        {POINTS.map((p, i) => (
          <SvgText key={p} x={xFor(i)} y={H - MB + 14} fontSize="7.5" fill={COLORS.inkSoft} textAnchor="end"
            transform={`rotate(-60 ${xFor(i)} ${H - MB + 14})`}>
            {p}
          </SvgText>
        ))}
        <SvgText x={12} y={16} fontSize="9" fill="#8FA0AA">mm</SvgText>
        <SvgText x={W - MR} y={H - 4} fontSize="9" fill={COLORS.inkSoft} fontWeight="bold" textAnchor="end">
          Kapil · {fmtDate(entry.ts)} {fmtTime(entry.ts)}
        </SvgText>
      </Svg>
    </View>
  );
}

/* ================= RESULT SCREEN ================= */
function ResultScreen({ entry, onNewEntry, onShare }) {
  return (
    <SafeAreaView style={styles.screen}>
      <AppBar title="Profile" onBack={onNewEntry} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={styles.successBanner}>
          <Text style={{ color: "#2E6B4F", fontWeight: "600", fontSize: 13 }}>✓ Measurement saved to device</Text>
        </View>

        <GraphView entry={entry} />

        <View style={[styles.table, { marginTop: 16 }]}>
          <View style={[styles.tableHead, { backgroundColor: COLORS.rowAlt }]}>
            <Text style={[styles.tableHeadText, { flex: 1.1, color: COLORS.inkSoft }]}>POINTS</Text>
            <Text style={[styles.tableHeadText, { flex: 1, color: COLORS.inkSoft }]}>THICKNESS (mm)</Text>
          </View>
          {POINTS.map((p, i) => (
            <View key={p} style={styles.resultRow}>
              <Text style={styles.pointLabel}>{p}</Text>
              <Text style={styles.resultValue}>{entry.values[i]}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.resultBottomBar}>
        <TouchableOpacity onPress={onNewEntry} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>New Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onShare(entry)} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>
      <Watermark />
    </SafeAreaView>
  );
}

/* ================= HISTORY SCREEN ================= */
function HistoryScreen({ entries, onBack, onOpen, onDelete, onShare }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (dateFrom && dateOnly(e.ts) < dateFrom) return false;
      if (dateTo && dateOnly(e.ts) > dateTo) return false;
      return true;
    }).sort((a, b) => b.ts - a.ts);
  }, [entries, dateFrom, dateTo]);

  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(e => e.id)));
  }
  function toggleOne(id) {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <AppBar
        title="History"
        onBack={onBack}
        rightLabel={selectMode ? "Done" : "Select"}
        onRight={() => { setSelectMode(s => !s); setSelected(new Set()); }}
      />

      <View style={styles.dateFilterRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateLabel}>FROM (YYYY-MM-DD)</Text>
          <TextInput value={dateFrom} onChangeText={setDateFrom} placeholder="2026-01-01" placeholderTextColor="#B9C7CF" style={styles.dateInput} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateLabel}>TO (YYYY-MM-DD)</Text>
          <TextInput value={dateTo} onChangeText={setDateTo} placeholder="2026-12-31" placeholderTextColor="#B9C7CF" style={styles.dateInput} />
        </View>
        {(dateFrom || dateTo) && (
          <TouchableOpacity onPress={() => { setDateFrom(""); setDateTo(""); }} style={styles.clearBtn}>
            <Text style={{ color: COLORS.inkSoft, fontWeight: "700", fontSize: 12 }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectMode && filtered.length > 0 && (
        <TouchableOpacity onPress={toggleAll} style={styles.selectAllRow}>
          <Checkbox checked={allSelected} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#33454F", marginLeft: 8 }}>Select all ({filtered.length})</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {filtered.length === 0 && (
          <Text style={{ textAlign: "center", color: "#8FA0AA", fontSize: 13, marginTop: 60 }}>
            No saved measurements in this range.
          </Text>
        )}
        {filtered.map(e => (
          <View key={e.id} style={styles.historyItemRow}>
            {selectMode && (
              <TouchableOpacity onPress={() => toggleOne(e.id)}>
                <Checkbox checked={selected.has(e.id)} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => !selectMode && onOpen(e)}
              style={styles.historyCard}
            >
              <View style={styles.historyCardTop}>
                <Text style={styles.historyId}>{pad3(e.sch)}/{pad3(e.sr)}</Text>
                <View style={[styles.tag, { backgroundColor: COLORS.steel }]}>
                  <Text style={[styles.tagText, { color: "#fff", fontSize: 10.5 }]}>{e.sample}</Text>
                </View>
              </View>
              <Text style={styles.historyDate}>{fmtDate(e.ts)} · {fmtTime(e.ts)}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {selectMode && selected.size > 0 && (
        <View style={styles.historyBottomBar}>
          <TouchableOpacity onPress={() => onShare(entries.filter(e => selected.has(e.id)))} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>Share ({selected.size})</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmDelete(true)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete ({selected.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      <Watermark />

      <Modal visible={confirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete {selected.size > 1 ? `${selected.size} records` : "this record"}?</Text>
            <Text style={[styles.modalMsg, { marginTop: 8 }]}>This cannot be undone.</Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setConfirmDelete(false)} style={styles.cancelBtn}>
                <Text style={{ color: "#33454F", fontWeight: "700", fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { onDelete(Array.from(selected)); setSelected(new Set()); setConfirmDelete(false); setSelectMode(false); }}
                style={styles.deleteConfirmBtn}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Checkbox({ checked }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>✓</Text>}
    </View>
  );
}

/* ================= PDF GENERATION ================= */
async function generateAndSharePdf(entries) {
  const html = `
    <html>
      <body style="font-family: -apple-system, sans-serif; padding: 24px; color:#1C2B36;">
        ${entries.map(entry => {
          const dsVal = parseFloat(entry.values[0]);
          const osVal = parseFloat(entry.values[entry.values.length - 1]);
          const cenVal = parseFloat(entry.values[POINTS.indexOf("Cen_P_11")]);
          const wedge = Math.abs(dsVal - osVal).toFixed(3);
          const crown = (cenVal - ((dsVal + osVal) / 2)).toFixed(3);
          return `
            <div style="margin-bottom: 40px; page-break-after: always;">
              <h2 style="color:#2E5C8A;">Physical_Profile — ${pad3(entry.sch)}/${pad3(entry.sr)} (${entry.sample})</h2>
              <p style="color:#5B6B76; font-size: 12px;">${fmtDate(entry.ts)} · ${fmtTime(entry.ts)}</p>
              <p style="font-size: 13px;"><b>Wedge:</b> ${wedge} mm &nbsp;&nbsp; <b>Crown:</b> ${crown} mm</p>
              <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
                <tr style="background:#2E5C8A; color:#fff;">
                  <th style="padding:8px; text-align:left; border:1px solid #ddd;">Points</th>
                  <th style="padding:8px; text-align:left; border:1px solid #ddd;">Thickness (mm)</th>
                </tr>
                ${POINTS.map((p, i) => `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #ddd; font-style:italic;">${p}</td>
                    <td style="padding:6px 8px; border:1px solid #ddd; font-weight:600;">${entry.values[i]}</td>
                  </tr>
                `).join("")}
              </table>
              <p style="text-align:right; color:#5B6B76; font-style:italic; font-weight:700; margin-top: 20px;">Kapil</p>
            </div>
          `;
        }).join("")}
      </body>
    </html>
  `;
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Physical Profile" });
  }
}

/* ================= ROOT APP ================= */
const emptyDraft = () => ({ sample: "", sch: "", sr: "", values: Array(POINTS.length).fill("") });

export default function App() {
  const [screen, setScreen] = useState("entry");
  const [draft, setDraft] = useState(emptyDraft());
  const [entries, setEntries] = useState([]);
  const [activeEntry, setActiveEntry] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadEntries().then(e => { setEntries(e); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (loaded) saveEntries(entries);
  }, [entries, loaded]);

  function handleSave() {
    const e = { id: uid(), ts: Date.now(), sample: draft.sample, sch: draft.sch, sr: draft.sr, values: [...draft.values] };
    setEntries(prev => [e, ...prev]);
    setActiveEntry(e);
    setScreen("result");
  }
  function handleNewEntry() {
    setDraft(emptyDraft());
    setScreen("entry");
  }
  function handleDelete(ids) {
    setEntries(prev => prev.filter(e => !ids.includes(e.id)));
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.steelDark} />
      {screen === "entry" && (
        <EntryScreen draft={draft} setDraft={setDraft} onSave={handleSave} onOpenHistory={() => setScreen("history")} />
      )}
      {screen === "result" && activeEntry && (
        <ResultScreen entry={activeEntry} onNewEntry={handleNewEntry} onShare={e => generateAndSharePdf([e])} />
      )}
      {screen === "history" && (
        <HistoryScreen
          entries={entries}
          onBack={() => setScreen("entry")}
          onOpen={e => { setActiveEntry(e); setScreen("result"); }}
          onDelete={handleDelete}
          onShare={list => generateAndSharePdf(list)}
        />
      )}
    </>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  appBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.steel,
  },
  appBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  appBarTitle: { color: "#fff", fontWeight: "700", fontSize: 17, marginLeft: 10 },
  appBarRightText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  iconBtn: { width: 44, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  backArrow: { color: "#fff", fontSize: 22, fontWeight: "700" },

  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: COLORS.inkSoft, marginBottom: 8 },
  sampleRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  sampleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: "#fff", alignItems: "center" },
  sampleBtnActive: { backgroundColor: COLORS.steel, borderColor: COLORS.steel },
  sampleBtnText: { fontWeight: "700", fontSize: 14.5, color: COLORS.ink },
  sampleBtnTextActive: { color: "#fff" },

  idRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  chip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 5 },
  chipText: { fontSize: 11, fontWeight: "700" },
  input: {
    borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 9, paddingHorizontal: 10,
    height: 40, fontSize: 14, fontWeight: "600", color: COLORS.ink, backgroundColor: "#fff",
  },
  idBox: { alignItems: "center", justifyContent: "center" },
  idBoxText: { fontWeight: "700", color: COLORS.ink, fontSize: 14 },

  tableHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  sectionTitle: { fontWeight: "700", fontSize: 15, color: COLORS.ink },
  filledCount: { fontSize: 12, color: COLORS.inkSoft },

  table: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" },
  tableHead: { flexDirection: "row", backgroundColor: COLORS.steel },
  tableHeadText: { color: "#fff", fontWeight: "700", fontSize: 12.5, padding: 10 },
  tableRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  pointLabel: { flex: 1.1, padding: 11, fontStyle: "italic", fontSize: 13, color: "#33454F" },
  valueInput: {
    borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, fontWeight: "600", color: COLORS.ink, backgroundColor: "#fff",
  },
  valueInputActive: { borderColor: COLORS.steel },

  saveBar: { padding: 16, paddingTop: 10 },
  saveBtn: { backgroundColor: COLORS.amber, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: COLORS.line },
  saveBtnText: { fontWeight: "700", fontSize: 15.5, color: COLORS.ink },
  saveBtnTextDisabled: { color: "#8FA0AA" },

  watermarkWrap: { position: "absolute", bottom: 6, right: 14 },
  watermarkText: { fontSize: 11.5, fontStyle: "italic", fontWeight: "700", color: COLORS.inkSoft },

  modalOverlay: { flex: 1, backgroundColor: "rgba(28,43,54,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 320 },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  modalIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FBEFE0", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontWeight: "700", fontSize: 15.5, color: COLORS.ink },
  modalMsg: { fontSize: 13.5, color: "#3E4E58", lineHeight: 19, marginBottom: 14 },
  modalBtn: { backgroundColor: COLORS.amber, borderRadius: 9, paddingVertical: 10, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  graphCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 11.5, fontWeight: "700" },

  successBanner: { backgroundColor: "#EAF3EE", borderWidth: 1, borderColor: "#CFE6D9", borderRadius: 10, padding: 12, marginBottom: 16 },

  resultRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.bg },
  resultValue: { flex: 1, padding: 8, fontWeight: "700", fontSize: 13, color: COLORS.ink },

  resultBottomBar: { flexDirection: "row", gap: 10, padding: 16 },
  secondaryBtn: { flex: 1, borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 12, paddingVertical: 13, alignItems: "center", backgroundColor: "#fff" },
  secondaryBtnText: { fontWeight: "700", fontSize: 14, color: "#33454F" },
  shareBtn: { flex: 1.3, backgroundColor: COLORS.teal, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  shareBtnText: { fontWeight: "700", fontSize: 14, color: "#fff" },

  dateFilterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 14, alignItems: "flex-end" },
  dateLabel: { fontSize: 10.5, fontWeight: "700", color: COLORS.inkSoft, marginBottom: 4 },
  dateInput: { borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 9, height: 38, paddingHorizontal: 10, fontSize: 12, color: COLORS.ink, backgroundColor: "#fff" },
  clearBtn: { height: 38, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  selectAllRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxChecked: { backgroundColor: COLORS.steel, borderColor: COLORS.steel },

  historyItemRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  historyCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  historyCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyId: { fontWeight: "700", fontSize: 14, color: COLORS.ink },
  historyDate: { fontSize: 11.5, color: "#8FA0AA", marginTop: 6 },

  historyBottomBar: { flexDirection: "row", gap: 10, padding: 16 },
  deleteBtn: { flex: 1, backgroundColor: COLORS.red, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: "#fff" },
  deleteConfirmBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9, backgroundColor: COLORS.red },
});
