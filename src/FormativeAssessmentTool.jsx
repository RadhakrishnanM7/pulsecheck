import React, { useState, useReducer, useRef, useMemo, useEffect, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  GraduationCap, Users, Home, PlusCircle, Upload, Download, Play, Square,
  ChevronLeft, ChevronRight, Trash2, Pencil, Check, X, Eye, EyeOff,
  FileSpreadsheet, LogOut, Cloud, CheckSquare, ToggleLeft, Crosshair,
  Type, AlignLeft, ListChecks, CircleDot, ImagePlus, BarChart3, Sparkles,
  Radio, Link2, QrCode, Copy, Share2, LogIn, AlertTriangle, ArrowRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { db } from "./firebaseConfig.js";
import {
  doc, collection, setDoc, updateDoc, onSnapshot, getDocs, writeBatch,
} from "firebase/firestore";

/* ============================== Constants ============================== */

const AVATARS = [
  { id: "giraffe", emoji: "\u{1F992}", name: "Giraffe" },
  { id: "bear", emoji: "\u{1F43B}", name: "Bear" },
  { id: "cat", emoji: "\u{1F431}", name: "Cat" },
  { id: "elephant", emoji: "\u{1F418}", name: "Elephant" },
  { id: "lion", emoji: "\u{1F981}", name: "Lion" },
  { id: "panda", emoji: "\u{1F43C}", name: "Panda" },
  { id: "fox", emoji: "\u{1F98A}", name: "Fox" },
  { id: "owl", emoji: "\u{1F989}", name: "Owl" },
  { id: "penguin", emoji: "\u{1F427}", name: "Penguin" },
  { id: "monkey", emoji: "\u{1F435}", name: "Monkey" },
  { id: "koala", emoji: "\u{1F428}", name: "Koala" },
  { id: "tiger", emoji: "\u{1F42F}", name: "Tiger" },
];
const avatarOf = (id) => AVATARS.find((a) => a.id === id) || AVATARS[0];

const TYPES = {
  mcq: { label: "Multiple choice", icon: CircleDot, graded: true },
  multiple: { label: "Multiple response", icon: ListChecks, graded: true },
  truefalse: { label: "True / False", icon: ToggleLeft, graded: true },
  wordcloud: { label: "Word cloud", icon: Cloud, graded: false },
  hotspot: { label: "Hotspot", icon: Crosshair, graded: true },
  shortanswer: { label: "Short answer", icon: Type, graded: true },
  longanswer: { label: "Long answer", icon: AlignLeft, graded: false },
  fillblank: { label: "Fill in the blank", icon: Pencil, graded: true },
};
const TYPE_ORDER = ["mcq", "multiple", "truefalse", "wordcloud", "hotspot", "shortanswer", "longanswer", "fillblank"];

const CLOUD_COLORS = ["#5B4FE9", "#8B7CF6", "#FF9F1C", "#12B76A", "#F04438", "#0EA5E9", "#EC4899", "#14B8A6"];

const uid = () => Math.random().toString(36).slice(2, 9);
const norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase().replace(/\s+/g, " ");

/* ============================== LaTeX (KaTeX) ============================== */

let katexPromise = null;
function loadKatex() {
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve) => {
    if (typeof window !== "undefined" && window.katex) return resolve(window.katex);
    try {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
      s.onload = () => resolve(window.katex || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    } catch (e) { resolve(null); }
  });
  return katexPromise;
}

function useKatex() {
  const [k, setK] = useState(typeof window !== "undefined" ? window.katex || null : null);
  useEffect(() => {
    let alive = true;
    loadKatex().then((x) => { if (alive) setK(x || null); });
    return () => { alive = false; };
  }, []);
  return k;
}

function splitMath(str) {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push({ value: str.slice(last, m.index) });
    if (m[1] != null) out.push({ math: true, display: true, value: m[1] });
    else out.push({ math: true, display: false, value: m[2] });
    last = re.lastIndex;
  }
  if (last < str.length) out.push({ value: str.slice(last) });
  return out;
}

// Renders a string that may contain $inline$ or $$display$$ LaTeX.
function MathText({ text }) {
  const katex = useKatex();
  if (text == null || text === "") return null;
  const str = String(text);
  if (!str.includes("$")) return <>{str}</>;
  const parts = splitMath(str);
  return (
    <>
      {parts.map((p, i) => {
        if (!p.math) return <React.Fragment key={i}>{p.value}</React.Fragment>;
        if (!katex) return <span key={i} className="fa-math-raw">{p.display ? `$$${p.value}$$` : `$${p.value}$`}</span>;
        let html = "";
        try { html = katex.renderToString(p.value, { displayMode: p.display, throwOnError: false }); }
        catch (e) { html = p.value; }
        return <span key={i} className={p.display ? "fa-math-block" : "fa-math-inline"} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </>
  );
}

const hasMath = (s) => typeof s === "string" && s.includes("$");

/* ============================== Seed data ============================== */

function opt(text, correct = false) { return { id: uid(), text, correct }; }

function seedQuestions() {
  return [
    {
      id: uid(), type: "mcq", points: 1,
      text: "The Laplace transform of the derivative $f'(t)$ is:",
      options: [opt("$sF(s) - f(0)$", true), opt("$F(s)/s$"), opt("$s^2 F(s)$"), opt("$F(s) - f(0)$")],
    },
    {
      id: uid(), type: "multiple", points: 2,
      text: "Which of the following are prime numbers? (select all)",
      options: [opt("2", true), opt("9"), opt("11", true), opt("15"), opt("17", true)],
    },
    {
      id: uid(), type: "truefalse", points: 1,
      text: "A continuous function on a closed interval $[a, b]$ attains its maximum.",
      options: [opt("True", true), opt("False")],
    },
    {
      id: uid(), type: "wordcloud", points: 0, maxWords: 3,
      text: "In one word, how do you feel about this topic so far?",
      options: [],
    },
    {
      id: uid(), type: "shortanswer", points: 1,
      text: "What is the derivative of $\\sin(x)$?",
      correctAnswer: "cos(x) | cosx | cos x",
      options: [],
    },
    {
      id: uid(), type: "fillblank", points: 1,
      text: "The order of the differential equation $\\dfrac{d^2y}{dx^2} + y = 0$ is ___.",
      correctAnswer: "2 | two",
      options: [],
    },
    {
      id: uid(), type: "longanswer", points: 0,
      text: "Explain, in your own words, why the next-generation matrix is used to derive $R_0$.",
      options: [],
    },
  ];
}

/* ============================== Grading ============================== */

function correctOptionIds(q) {
  return (q.options || []).filter((o) => o.correct).map((o) => o.id);
}
function acceptedList(raw) {
  return String(raw || "").split("|").map(norm).filter(Boolean);
}

// returns true | false | null (null = not auto-gradable / no answer)
function gradeResponse(q, answer) {
  if (answer == null || answer === "" || (Array.isArray(answer) && answer.length === 0)) return null;
  switch (q.type) {
    case "mcq": {
      const o = (q.options || []).find((x) => x.id === answer);
      return o ? !!o.correct : false;
    }
    case "truefalse": {
      const o = (q.options || []).find((x) => x.id === answer);
      return o ? !!o.correct : false;
    }
    case "multiple": {
      const chosen = new Set(answer);
      const correct = new Set(correctOptionIds(q));
      if (chosen.size !== correct.size) return false;
      for (const id of chosen) if (!correct.has(id)) return false;
      return true;
    }
    case "shortanswer":
      return acceptedList(q.correctAnswer).includes(norm(answer));
    case "fillblank": {
      const blanks = String(q.text).split(/___+/).length - 1 || 1;
      const perBlank = String(q.correctAnswer || "").split("|").map((s) => s.trim());
      const ansArr = Array.isArray(answer) ? answer : [answer];
      for (let i = 0; i < blanks; i++) {
        const accepted = String(perBlank[i] ?? perBlank[0] ?? "").split("/").map(norm).filter(Boolean);
        if (!accepted.includes(norm(ansArr[i]))) return false;
      }
      return true;
    }
    case "hotspot": {
      if (!answer || answer.x == null) return null;
      const regions = q.hotspots || [];
      return regions.some((r) => answer.x >= r.x && answer.x <= r.x + r.w && answer.y >= r.y && answer.y <= r.y + r.h);
    }
    default:
      return null; // wordcloud, longanswer
  }
}

/* ============================== CSV ============================== */

const CSV_HEADERS = ["type", "question", "option1", "option2", "option3", "option4", "option5", "option6", "correct", "points"];

function csvTemplate() {
  const rows = [
    CSV_HEADERS.join(","),
    'mcq,"What is 2 + 2?",3,4,5,6,,,2,1',
    'multiple,"Select the even numbers",1,2,3,4,,,"2|4",2',
    'truefalse,"The Earth is flat.",,,,,,,False,1',
    'shortanswer,"Capital city of France?",,,,,,,"Paris|paris",1',
    'fillblank,"Water has the chemical formula H___O.",,,,,,,2,1',
    'wordcloud,"One word to describe today\'s class",,,,,,,,0',
    'longanswer,"Summarise the key idea of the lesson.",,,,,,,,0',
  ];
  return rows.join("\n");
}

function questionFromCsvRow(row) {
  const type = norm(row.type);
  if (!TYPES[type]) return null;
  const q = { id: uid(), type, text: (row.question || "").trim(), points: Number(row.points) || 0, options: [] };
  const rawOpts = [row.option1, row.option2, row.option3, row.option4, row.option5, row.option6]
    .map((o) => (o == null ? "" : String(o).trim())).filter(Boolean);

  if (type === "mcq" || type === "multiple") {
    const correctTokens = String(row.correct || "").split("|").map((s) => s.trim()).filter(Boolean);
    q.options = rawOpts.map((t, i) => opt(t, correctTokens.includes(String(i + 1))));
  } else if (type === "truefalse") {
    const c = norm(row.correct);
    q.options = [opt("True", c === "true" || c === "1"), opt("False", c === "false" || c === "0" || c === "")];
    if (c !== "true" && c !== "false" && c !== "1" && c !== "0" && c !== "") {
      q.options = [opt("True", true), opt("False", false)];
    }
  } else if (type === "shortanswer" || type === "fillblank") {
    q.correctAnswer = String(row.correct || "").trim();
  } else if (type === "wordcloud") {
    q.maxWords = 3;
  }
  if (!q.text) return null;
  return q;
}

/* ============================== Root ============================== */

function LegacyApp() {
  const [role, setRole] = useState("home"); // home | teacher | student
  const [questions, setQuestions] = useState(seedQuestions);
  const [students, setStudents] = useState([]);
  const [responses, setResponses] = useState([]); // {qid, sid, answer, correct}
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState("lobby"); // lobby | running
  const [revealed, setRevealed] = useState({}); // qid -> bool
  const [currentStudentId, setCurrentStudentId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const upsertResponse = useCallback((qid, sid, answer, correct) => {
    setResponses((prev) => {
      const rest = prev.filter((r) => !(r.qid === qid && r.sid === sid));
      return [...rest, { qid, sid, answer, correct }];
    });
  }, []);

  const shared = {
    questions, setQuestions, students, setStudents, responses, setResponses,
    activeIndex, setActiveIndex, phase, setPhase, revealed, setRevealed,
    currentStudentId, setCurrentStudentId, upsertResponse, showToast,
  };

  return (
    <div className="fa-root">
      <Styles />
      <header className="fa-header">
        <div className="fa-brand">
          <div className="fa-logo"><Sparkles size={18} /></div>
          <div>
            <div className="fa-brand-name">PulseCheck</div>
            <div className="fa-brand-sub">Formative assessment studio</div>
          </div>
        </div>
        <nav className="fa-seg" role="tablist" aria-label="View">
          <button className={`fa-seg-btn ${role === "home" ? "on" : ""}`} onClick={() => setRole("home")}>
            <Home size={15} /> Home
          </button>
          <button className={`fa-seg-btn ${role === "teacher" ? "on" : ""}`} onClick={() => setRole("teacher")}>
            <GraduationCap size={15} /> Teacher
          </button>
          <button className={`fa-seg-btn ${role === "student" ? "on" : ""}`} onClick={() => setRole("student")}>
            <Users size={15} /> Student
          </button>
        </nav>
      </header>

      <main className="fa-main">
        {role === "home" && <HomeView {...shared} setRole={setRole} />}
        {role === "teacher" && <TeacherView {...shared} />}
        {role === "student" && <StudentView {...shared} />}
      </main>

      {toast && <div className="fa-toast" role="status">{toast}</div>}
    </div>
  );
}

/* ============================== Home ============================== */

function HomeView({ questions, students, responses, setRole }) {
  const answered = new Set(responses.map((r) => r.sid)).size;
  return (
    <div className="fa-home">
      <div className="fa-home-hero">
        <div className="fa-eyebrow">Live classroom pulse</div>
        <h1>Ask anything.<br /><span>See the room think.</span></h1>
        <p>Build eight kinds of questions, run them live, and watch responses land in real time.
          Students join with a name and an animal. Faculty walk away with a marked spreadsheet.</p>
        <div className="fa-home-cta">
          <button className="fa-btn fa-btn-primary" onClick={() => setRole("teacher")}>
            <GraduationCap size={16} /> Open teacher studio
          </button>
          <button className="fa-btn fa-btn-ghost" onClick={() => setRole("student")}>
            <Users size={16} /> Join as a student
          </button>
        </div>
        <div className="fa-home-stats">
          <div><b>{questions.length}</b><span>questions ready</span></div>
          <div><b>{students.length}</b><span>students joined</span></div>
          <div><b>{answered}</b><span>have responded</span></div>
        </div>
      </div>
      <div className="fa-home-types">
        {TYPE_ORDER.map((t) => {
          const Icon = TYPES[t].icon;
          return (
            <div key={t} className="fa-type-card">
              <div className="fa-type-ic"><Icon size={18} /></div>
              <div className="fa-type-name">{TYPES[t].label}</div>
              <div className="fa-type-tag">{TYPES[t].graded ? "auto-graded" : "open response"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== Teacher ============================== */

function TeacherView(props) {
  const [tab, setTab] = useState("manage");
  return (
    <div className="fa-teacher">
      <div className="fa-tabs">
        <button className={`fa-tab ${tab === "manage" ? "on" : ""}`} onClick={() => setTab("manage")}><Pencil size={15} /> Build</button>
        <button className={`fa-tab ${tab === "present" ? "on" : ""}`} onClick={() => setTab("present")}><Play size={15} /> Present</button>
        <button className={`fa-tab ${tab === "report" ? "on" : ""}`} onClick={() => setTab("report")}><BarChart3 size={15} /> Report</button>
      </div>
      {tab === "manage" && <BuildTab {...props} />}
      {tab === "present" && <PresentTab {...props} />}
      {tab === "report" && <ReportTab {...props} />}
    </div>
  );
}

/* ---------- Build tab ---------- */

function BuildTab({ questions, setQuestions, showToast }) {
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef(null);

  const editing = questions.find((q) => q.id === editingId) || null;

  const addNew = (type) => {
    const base = { id: uid(), type, text: "", points: TYPES[type].graded ? 1 : 0, options: [] };
    if (type === "mcq" || type === "multiple") base.options = [opt(""), opt(""), opt(""), opt("")];
    if (type === "truefalse") base.options = [opt("True", true), opt("False")];
    if (type === "shortanswer" || type === "fillblank") base.correctAnswer = "";
    if (type === "wordcloud") base.maxWords = 3;
    if (type === "hotspot") { base.image = null; base.hotspots = []; }
    setQuestions((p) => [...p, base]);
    setEditingId(base.id);
  };

  const updateQ = (patch) => setQuestions((p) => p.map((q) => (q.id === editingId ? { ...q, ...patch } : q)));
  const removeQ = (id) => {
    setQuestions((p) => p.filter((q) => q.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const onCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const parsed = (res.data || []).map(questionFromCsvRow).filter(Boolean);
        if (parsed.length === 0) { showToast("No valid rows found. Check the template columns."); }
        else { setQuestions((p) => [...p, ...parsed]); showToast(`Imported ${parsed.length} question${parsed.length > 1 ? "s" : ""}.`); }
        if (fileRef.current) fileRef.current.value = "";
      },
      error: () => showToast("Could not read that CSV file."),
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pulsecheck_question_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fa-build">
      <aside className="fa-build-list">
        <div className="fa-panel-head">
          <span>Question bank</span>
          <span className="fa-count">{questions.length}</span>
        </div>

        <div className="fa-bulk">
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={onCsv} id="csv-in" />
          <button className="fa-btn fa-btn-soft fa-btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Bulk upload CSV
          </button>
          <button className="fa-btn fa-btn-link fa-btn-sm" onClick={downloadTemplate}>
            <Download size={13} /> Template
          </button>
        </div>

        <div className="fa-qitems">
          {questions.length === 0 && <div className="fa-empty">No questions yet. Add one below.</div>}
          {questions.map((q, i) => {
            const Icon = TYPES[q.type].icon;
            return (
              <button key={q.id} className={`fa-qitem ${editingId === q.id ? "on" : ""}`} onClick={() => setEditingId(q.id)}>
                <span className="fa-qnum">{i + 1}</span>
                <span className="fa-qic"><Icon size={14} /></span>
                <span className="fa-qtext">{q.text || <em>Untitled question</em>}</span>
                <span className="fa-qdel" onClick={(e) => { e.stopPropagation(); removeQ(q.id); }} title="Delete">
                  <Trash2 size={13} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="fa-addwrap">
          <div className="fa-addlabel">Add a question</div>
          <div className="fa-addgrid">
            {TYPE_ORDER.map((t) => {
              const Icon = TYPES[t].icon;
              return (
                <button key={t} className="fa-addbtn" onClick={() => addNew(t)} title={TYPES[t].label}>
                  <Icon size={15} /><span>{TYPES[t].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="fa-editor">
        {!editing ? (
          <div className="fa-editor-empty">
            <PlusCircle size={30} />
            <p>Select a question to edit, or add a new one from the left.</p>
          </div>
        ) : (
          <QuestionEditor key={editing.id} q={editing} onChange={updateQ} showToast={showToast} />
        )}
      </section>
    </div>
  );
}

function QuestionEditor({ q, onChange, showToast }) {
  const Icon = TYPES[q.type].icon;

  const setOptText = (id, text) => onChange({ options: q.options.map((o) => (o.id === id ? { ...o, text } : o)) });
  const setCorrectSingle = (id) => onChange({ options: q.options.map((o) => ({ ...o, correct: o.id === id })) });
  const toggleCorrect = (id) => onChange({ options: q.options.map((o) => (o.id === id ? { ...o, correct: !o.correct } : o)) });
  const addOpt = () => onChange({ options: [...q.options, opt("")] });
  const removeOpt = (id) => onChange({ options: q.options.filter((o) => o.id !== id) });

  return (
    <div className="fa-qeditor">
      <div className="fa-qeditor-head">
        <span className="fa-badge"><Icon size={14} /> {TYPES[q.type].label}</span>
        <label className="fa-points">
          Points
          <input type="number" min="0" value={q.points}
            onChange={(e) => onChange({ points: Number(e.target.value) || 0 })} />
        </label>
      </div>

      <label className="fa-field">
        <span>Question prompt {q.type === "fillblank" && <em>(use ___ for each blank)</em>}</span>
        <textarea rows={2} value={q.text} placeholder="Type your question…  Use $x^2$ for inline math or $$\int_0^1 x\,dx$$ for display."
          onChange={(e) => onChange({ text: e.target.value })} />
        <div className="fa-hint">Wrap math in <code>$…$</code> (inline) or <code>$$…$$</code> (block). Example: <code>$\frac{"{"}d{"}"}{"{"}dx{"}"}\sin x = \cos x$</code></div>
        {hasMath(q.text) && (
          <div className="fa-math-preview"><span>Preview:</span> <MathText text={q.text} /></div>
        )}
      </label>

      {(q.type === "mcq" || q.type === "multiple") && (
        <div className="fa-options">
          <div className="fa-field-label">
            Options <em>{q.type === "mcq" ? "\u2014 pick the one correct answer" : "\u2014 tick every correct answer"}</em>
          </div>
          {q.options.map((o, i) => (
            <div key={o.id} className="fa-optrow">
              <button className={`fa-mark ${o.correct ? "on" : ""} ${q.type === "mcq" ? "radio" : "check"}`}
                onClick={() => (q.type === "mcq" ? setCorrectSingle(o.id) : toggleCorrect(o.id))}
                title="Mark correct" aria-label="Mark correct">
                {o.correct && <Check size={13} />}
              </button>
              <input value={o.text} placeholder={`Option ${i + 1}`} onChange={(e) => setOptText(o.id, e.target.value)} />
              <button className="fa-icbtn" onClick={() => removeOpt(o.id)} title="Remove option"><X size={14} /></button>
            </div>
          ))}
          <button className="fa-btn fa-btn-link fa-btn-sm" onClick={addOpt}><PlusCircle size={13} /> Add option</button>
        </div>
      )}

      {q.type === "truefalse" && (
        <div className="fa-tf">
          {q.options.map((o) => (
            <button key={o.id} className={`fa-tfbtn ${o.correct ? "on" : ""}`} onClick={() => setCorrectSingle(o.id)}>
              {o.correct && <Check size={14} />} {o.text}
            </button>
          ))}
          <div className="fa-hint">The highlighted answer is marked correct.</div>
        </div>
      )}

      {(q.type === "shortanswer" || q.type === "fillblank") && (
        <label className="fa-field">
          <span>Accepted answer(s) <em>separate alternatives with |</em></span>
          <input value={q.correctAnswer || ""} placeholder="e.g. cos(x) | cosx | cos x"
            onChange={(e) => onChange({ correctAnswer: e.target.value })} />
          {q.type === "fillblank" && (
            <div className="fa-hint">Multiple blanks: give each blank&apos;s answer in order separated by | (use / for alternatives within a blank).</div>
          )}
        </label>
      )}

      {q.type === "wordcloud" && (
        <label className="fa-field fa-field-inline">
          <span>Max words per student</span>
          <input type="number" min="1" max="10" value={q.maxWords || 3}
            onChange={(e) => onChange({ maxWords: Number(e.target.value) || 1 })} />
        </label>
      )}

      {q.type === "longanswer" && (
        <div className="fa-hint fa-callout">Open response — collected for review, not auto-graded.</div>
      )}

      {q.type === "hotspot" && <HotspotEditor q={q} onChange={onChange} showToast={showToast} />}
    </div>
  );
}

function HotspotEditor({ q, onChange, showToast }) {
  const wrapRef = useRef(null);
  const [draft, setDraft] = useState(null); // {x,y,w,h} normalized, while dragging

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ image: reader.result, hotspots: [] });
    reader.readAsDataURL(file);
  };

  const rectFrom = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const start = useRef(null);
  const onDown = (e) => { if (!q.image) return; start.current = rectFrom(e); setDraft({ x: start.current.x, y: start.current.y, w: 0, h: 0 }); };
  const onMove = (e) => {
    if (!start.current) return;
    const p = rectFrom(e); const s = start.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = () => {
    if (draft && draft.w > 0.02 && draft.h > 0.02) {
      onChange({ hotspots: [...(q.hotspots || []), draft] });
    }
    start.current = null; setDraft(null);
  };

  return (
    <div className="fa-hotspot-edit">
      <div className="fa-hotspot-bar">
        <label className="fa-btn fa-btn-soft fa-btn-sm">
          <ImagePlus size={14} /> {q.image ? "Replace image" : "Upload image"}
          <input type="file" accept="image/*" hidden onChange={onFile} />
        </label>
        {(q.hotspots?.length > 0) && (
          <button className="fa-btn fa-btn-link fa-btn-sm" onClick={() => onChange({ hotspots: [] })}>
            <Trash2 size={13} /> Clear areas
          </button>
        )}
        <span className="fa-hint">{q.image ? "Drag on the image to mark correct area(s)." : "Upload an image to begin."}</span>
      </div>
      {q.image && (
        <div className="fa-hotspot-canvas" ref={wrapRef}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <img src={q.image} alt="hotspot" draggable={false} />
          {(q.hotspots || []).map((h, i) => (
            <div key={i} className="fa-hs-region"
              style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }} />
          ))}
          {draft && (
            <div className="fa-hs-region draft"
              style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Present tab ---------- */

function PresentTab({ questions, responses, activeIndex, setActiveIndex, phase, setPhase, revealed, setRevealed, students }) {
  if (questions.length === 0) {
    return <div className="fa-empty-big">Add questions in the Build tab to start presenting.</div>;
  }

  if (phase === "lobby") {
    return (
      <Lobby
        students={students}
        canStart={questions.length > 0}
        onStart={() => { setActiveIndex(0); setPhase("running"); }}
        questionCount={questions.length}
      />
    );
  }

  const q = questions[activeIndex] || questions[questions.length - 1];
  const go = (d) => setActiveIndex((i) => Math.max(0, Math.min(questions.length - 1, i + d)));
  const qResponses = responses.filter((r) => r.qid === q.id);
  const isRevealed = !!revealed[q.id];
  const isLast = activeIndex === questions.length - 1;

  return (
    <div className="fa-present">
      <div className="fa-present-bar">
        <div className="fa-navdots">
          {questions.map((qq, i) => (
            <button key={qq.id} className={`fa-dot ${i === activeIndex ? "on" : ""}`} onClick={() => setActiveIndex(i)} title={`Q${i + 1}`} />
          ))}
        </div>
        <div className="fa-present-actions">
          <span className="fa-roster-pill"><Users size={13} /> {students.length} in room</span>
          <button className="fa-btn fa-btn-sm fa-btn-danger" onClick={() => setPhase("lobby")}>
            <Square size={14} /> End quiz
          </button>
        </div>
      </div>

      <div className="fa-stage">
        <div className="fa-stage-head">
          <span className="fa-badge"><b>Q{activeIndex + 1}</b> {TYPES[q.type].label}</span>
          <div className="fa-stage-meta">
            <span className="fa-livedot on" />Live
            <span className="fa-respcount"><Users size={13} /> {qResponses.length} / {students.length} responded</span>
          </div>
        </div>

        <h2 className="fa-stage-q"><MathText text={q.text || "Untitled question"} /></h2>

        {TYPES[q.type].graded && (
          <label className="fa-reveal">
            <input type="checkbox" checked={isRevealed}
              onChange={(e) => setRevealed((r) => ({ ...r, [q.id]: e.target.checked }))} />
            {isRevealed ? <Eye size={15} /> : <EyeOff size={15} />}
            Show correct answer
          </label>
        )}

        {TYPES[q.type].graded && <CorrectnessHistogram responses={qResponses} total={students.length} />}

        <LiveAggregate q={q} responses={qResponses} revealed={isRevealed} students={students} />
      </div>

      <div className="fa-present-foot">
        <button className="fa-btn fa-btn-ghost fa-btn-sm" onClick={() => go(-1)} disabled={activeIndex === 0}>
          <ChevronLeft size={15} /> Previous
        </button>
        <span className="fa-present-progress">{activeIndex + 1} / {questions.length}</span>
        {isLast ? (
          <button className="fa-btn fa-btn-primary fa-btn-sm" onClick={() => setPhase("lobby")}>
            Finish <Check size={15} />
          </button>
        ) : (
          <button className="fa-btn fa-btn-primary fa-btn-sm" onClick={() => go(1)}>
            Next question <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function Lobby({ students, canStart, onStart, questionCount }) {
  return (
    <div className="fa-lobby">
      <div className="fa-lobby-eyebrow">Waiting room</div>
      <h2 className="fa-lobby-title">
        {students.length === 0 ? "Waiting for players to join…" : `${students.length} player${students.length > 1 ? "s" : ""} ready`}
      </h2>
      <p className="fa-lobby-sub">Students join from the <b>Student</b> tab with a name and an animal. When everyone&apos;s in, start the quiz.</p>

      <div className="fa-lobby-stage">
        {students.length === 0 ? (
          <div className="fa-lobby-empty">
            <span className="fa-lobby-empty-emoji">🎬</span>
            <p>No one has joined yet.</p>
          </div>
        ) : (
          <div className="fa-dancers">
            {students.map((s, i) => (
              <div key={s.id} className="fa-dancer" style={{ animationDelay: `${(i % 8) * 0.12}s` }}>
                <span className="fa-dancer-av">{avatarOf(s.avatar).emoji}</span>
                <span className="fa-dancer-name">{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fa-lobby-foot">
        <div className="fa-lobby-count">
          <b>{students.length}</b>
          <span>student{students.length !== 1 ? "s" : ""} joined</span>
        </div>
        <button className="fa-btn fa-btn-primary fa-lobby-start" onClick={onStart} disabled={!canStart || students.length === 0}>
          <Play size={18} /> Start quiz
        </button>
        <div className="fa-lobby-qcount">{questionCount} question{questionCount !== 1 ? "s" : ""} loaded</div>
      </div>
    </div>
  );
}

function CorrectnessHistogram({ responses, total }) {
  const graded = responses.filter((r) => r.correct === true || r.correct === false);
  const correct = graded.filter((r) => r.correct === true).length;
  const wrong = graded.filter((r) => r.correct === false).length;
  const pending = Math.max(0, total - responses.length);
  const max = Math.max(1, correct, wrong, pending);
  const pct = graded.length ? Math.round((correct / graded.length) * 100) : 0;

  const bars = [
    { key: "correct", label: "Correct", value: correct, cls: "correct" },
    { key: "wrong", label: "Incorrect", value: wrong, cls: "wrong" },
    { key: "pending", label: "No answer", value: pending, cls: "pending" },
  ];

  return (
    <div className="fa-histo">
      <div className="fa-histo-head">
        <span>Live results</span>
        <span className="fa-histo-pct">{pct}% correct</span>
      </div>
      <div className="fa-histo-cols">
        {bars.map((b) => (
          <div key={b.key} className="fa-histo-col">
            <div className="fa-histo-bar-wrap">
              <span className="fa-histo-val">{b.value}</span>
              <div className={`fa-histo-bar ${b.cls}`} style={{ height: `${(b.value / max) * 100}%` }} />
            </div>
            <div className="fa-histo-label">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


function LiveAggregate({ q, responses, revealed, students }) {
  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  if (responses.length === 0) {
    return <div className="fa-await">Waiting for responses…</div>;
  }

  if (q.type === "mcq" || q.type === "multiple" || q.type === "truefalse") {
    const counts = {};
    q.options.forEach((o) => (counts[o.id] = 0));
    responses.forEach((r) => {
      const arr = Array.isArray(r.answer) ? r.answer : [r.answer];
      arr.forEach((a) => { if (counts[a] != null) counts[a] += 1; });
    });
    const max = Math.max(1, ...Object.values(counts));
    return (
      <div className="fa-bars">
        {q.options.map((o) => {
          const c = counts[o.id];
          const showCorrect = revealed && o.correct;
          return (
            <div key={o.id} className={`fa-bar-row ${showCorrect ? "correct" : ""}`}>
              <div className="fa-bar-label"><MathText text={o.text} />{showCorrect && <Check size={14} className="fa-bar-check" />}</div>
              <div className="fa-bar-track">
                <div className="fa-bar-fill" style={{ width: `${(c / max) * 100}%` }} />
              </div>
              <div className="fa-bar-count">{c}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (q.type === "wordcloud") {
    const freq = {};
    responses.forEach((r) => {
      (Array.isArray(r.answer) ? r.answer : [r.answer]).forEach((w) => {
        const k = norm(w); if (k) freq[k] = (freq[k] || 0) + 1;
      });
    });
    return <WordCloud freq={freq} />;
  }

  if (q.type === "hotspot") {
    return (
      <div className="fa-hotspot-live">
        {q.image ? (
          <div className="fa-hotspot-canvas view">
            <img src={q.image} alt="hotspot" draggable={false} />
            {revealed && (q.hotspots || []).map((h, i) => (
              <div key={i} className="fa-hs-region reveal"
                style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }} />
            ))}
            {responses.map((r, i) => r.answer && r.answer.x != null && (
              <div key={i} className={`fa-hs-dot ${r.correct ? "ok" : "no"}`}
                style={{ left: `${r.answer.x * 100}%`, top: `${r.answer.y * 100}%` }} />
            ))}
          </div>
        ) : <div className="fa-await">No image set for this hotspot.</div>}
      </div>
    );
  }

  // short / long / fillblank -> response list
  return (
    <div className="fa-resplist">
      {responses.map((r, i) => {
        const s = studentById[r.sid];
        const ans = Array.isArray(r.answer) ? r.answer.join(", ") : r.answer;
        return (
          <div key={i} className={`fa-respcard ${r.correct === true ? "ok" : r.correct === false ? "no" : ""}`}>
            <span className="fa-respav">{s ? avatarOf(s.avatar).emoji : "\u2753"}</span>
            <span className="fa-respans"><MathText text={ans} /></span>
            {r.correct === true && <Check size={14} className="fa-respmark ok" />}
            {r.correct === false && <X size={14} className="fa-respmark no" />}
          </div>
        );
      })}
      {revealed && (q.correctAnswer) && (
        <div className="fa-answer-key"><b>Accepted:</b> <MathText text={q.correctAnswer.split("|").map((s) => s.trim()).join("  \u00B7  ")} /></div>
      )}
    </div>
  );
}

function WordCloud({ freq }) {
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <div className="fa-await">Waiting for words…</div>;
  const counts = entries.map((e) => e[1]);
  const min = Math.min(...counts), max = Math.max(...counts);
  const size = (c) => (max === min ? 30 : 16 + ((c - min) / (max - min)) * 40);
  return (
    <div className="fa-wordcloud">
      {entries.map(([word, c], i) => (
        <span key={word} className="fa-word"
          style={{ fontSize: `${size(c)}px`, color: CLOUD_COLORS[i % CLOUD_COLORS.length] }}
          title={`${c} response${c > 1 ? "s" : ""}`}>
          {word}
        </span>
      ))}
    </div>
  );
}

/* ---------- Report tab ---------- */

function ReportTab({ questions, students, responses, showToast }) {
  const stats = useMemo(() => computeStats(questions, students, responses), [questions, students, responses]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();

    // Summary
    const summary = [
      ["PulseCheck \u2014 Assessment Report"],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Students joined", students.length],
      ["Questions", questions.length],
      ["Auto-graded questions", questions.filter((q) => TYPES[q.type].graded).length],
      ["Total marks available", stats.autoMax],
      ["Class average (%)", stats.avgPct],
      ["Highest score (%)", stats.highPct],
      ["Lowest score (%)", stats.lowPct],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

    // Student scores (wide: per-question correctness)
    const header = ["Student", "Avatar", "Score", "Out of", "Percent", ...questions.map((q, i) => `Q${i + 1}`)];
    const scoreRows = stats.perStudent.map((ps) => [
      ps.name, avatarOf(ps.avatar).name, ps.score, stats.autoMax,
      stats.autoMax ? Math.round((ps.score / stats.autoMax) * 100) : 0,
      ...questions.map((q) => {
        const r = responses.find((x) => x.qid === q.id && x.sid === ps.id);
        if (!r) return "\u2013";
        if (r.correct === true) return "Correct";
        if (r.correct === false) return "Wrong";
        return "Answered";
      }),
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...scoreRows]), "Student Scores");

    // Responses (long)
    const respHeader = ["Student", "Q#", "Type", "Question", "Answer", "Result", "Points"];
    const respRows = [];
    responses.forEach((r) => {
      const qi = questions.findIndex((q) => q.id === r.qid);
      if (qi < 0) return;
      const q = questions[qi];
      const s = students.find((x) => x.id === r.sid);
      const ans = Array.isArray(r.answer)
        ? (q.type === "multiple" ? r.answer.map((id) => (q.options.find((o) => o.id === id) || {}).text).filter(Boolean).join("; ") : r.answer.join("; "))
        : (q.type === "mcq" || q.type === "truefalse")
          ? ((q.options.find((o) => o.id === r.answer) || {}).text ?? r.answer)
          : (r.answer && r.answer.x != null ? `(${r.answer.x.toFixed(2)}, ${r.answer.y.toFixed(2)})` : r.answer);
      respRows.push([
        s ? s.name : "?", qi + 1, TYPES[q.type].label, q.text, ans,
        r.correct === true ? "Correct" : r.correct === false ? "Wrong" : "Ungraded",
        r.correct === true ? q.points : 0,
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([respHeader, ...respRows]), "Responses");

    // Item analysis
    const iaHeader = ["Q#", "Type", "Question", "Responses", "Correct", "% Correct"];
    const iaRows = questions.map((q, i) => {
      const rs = responses.filter((r) => r.qid === q.id);
      const correct = rs.filter((r) => r.correct === true).length;
      const graded = rs.filter((r) => r.correct !== null && r.correct !== undefined).length;
      return [i + 1, TYPES[q.type].label, q.text, rs.length, correct, graded ? Math.round((correct / graded) * 100) : "\u2013"];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([iaHeader, ...iaRows]), "Item Analysis");

    XLSX.writeFile(wb, `PulseCheck_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Report downloaded as .xlsx");
  };

  return (
    <div className="fa-report">
      <div className="fa-report-head">
        <div>
          <h2>Results</h2>
          <p>Auto-graded questions are scored live. Export a full marked workbook for your records.</p>
        </div>
        <button className="fa-btn fa-btn-primary" onClick={exportXlsx} disabled={students.length === 0}>
          <FileSpreadsheet size={16} /> Export .xlsx report
        </button>
      </div>

      <div className="fa-report-stats">
        <Stat label="Students" value={students.length} />
        <Stat label="Questions" value={questions.length} />
        <Stat label="Class average" value={`${stats.avgPct}%`} accent />
        <Stat label="Marks available" value={stats.autoMax} />
      </div>

      {students.length === 0 ? (
        <div className="fa-empty-big">No student responses yet. Run a session, then come back here.</div>
      ) : (
        <div className="fa-report-table">
          <div className="fa-tr fa-th">
            <div>Student</div><div>Score</div><div>Percent</div><div className="fa-th-bar">Attainment</div>
          </div>
          {stats.perStudent.map((ps) => {
            const pct = stats.autoMax ? Math.round((ps.score / stats.autoMax) * 100) : 0;
            return (
              <div key={ps.id} className="fa-tr">
                <div className="fa-td-name"><span>{avatarOf(ps.avatar).emoji}</span>{ps.name}</div>
                <div>{ps.score} / {stats.autoMax}</div>
                <div>{pct}%</div>
                <div className="fa-th-bar"><div className="fa-mini-track"><div className="fa-mini-fill" style={{ width: `${pct}%` }} /></div></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="fa-item-analysis">
        <h3>Item analysis</h3>
        {questions.map((q, i) => {
          const rs = responses.filter((r) => r.qid === q.id);
          const correct = rs.filter((r) => r.correct === true).length;
          const graded = rs.filter((r) => r.correct === true || r.correct === false).length;
          const pct = graded ? Math.round((correct / graded) * 100) : null;
          return (
            <div key={q.id} className="fa-ia-row">
              <span className="fa-qnum">{i + 1}</span>
              <span className="fa-ia-q">{q.text || <em>Untitled</em>}</span>
              <span className="fa-ia-type">{TYPES[q.type].label}</span>
              <span className="fa-ia-pct">{pct == null ? "\u2013" : `${pct}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return <div className={`fa-stat ${accent ? "accent" : ""}`}><b>{value}</b><span>{label}</span></div>;
}

function computeStats(questions, students, responses) {
  const autoMax = questions.filter((q) => TYPES[q.type].graded).reduce((s, q) => s + (q.points || 0), 0);
  const perStudent = students.map((s) => {
    const score = responses
      .filter((r) => r.sid === s.id && r.correct === true)
      .reduce((sum, r) => { const q = questions.find((x) => x.id === r.qid); return sum + (q ? q.points || 0 : 0); }, 0);
    return { id: s.id, name: s.name, avatar: s.avatar, score };
  });
  const pcts = perStudent.map((p) => (autoMax ? (p.score / autoMax) * 100 : 0));
  const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  return {
    autoMax, perStudent,
    avgPct, highPct: pcts.length ? Math.round(Math.max(...pcts)) : 0, lowPct: pcts.length ? Math.round(Math.min(...pcts)) : 0,
  };
}

/* ============================== Student ============================== */

function StudentView({ questions, students, setStudents, responses, activeIndex, phase, revealed, currentStudentId, setCurrentStudentId, upsertResponse, showToast }) {
  const me = students.find((s) => s.id === currentStudentId) || null;

  if (!me) {
    return <StudentLogin students={students} setStudents={setStudents} setCurrentStudentId={setCurrentStudentId} />;
  }

  const q = questions[activeIndex];
  const av = avatarOf(me.avatar);
  const running = phase === "running";

  return (
    <div className="fa-student">
      <div className="fa-student-bar">
        <div className="fa-me"><span className="fa-me-av">{av.emoji}</span><b>{me.name}</b></div>
        <button className="fa-btn fa-btn-link fa-btn-sm" onClick={() => setCurrentStudentId(null)}><LogOut size={14} /> Leave</button>
      </div>

      {!running ? (
        <div className="fa-wait">
          <div className="fa-wait-emoji fa-dance">{av.emoji}</div>
          <h2>You&apos;re in, {me.name}!</h2>
          <p>Hang tight — your teacher will start the quiz once everyone has joined.</p>
          <div className="fa-wait-tag">{students.length} player{students.length !== 1 ? "s" : ""} in the room</div>
        </div>
      ) : !q ? (
        <div className="fa-wait"><p>No questions available.</p></div>
      ) : (
        <StudentAnswer
          key={q.id + me.id}
          q={q} me={me}
          existing={responses.find((r) => r.qid === q.id && r.sid === me.id)}
          revealed={!!revealed[q.id]}
          onSubmit={(answer) => {
            const correct = gradeResponse(q, answer);
            upsertResponse(q.id, me.id, answer, correct);
            showToast("Answer sent!");
          }}
          index={activeIndex}
        />
      )}
    </div>
  );
}

function StudentLogin({ students, setStudents, setCurrentStudentId }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("giraffe");

  const join = () => {
    const clean = name.trim();
    if (!clean) return;
    const existing = students.find((s) => norm(s.name) === norm(clean));
    if (existing) { setCurrentStudentId(existing.id); return; }
    const s = { id: uid(), name: clean, avatar };
    setStudents((p) => [...p, s]);
    setCurrentStudentId(s.id);
  };

  return (
    <div className="fa-login">
      <div className="fa-login-card">
        <div className="fa-login-emoji">{avatarOf(avatar).emoji}</div>
        <h2>Join the class</h2>
        <label className="fa-field">
          <span>Your name</span>
          <input value={name} placeholder="Type your name"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()} autoFocus />
        </label>
        <div className="fa-field-label">Pick your animal</div>
        <div className="fa-avatars">
          {AVATARS.map((a) => (
            <button key={a.id} className={`fa-avatar ${avatar === a.id ? "on" : ""}`} onClick={() => setAvatar(a.id)} title={a.name}>
              <span>{a.emoji}</span>
            </button>
          ))}
        </div>
        <button className="fa-btn fa-btn-primary fa-btn-block" onClick={join} disabled={!name.trim()}>
          Join as {avatarOf(avatar).name}
        </button>
        {students.length > 0 && (
          <div className="fa-rejoin">
            <span>Already joined?</span>
            <div className="fa-rejoin-list">
              {students.map((s) => (
                <button key={s.id} className="fa-chip" onClick={() => setCurrentStudentId(s.id)}>
                  {avatarOf(s.avatar).emoji} {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentAnswer({ q, existing, revealed, onSubmit, index }) {
  const [single, setSingle] = useState(existing && !Array.isArray(existing.answer) ? existing.answer : null);
  const [multi, setMulti] = useState(existing && Array.isArray(existing.answer) ? existing.answer : []);
  const [text, setText] = useState(existing && typeof existing.answer === "string" ? existing.answer : "");
  const [words, setWords] = useState(existing && Array.isArray(existing.answer) ? existing.answer : []);
  const [wordInput, setWordInput] = useState("");
  const blanksCount = String(q.text).split(/___+/).length - 1 || 1;
  const [blanks, setBlanks] = useState(existing && Array.isArray(existing.answer) ? existing.answer : Array(blanksCount).fill(""));
  const [click, setClick] = useState(existing && existing.answer && existing.answer.x != null ? existing.answer : null);
  const imgRef = useRef(null);

  const submitted = !!existing;

  const submit = () => {
    if (q.type === "mcq" || q.type === "truefalse") { if (single) onSubmit(single); }
    else if (q.type === "multiple") { if (multi.length) onSubmit(multi); }
    else if (q.type === "shortanswer" || q.type === "longanswer") { if (text.trim()) onSubmit(text.trim()); }
    else if (q.type === "fillblank") { if (blanks.some((b) => b.trim())) onSubmit(blanks); }
    else if (q.type === "wordcloud") { if (words.length) onSubmit(words); }
    else if (q.type === "hotspot") { if (click) onSubmit(click); }
  };

  const addWord = () => {
    const w = wordInput.trim();
    if (w && words.length < (q.maxWords || 3)) { setWords([...words, w]); setWordInput(""); }
  };

  const onImgClick = (e) => {
    if (submitted) return;
    const r = imgRef.current.getBoundingClientRect();
    setClick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const correctText = () => {
    if (q.type === "mcq" || q.type === "truefalse") return (q.options.find((o) => o.correct) || {}).text;
    if (q.type === "multiple") return q.options.filter((o) => o.correct).map((o) => o.text).join(", ");
    if (q.correctAnswer) return q.correctAnswer.split("|").map((s) => s.trim()).join(" / ");
    return null;
  };

  return (
    <div className="fa-answer">
      <div className="fa-answer-num">Question {index + 1}</div>
      <h2 className="fa-answer-q">
        {q.type === "fillblank"
          ? renderBlanks(q.text, blanks, setBlanks, submitted)
          : (q.text ? <MathText text={q.text} /> : <em>Untitled question</em>)}
      </h2>

      {(q.type === "mcq" || q.type === "truefalse") && (
        <div className={`fa-choices ${q.type === "truefalse" ? "tf" : ""}`}>
          {q.options.map((o) => {
            const chosen = single === o.id;
            const showR = revealed && submitted;
            const cls = showR ? (o.correct ? "correct" : chosen ? "wrong" : "") : chosen ? "chosen" : "";
            return (
              <button key={o.id} className={`fa-choice ${cls}`} disabled={submitted} onClick={() => setSingle(o.id)}>
                <span className="fa-choice-mark">{(chosen || (showR && o.correct)) && <Check size={15} />}</span>
                <MathText text={o.text} />
              </button>
            );
          })}
        </div>
      )}

      {q.type === "multiple" && (
        <div className="fa-choices">
          {q.options.map((o) => {
            const chosen = multi.includes(o.id);
            const showR = revealed && submitted;
            const cls = showR ? (o.correct ? "correct" : chosen ? "wrong" : "") : chosen ? "chosen" : "";
            return (
              <button key={o.id} className={`fa-choice ${cls}`} disabled={submitted}
                onClick={() => setMulti((m) => (m.includes(o.id) ? m.filter((x) => x !== o.id) : [...m, o.id]))}>
                <span className="fa-choice-mark check">{chosen && <Check size={15} />}</span>
                <MathText text={o.text} />
              </button>
            );
          })}
        </div>
      )}

      {(q.type === "shortanswer") && (
        <div className="fa-shortwrap">
          <input className="fa-answer-input" disabled={submitted} value={text}
            placeholder="Type your answer (you can use $LaTeX$)" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          {hasMath(text) && !submitted && (
            <div className="fa-math-preview"><span>Preview:</span> <MathText text={text} /></div>
          )}
        </div>
      )}

      {q.type === "longanswer" && (
        <textarea className="fa-answer-textarea" disabled={submitted} rows={5} value={text}
          placeholder="Write your response…" onChange={(e) => setText(e.target.value)} />
      )}

      {q.type === "wordcloud" && (
        <div className="fa-wordinput">
          <div className="fa-wordchips">
            {words.map((w, i) => (
              <span key={i} className="fa-wchip">{w}{!submitted && <button onClick={() => setWords(words.filter((_, x) => x !== i))}><X size={12} /></button>}</span>
            ))}
          </div>
          {!submitted && words.length < (q.maxWords || 3) && (
            <div className="fa-wordadd">
              <input value={wordInput} placeholder="Add a word" onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWord()} />
              <button className="fa-btn fa-btn-soft fa-btn-sm" onClick={addWord}>Add</button>
            </div>
          )}
          <div className="fa-hint">Up to {q.maxWords || 3} word{(q.maxWords || 3) > 1 ? "s" : ""}.</div>
        </div>
      )}

      {q.type === "hotspot" && q.image && (
        <div className="fa-hotspot-canvas answer" onClick={onImgClick} ref={imgRef}>
          <img src={q.image} alt="hotspot" draggable={false} />
          {click && <div className={`fa-hs-dot me ${revealed && submitted ? (existing.correct ? "ok" : "no") : ""}`} style={{ left: `${click.x * 100}%`, top: `${click.y * 100}%` }} />}
          {revealed && submitted && (q.hotspots || []).map((h, i) => (
            <div key={i} className="fa-hs-region reveal" style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }} />
          ))}
        </div>
      )}

      {!submitted ? (
        <button className="fa-btn fa-btn-primary fa-btn-block" onClick={submit}>Submit answer</button>
      ) : (
        <div className="fa-submitted">
          <div className={`fa-submitted-badge ${existing.correct === true ? "ok" : existing.correct === false ? "no" : "sent"}`}>
            {existing.correct === true ? <><Check size={16} /> Correct!</>
              : existing.correct === false ? <><X size={16} /> Not quite</>
              : <><Check size={16} /> Answer received</>}
          </div>
          {revealed && existing.correct === false && correctText() && (
            <div className="fa-answer-key">Correct answer: <b><MathText text={correctText()} /></b></div>
          )}
        </div>
      )}
    </div>
  );
}

function renderBlanks(text, blanks, setBlanks, disabled) {
  const parts = String(text).split(/___+/);
  return (
    <span>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          <MathText text={p} />
          {i < parts.length - 1 && (
            <input className="fa-blank" disabled={disabled} value={blanks[i] || ""}
              onChange={(e) => { const n = [...blanks]; n[i] = e.target.value; setBlanks(n); }} />
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

/* ============================== Styles ============================== */

/* ============================== Realtime layer (Firestore) ============================== */

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = (n = 4) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const sanitize = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const joinUrl = (code) => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#join-${code}`;
};
function parseHash() {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "");
  const m = h.match(/^join-([A-Za-z0-9]+)/i);
  if (m) return { mode: "join", code: m[1].toUpperCase() };
  if (/^join/i.test(h)) return { mode: "join", code: null };
  return { mode: "host" };
}
function saveMe(code, m) { try { localStorage.setItem("pulsecheck:" + code, JSON.stringify(m)); } catch (e) {} }
function loadMe(code) { try { const s = localStorage.getItem("pulsecheck:" + code); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ---- Firestore writes ----
async function fbCreateRoom(code, questions, hostId) {
  const batch = writeBatch(db);
  batch.set(doc(db, "rooms", code), { phase: "lobby", activeIndex: 0, questionCount: questions.length, revealed: {}, hostId, createdAt: Date.now() });
  questions.forEach((q, i) => batch.set(doc(db, "rooms", code, "questions", String(i)), { ...sanitize(q), _i: i }));
  await batch.commit();
}
async function fbSyncQuestions(code, questions) {
  const batch = writeBatch(db);
  batch.update(doc(db, "rooms", code), { questionCount: questions.length });
  questions.forEach((q, i) => batch.set(doc(db, "rooms", code, "questions", String(i)), { ...sanitize(q), _i: i }));
  await batch.commit();
}
const fbSetMeta = (code, patch) => updateDoc(doc(db, "rooms", code), patch);
const fbJoin = (code, sid, s) => setDoc(doc(db, "rooms", code, "students", sid), { name: s.name, avatar: s.avatar, joinedAt: Date.now() });
const fbSubmit = (code, sid, qid, answer, correct) =>
  setDoc(doc(db, "rooms", code, "responses", sid), { [qid]: { answer: sanitize(answer), correct: correct === null || correct === undefined ? "ungraded" : correct } }, { merge: true });
async function fbGetQuestions(code) {
  const snap = await getDocs(collection(db, "rooms", code, "questions"));
  const arr = [];
  snap.forEach((d) => { const v = d.data(); arr[v._i ?? arr.length] = v; });
  return arr.filter(Boolean);
}

// ---- Firestore subscriptions ----
function useMeta(code) {
  const [meta, setMeta] = useState({ loading: true, exists: true });
  useEffect(() => {
    if (!db || !code) { setMeta({ loading: false, exists: false }); return; }
    setMeta({ loading: true, exists: true });
    return onSnapshot(doc(db, "rooms", code),
      (snap) => snap.exists() ? setMeta({ loading: false, exists: true, ...snap.data() }) : setMeta({ loading: false, exists: false }),
      () => setMeta({ loading: false, exists: false }));
  }, [code]);
  return meta;
}
function useStudents(code) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!db || !code) { setList([]); return; }
    return onSnapshot(collection(db, "rooms", code, "students"), (snap) => {
      const a = []; snap.forEach((d) => a.push({ id: d.id, ...d.data() }));
      a.sort((x, y) => (x.joinedAt || 0) - (y.joinedAt || 0));
      setList(a);
    });
  }, [code]);
  return list;
}
function useResponses(code) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!db || !code) { setList([]); return; }
    return onSnapshot(collection(db, "rooms", code, "responses"), (snap) => {
      const out = [];
      snap.forEach((d) => {
        const sid = d.id, data = d.data();
        Object.entries(data).forEach(([qid, v]) => out.push({ sid, qid, answer: v.answer, correct: v.correct === "ungraded" ? null : v.correct }));
      });
      setList(out);
    });
  }, [code]);
  return list;
}

function useToast() {
  const [t, setT] = useState(null);
  const ref = useRef();
  const show = useCallback((m) => { setT(m); clearTimeout(ref.current); ref.current = setTimeout(() => setT(null), 2600); }, []);
  return [t, show];
}
const Toast = ({ t }) => (t ? <div className="fa-toast" role="status">{t}</div> : null);

/* ============================== Root router ============================== */

export default function App() {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  if (!db) return <div className="fa-root"><Styles /><SetupNotice /></div>;
  return route.mode === "join" ? <JoinApp initialCode={route.code} /> : <HostApp />;
}

function SetupNotice() {
  return (
    <div className="fa-setup">
      <div className="fa-setup-card">
        <div className="fa-setup-ic"><AlertTriangle size={26} /></div>
        <h2>One quick step: connect Firebase</h2>
        <p>Your app is ready, but it needs a free Firebase project so students on other devices can join.
          Open <code>src/firebaseConfig.js</code> and paste your project&apos;s config where shown. Full
          step-by-step instructions are in the <b>README.md</b> that came in the zip.</p>
        <p className="fa-setup-small">Until then, everything else works — you just won&apos;t get live join links.</p>
      </div>
    </div>
  );
}

/* ============================== Host (teacher) ============================== */

function HostApp() {
  const [questions, setQuestions] = useState(seedQuestions);
  const [roomCode, setRoomCode] = useState(null);
  const [tab, setTab] = useState("build");
  const [toast, show] = useToast();
  const hostId = useMemo(() => uid(), []);

  const meta = useMeta(roomCode);
  const students = useStudents(roomCode);
  const responses = useResponses(roomCode);

  useEffect(() => {
    if (db && roomCode) fbSyncQuestions(roomCode, questions).catch(() => show("Question sync failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, roomCode]);

  const createRoom = async () => {
    if (questions.length === 0) return show("Add at least one question first.");
    const code = makeCode(4);
    try { await fbCreateRoom(code, questions, hostId); setRoomCode(code); setTab("present"); show("Room " + code + " is live"); }
    catch (e) { console.error(e); show("Could not create room — check your Firebase setup."); }
  };
  const startQuiz = () => fbSetMeta(roomCode, { activeIndex: 0, phase: "running" }).catch(() => {});
  const endQuiz = () => fbSetMeta(roomCode, { phase: "lobby" }).catch(() => {});
  const setActive = (i) => fbSetMeta(roomCode, { activeIndex: i }).catch(() => {});
  const setReveal = (qid, v) => fbSetMeta(roomCode, { ["revealed." + qid]: v }).catch(() => {});

  return (
    <div className="fa-root">
      <Styles />
      <header className="fa-header">
        <div className="fa-brand">
          <div className="fa-logo"><Sparkles size={18} /></div>
          <div>
            <div className="fa-brand-name">PulseCheck</div>
            <div className="fa-brand-sub">Teacher studio</div>
          </div>
        </div>
        <nav className="fa-seg" role="tablist">
          <button className={`fa-seg-btn ${tab === "build" ? "on" : ""}`} onClick={() => setTab("build")}><Pencil size={15} /> Build</button>
          <button className={`fa-seg-btn ${tab === "present" ? "on" : ""}`} onClick={() => setTab("present")}><Play size={15} /> Present</button>
          <button className={`fa-seg-btn ${tab === "report" ? "on" : ""}`} onClick={() => setTab("report")}><BarChart3 size={15} /> Report</button>
        </nav>
      </header>
      <main className="fa-main">
        {tab === "build" && <BuildTab questions={questions} setQuestions={setQuestions} showToast={show} />}
        {tab === "present" && (
          <HostPresent
            questions={questions} roomCode={roomCode} meta={meta} students={students} responses={responses}
            onCreate={createRoom} onStart={startQuiz} onEnd={endQuiz} setActive={setActive} setReveal={setReveal}
          />
        )}
        {tab === "report" && <ReportTab questions={questions} students={students} responses={responses} showToast={show} />}
      </main>
      <Toast t={toast} />
    </div>
  );
}

function GoLivePanel({ questions, onCreate }) {
  return (
    <div className="fa-golive">
      <div className="fa-golive-ic"><Radio size={30} /></div>
      <h2>Go live</h2>
      <p>Create a room to get a join link, a room code, and a QR code your students can use from their own phones.</p>
      <button className="fa-btn fa-btn-primary fa-golive-btn" onClick={onCreate} disabled={questions.length === 0}>
        <Radio size={17} /> Create room &amp; get join link
      </button>
      <div className="fa-golive-note">{questions.length} question{questions.length !== 1 ? "s" : ""} ready to send</div>
    </div>
  );
}

function ShareBlock({ code, compact }) {
  const url = joinUrl(code);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };
  const share = () => { try { if (navigator.share) navigator.share({ title: "Join my PulseCheck quiz", url }); } catch (e) {} };
  return (
    <div className={`fa-share ${compact ? "compact" : ""}`}>
      <div className="fa-share-main">
        <div className="fa-share-code">
          <span>Room code</span>
          <b>{code}</b>
        </div>
        <div className="fa-share-links">
          <div className="fa-share-linkrow">
            <Link2 size={15} />
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </div>
          <div className="fa-share-btns">
            <button className="fa-btn fa-btn-soft fa-btn-sm" onClick={copy}><Copy size={13} /> {copied ? "Copied!" : "Copy link"}</button>
            {typeof navigator !== "undefined" && navigator.share && (
              <button className="fa-btn fa-btn-soft fa-btn-sm" onClick={share}><Share2 size={13} /> Share</button>
            )}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="fa-share-qr">
          <div className="fa-qr-box"><QRCodeSVG value={url} size={128} bgColor="transparent" fgColor="#181735" /></div>
          <span><QrCode size={12} /> Scan to join</span>
        </div>
      )}
    </div>
  );
}

function HostPresent({ questions, roomCode, meta, students, responses, onCreate, onStart, onEnd, setActive, setReveal }) {
  if (!roomCode) return <GoLivePanel questions={questions} onCreate={onCreate} />;
  if (meta.loading) return <div className="fa-empty-big">Connecting to room…</div>;

  const phase = meta.phase || "lobby";
  const activeIndex = meta.activeIndex || 0;
  const revealed = meta.revealed || {};

  if (phase === "lobby") {
    return (
      <div className="fa-lobby">
        <div className="fa-lobby-eyebrow">Waiting room · live</div>
        <h2 className="fa-lobby-title">{students.length === 0 ? "Share the link — waiting for players…" : `${students.length} player${students.length > 1 ? "s" : ""} ready`}</h2>
        <ShareBlock code={roomCode} />
        <div className="fa-lobby-stage">
          {students.length === 0 ? (
            <div className="fa-lobby-empty"><span className="fa-lobby-empty-emoji">🎬</span><p>No one has joined yet.</p></div>
          ) : (
            <div className="fa-dancers">
              {students.map((s, i) => (
                <div key={s.id} className="fa-dancer" style={{ animationDelay: `${(i % 8) * 0.12}s` }}>
                  <span className="fa-dancer-av">{avatarOf(s.avatar).emoji}</span>
                  <span className="fa-dancer-name">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="fa-lobby-foot">
          <div className="fa-lobby-count"><b>{students.length}</b><span>student{students.length !== 1 ? "s" : ""} joined</span></div>
          <button className="fa-btn fa-btn-primary fa-lobby-start" onClick={onStart} disabled={students.length === 0}>
            <Play size={18} /> Start quiz
          </button>
          <div className="fa-lobby-qcount">{questions.length} question{questions.length !== 1 ? "s" : ""} loaded</div>
        </div>
      </div>
    );
  }

  const q = questions[activeIndex] || questions[questions.length - 1];
  const qResponses = responses.filter((r) => r.qid === q.id);
  const isRevealed = !!revealed[q.id];
  const isLast = activeIndex === questions.length - 1;

  return (
    <div className="fa-present">
      <div className="fa-present-bar">
        <div className="fa-navdots">
          {questions.map((qq, i) => <button key={qq.id} className={`fa-dot ${i === activeIndex ? "on" : ""}`} onClick={() => setActive(i)} title={`Q${i + 1}`} />)}
        </div>
        <div className="fa-present-actions">
          <span className="fa-roster-pill"><Radio size={13} /> {roomCode}</span>
          <span className="fa-roster-pill"><Users size={13} /> {students.length}</span>
          <button className="fa-btn fa-btn-sm fa-btn-danger" onClick={onEnd}><Square size={14} /> End</button>
        </div>
      </div>

      <div className="fa-stage">
        <div className="fa-stage-head">
          <span className="fa-badge"><b>Q{activeIndex + 1}</b> {TYPES[q.type].label}</span>
          <div className="fa-stage-meta">
            <span className="fa-livedot on" />Live
            <span className="fa-respcount"><Users size={13} /> {qResponses.length} / {students.length} responded</span>
          </div>
        </div>
        <h2 className="fa-stage-q"><MathText text={q.text || "Untitled question"} /></h2>
        {TYPES[q.type].graded && (
          <label className="fa-reveal">
            <input type="checkbox" checked={isRevealed} onChange={(e) => setReveal(q.id, e.target.checked)} />
            {isRevealed ? <Eye size={15} /> : <EyeOff size={15} />} Show correct answer
          </label>
        )}
        {TYPES[q.type].graded && <CorrectnessHistogram responses={qResponses} total={students.length} />}
        <LiveAggregate q={q} responses={qResponses} revealed={isRevealed} students={students} />
      </div>

      <div className="fa-present-foot">
        <button className="fa-btn fa-btn-ghost fa-btn-sm" onClick={() => setActive(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}><ChevronLeft size={15} /> Previous</button>
        <span className="fa-present-progress">{activeIndex + 1} / {questions.length}</span>
        {isLast ? (
          <button className="fa-btn fa-btn-primary fa-btn-sm" onClick={onEnd}>Finish <Check size={15} /></button>
        ) : (
          <button className="fa-btn fa-btn-primary fa-btn-sm" onClick={() => setActive(activeIndex + 1)}>Next question <ChevronRight size={15} /></button>
        )}
      </div>
    </div>
  );
}

/* ============================== Join (student) ============================== */

function JoinApp({ initialCode }) {
  const [code, setCode] = useState((initialCode || "").toUpperCase());
  const [me, setMe] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [myResp, setMyResp] = useState({});
  const [toast, show] = useToast();

  const meta = useMeta(code);

  useEffect(() => { setMe(code ? loadMe(code) : null); }, [code]);
  useEffect(() => {
    if (db && code) fbGetQuestions(code).then(setQuestions).catch(() => {});
  }, [code]);

  const goToCode = (c) => { const cc = c.toUpperCase(); window.location.hash = "join-" + cc; setCode(cc); };
  const leave = () => { saveMe(code, null); try { localStorage.removeItem("pulsecheck:" + code); } catch (e) {} setMe(null); };

  if (!db) return <div className="fa-root"><Styles /><SetupNotice /></div>;

  if (!code) {
    return <div className="fa-root"><Styles /><main className="fa-main"><JoinCodeEntry onSubmit={goToCode} /></main><Toast t={toast} /></div>;
  }
  if (meta.loading) {
    return <div className="fa-root"><Styles /><main className="fa-main"><div className="fa-empty-big">Connecting…</div></main></div>;
  }
  if (!meta.exists) {
    return <div className="fa-root"><Styles /><main className="fa-main"><JoinCodeEntry error={`No live quiz found for code “${code}”.`} onSubmit={goToCode} /></main></div>;
  }
  if (!me) {
    return (
      <div className="fa-root"><Styles /><main className="fa-main">
        <StudentJoinForm code={code} onJoined={(m) => { saveMe(code, m); setMe(m); }} show={show} />
      </main><Toast t={toast} /></div>
    );
  }

  const phase = meta.phase || "lobby";
  const activeIndex = meta.activeIndex || 0;
  const revealed = meta.revealed || {};
  const av = avatarOf(me.avatar);
  const q = questions && questions[activeIndex];

  const submit = (answer) => {
    if (!q) return;
    const correct = gradeResponse(q, answer);
    fbSubmit(code, me.sid, q.id, answer, correct)
      .then(() => { setMyResp((p) => ({ ...p, [q.id]: { answer, correct } })); show("Answer sent!"); })
      .catch(() => show("Send failed — check your connection."));
  };

  return (
    <div className="fa-root"><Styles />
      <main className="fa-main">
        <div className="fa-student">
          <div className="fa-student-bar">
            <div className="fa-me"><span className="fa-me-av">{av.emoji}</span><b>{me.name}</b><span className="fa-me-room">· {code}</span></div>
            <button className="fa-btn fa-btn-link fa-btn-sm" onClick={leave}><LogOut size={14} /> Leave</button>
          </div>
          {phase !== "running" ? (
            <div className="fa-wait">
              <div className="fa-wait-emoji fa-dance">{av.emoji}</div>
              <h2>You&apos;re in, {me.name}!</h2>
              <p>Hang tight — your teacher will start the quiz once everyone has joined.</p>
            </div>
          ) : !q ? (
            <div className="fa-wait"><p>Loading question…</p></div>
          ) : (
            <StudentAnswer key={q.id} q={q} existing={myResp[q.id]} revealed={!!revealed[q.id]} index={activeIndex} onSubmit={submit} />
          )}
        </div>
      </main>
      <Toast t={toast} />
    </div>
  );
}

function JoinCodeEntry({ onSubmit, error }) {
  const [code, setCode] = useState("");
  const go = () => { if (code.trim()) onSubmit(code.trim()); };
  return (
    <div className="fa-login">
      <div className="fa-login-card">
        <div className="fa-login-emoji"><LogIn size={44} /></div>
        <h2>Join a quiz</h2>
        {error && <div className="fa-join-error"><AlertTriangle size={14} /> {error}</div>}
        <label className="fa-field">
          <span>Enter the room code</span>
          <input className="fa-code-input" value={code} placeholder="e.g. 4KQP" maxLength={8}
            onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && go()} autoFocus />
        </label>
        <button className="fa-btn fa-btn-primary fa-btn-block" onClick={go} disabled={!code.trim()}>
          Continue <ArrowRight size={16} />
        </button>
        <p className="fa-join-hint">Your teacher will show the code, a link, or a QR code to scan.</p>
      </div>
    </div>
  );
}

function StudentJoinForm({ code, onJoined, show }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("giraffe");
  const [busy, setBusy] = useState(false);
  const join = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    const sid = uid();
    try { await fbJoin(code, sid, { name: clean, avatar }); onJoined({ sid, name: clean, avatar }); }
    catch (e) { setBusy(false); show("Could not join — please try again."); }
  };
  return (
    <div className="fa-login">
      <div className="fa-login-card">
        <div className="fa-login-emoji">{avatarOf(avatar).emoji}</div>
        <h2>Joining room {code}</h2>
        <label className="fa-field">
          <span>Your name</span>
          <input value={name} placeholder="Type your name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()} autoFocus />
        </label>
        <div className="fa-field-label">Pick your animal</div>
        <div className="fa-avatars">
          {AVATARS.map((a) => (
            <button key={a.id} className={`fa-avatar ${avatar === a.id ? "on" : ""}`} onClick={() => setAvatar(a.id)} title={a.name}><span>{a.emoji}</span></button>
          ))}
        </div>
        <button className="fa-btn fa-btn-primary fa-btn-block" onClick={join} disabled={!name.trim() || busy}>
          {busy ? "Joining…" : `Join as ${avatarOf(avatar).name}`}
        </button>
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

    .fa-root{
      --ink:#181735; --ink2:#2A2954; --canvas:#EDEFF9; --surface:#FFFFFF;
      --brand:#5B4FE9; --brand-2:#8B7CF6; --brand-soft:#ECEAFE;
      --amber:#FF9F1C; --amber-soft:#FFF3E0;
      --correct:#12B76A; --correct-soft:#E7F8F0; --wrong:#F04438; --wrong-soft:#FEECEB;
      --muted:#6E6E93; --line:#E4E6F2;
      font-family:'Inter',system-ui,sans-serif; color:var(--ink);
      background:
        radial-gradient(900px 500px at 100% -10%, rgba(91,79,233,.10), transparent 60%),
        radial-gradient(800px 500px at -10% 110%, rgba(255,159,28,.10), transparent 55%),
        var(--canvas);
      min-height:100vh; -webkit-font-smoothing:antialiased;
    }
    .fa-root *{box-sizing:border-box}
    .fa-root h1,.fa-root h2,.fa-root h3{font-family:'Bricolage Grotesque',sans-serif; margin:0; letter-spacing:-.02em}
    .fa-root button{font-family:inherit; cursor:pointer}
    .fa-root input,.fa-root textarea{font-family:inherit}
    .fa-root :focus-visible{outline:2px solid var(--brand); outline-offset:2px; border-radius:8px}

    /* Header */
    .fa-header{position:sticky; top:0; z-index:30; display:flex; align-items:center; justify-content:space-between;
      gap:16px; padding:14px 22px; background:rgba(255,255,255,.78); backdrop-filter:blur(12px);
      border-bottom:1px solid var(--line)}
    .fa-brand{display:flex; align-items:center; gap:11px}
    .fa-logo{width:38px; height:38px; border-radius:11px; display:grid; place-items:center; color:#fff;
      background:linear-gradient(135deg,var(--brand),var(--brand-2)); box-shadow:0 6px 16px rgba(91,79,233,.35)}
    .fa-brand-name{font-family:'Bricolage Grotesque'; font-weight:800; font-size:18px; line-height:1}
    .fa-brand-sub{font-size:11.5px; color:var(--muted); font-weight:500}
    .fa-seg{display:flex; gap:2px; background:var(--brand-soft); padding:4px; border-radius:12px}
    .fa-seg-btn{display:flex; align-items:center; gap:6px; border:0; background:transparent; color:var(--ink2);
      font-size:13.5px; font-weight:600; padding:8px 14px; border-radius:9px; transition:.15s}
    .fa-seg-btn.on{background:#fff; color:var(--brand); box-shadow:0 2px 8px rgba(24,23,53,.12)}

    .fa-main{max-width:1180px; margin:0 auto; padding:26px 22px 60px}

    /* Buttons */
    .fa-btn{display:inline-flex; align-items:center; gap:7px; border:1px solid transparent; border-radius:11px;
      font-size:14px; font-weight:600; padding:10px 16px; transition:.15s; white-space:nowrap}
    .fa-btn:disabled{opacity:.45; cursor:not-allowed}
    .fa-btn-sm{padding:7px 12px; font-size:13px; border-radius:9px}
    .fa-btn-block{width:100%; justify-content:center; padding:13px}
    .fa-btn-primary{background:var(--brand); color:#fff; box-shadow:0 4px 14px rgba(91,79,233,.32)}
    .fa-btn-primary:hover:not(:disabled){background:#4c40d6; transform:translateY(-1px)}
    .fa-btn-danger{background:var(--wrong); color:#fff}
    .fa-btn-ghost{background:#fff; border-color:var(--line); color:var(--ink)}
    .fa-btn-ghost:hover:not(:disabled){border-color:var(--brand); color:var(--brand)}
    .fa-btn-soft{background:var(--brand-soft); color:var(--brand)}
    .fa-btn-soft:hover:not(:disabled){background:#e0dcfd}
    .fa-btn-link{background:transparent; color:var(--brand); padding-left:8px; padding-right:8px}
    .fa-btn-link:hover{text-decoration:underline}

    /* Home */
    .fa-home{display:grid; gap:26px}
    .fa-home-hero{background:var(--ink); color:#fff; border-radius:24px; padding:44px 40px; position:relative; overflow:hidden}
    .fa-home-hero::after{content:''; position:absolute; right:-80px; top:-80px; width:320px; height:320px; border-radius:50%;
      background:radial-gradient(circle,rgba(139,124,246,.55),transparent 70%)}
    .fa-eyebrow{font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--amber); margin-bottom:14px}
    .fa-home-hero h1{font-size:clamp(34px,5vw,54px); line-height:1.02; font-weight:800}
    .fa-home-hero h1 span{color:var(--brand-2)}
    .fa-home-hero p{max-width:560px; margin:18px 0 26px; color:#c9c8e6; font-size:15.5px; line-height:1.6}
    .fa-home-cta{display:flex; gap:12px; flex-wrap:wrap}
    .fa-home-stats{display:flex; gap:34px; margin-top:34px; flex-wrap:wrap}
    .fa-home-stats>div{display:flex; flex-direction:column}
    .fa-home-stats b{font-family:'Bricolage Grotesque'; font-size:30px; line-height:1}
    .fa-home-stats span{font-size:12.5px; color:#a9a8ce; margin-top:4px}
    .fa-home-types{display:grid; grid-template-columns:repeat(4,1fr); gap:12px}
    .fa-type-card{background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; transition:.15s}
    .fa-type-card:hover{border-color:var(--brand); transform:translateY(-2px); box-shadow:0 10px 24px rgba(24,23,53,.08)}
    .fa-type-ic{width:38px; height:38px; border-radius:10px; background:var(--brand-soft); color:var(--brand); display:grid; place-items:center; margin-bottom:12px}
    .fa-type-name{font-weight:700; font-size:14.5px}
    .fa-type-tag{font-size:11.5px; color:var(--muted); margin-top:3px}

    /* Tabs */
    .fa-tabs{display:inline-flex; gap:3px; background:#fff; border:1px solid var(--line); border-radius:13px; padding:4px; margin-bottom:22px}
    .fa-tab{display:flex; align-items:center; gap:7px; border:0; background:transparent; color:var(--ink2); font-weight:600; font-size:14px; padding:9px 18px; border-radius:9px; transition:.15s}
    .fa-tab.on{background:var(--brand); color:#fff}

    /* Build */
    .fa-build{display:grid; grid-template-columns:340px 1fr; gap:20px; align-items:start}
    .fa-build-list{background:#fff; border:1px solid var(--line); border-radius:18px; padding:16px; position:sticky; top:88px}
    .fa-panel-head{display:flex; align-items:center; justify-content:space-between; font-weight:700; font-size:15px; margin-bottom:12px}
    .fa-count{background:var(--brand-soft); color:var(--brand); font-size:12px; font-weight:700; padding:2px 9px; border-radius:20px}
    .fa-bulk{display:flex; align-items:center; gap:6px; padding-bottom:12px; margin-bottom:12px; border-bottom:1px solid var(--line)}
    .fa-qitems{display:flex; flex-direction:column; gap:6px; max-height:340px; overflow-y:auto; margin-bottom:14px}
    .fa-empty{color:var(--muted); font-size:13.5px; padding:16px 4px; text-align:center}
    .fa-qitem{display:flex; align-items:center; gap:9px; width:100%; text-align:left; border:1px solid var(--line); background:#fff; border-radius:11px; padding:9px 10px; transition:.13s}
    .fa-qitem:hover{border-color:var(--brand-2)}
    .fa-qitem.on{border-color:var(--brand); background:var(--brand-soft)}
    .fa-qnum{width:22px; height:22px; flex:0 0 auto; border-radius:7px; background:var(--ink); color:#fff; font-size:11.5px; font-weight:700; display:grid; place-items:center}
    .fa-qic{color:var(--brand); flex:0 0 auto; display:grid; place-items:center}
    .fa-qtext{flex:1; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--ink2)}
    .fa-qtext em{color:var(--muted)}
    .fa-qdel{color:var(--muted); display:grid; place-items:center; padding:3px; border-radius:6px}
    .fa-qdel:hover{color:var(--wrong); background:var(--wrong-soft)}
    .fa-addwrap{border-top:1px solid var(--line); padding-top:14px}
    .fa-addlabel{font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px}
    .fa-addgrid{display:grid; grid-template-columns:1fr 1fr; gap:6px}
    .fa-addbtn{display:flex; align-items:center; gap:7px; border:1px solid var(--line); background:#fff; border-radius:10px; padding:9px 10px; font-size:12.5px; font-weight:600; color:var(--ink2); transition:.13s}
    .fa-addbtn:hover{border-color:var(--brand); color:var(--brand); background:var(--brand-soft)}
    .fa-addbtn span{white-space:nowrap; overflow:hidden; text-overflow:ellipsis}

    /* Editor */
    .fa-editor{background:#fff; border:1px solid var(--line); border-radius:18px; min-height:420px}
    .fa-editor-empty{height:420px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:var(--muted); text-align:center; padding:20px}
    .fa-qeditor{padding:24px}
    .fa-qeditor-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:18px}
    .fa-badge{display:inline-flex; align-items:center; gap:7px; background:var(--brand-soft); color:var(--brand); font-weight:700; font-size:13px; padding:6px 12px; border-radius:9px}
    .fa-badge b{color:var(--ink)}
    .fa-points{display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--muted)}
    .fa-points input{width:64px; padding:7px 9px; border:1px solid var(--line); border-radius:8px; font-size:14px}
    .fa-field{display:block; margin-bottom:18px}
    .fa-field>span{display:block; font-size:13px; font-weight:600; margin-bottom:7px; color:var(--ink2)}
    .fa-field>span em{color:var(--muted); font-weight:500; font-style:normal}
    .fa-field-inline{display:flex; align-items:center; gap:12px}
    .fa-field-inline>span{margin-bottom:0}
    .fa-field-inline input{width:80px}
    .fa-field input,.fa-field textarea,.fa-field-inline input{width:100%; border:1px solid var(--line); border-radius:10px; padding:11px 13px; font-size:14.5px; resize:vertical; background:#fff; transition:.13s}
    .fa-field input:focus,.fa-field textarea:focus{border-color:var(--brand)}
    .fa-field-label{font-size:13px; font-weight:600; color:var(--ink2); margin-bottom:10px}
    .fa-field-label em{color:var(--muted); font-weight:500; font-style:normal}
    .fa-hint{font-size:12.5px; color:var(--muted); margin-top:8px; line-height:1.5}
    .fa-callout{background:var(--amber-soft); color:#8a5a00; padding:12px 14px; border-radius:10px; margin-top:4px}

    .fa-options{margin-top:4px}
    .fa-optrow{display:flex; align-items:center; gap:10px; margin-bottom:8px}
    .fa-mark{width:26px; height:26px; flex:0 0 auto; border:2px solid var(--line); background:#fff; display:grid; place-items:center; color:#fff; transition:.13s}
    .fa-mark.radio{border-radius:50%}
    .fa-mark.check{border-radius:7px}
    .fa-mark.on{background:var(--correct); border-color:var(--correct)}
    .fa-optrow input{flex:1; border:1px solid var(--line); border-radius:9px; padding:9px 12px; font-size:14px}
    .fa-icbtn{width:30px; height:30px; border:1px solid var(--line); background:#fff; border-radius:8px; display:grid; place-items:center; color:var(--muted)}
    .fa-icbtn:hover{color:var(--wrong); border-color:var(--wrong)}

    .fa-tf{display:flex; gap:12px; flex-wrap:wrap; align-items:center}
    .fa-tfbtn{display:inline-flex; align-items:center; gap:8px; border:2px solid var(--line); background:#fff; border-radius:12px; padding:14px 28px; font-size:16px; font-weight:700; color:var(--ink2); transition:.13s}
    .fa-tfbtn.on{border-color:var(--correct); background:var(--correct-soft); color:var(--correct)}
    .fa-tf .fa-hint{width:100%}

    /* Hotspot editor */
    .fa-hotspot-edit{margin-top:4px}
    .fa-hotspot-bar{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px}
    .fa-hotspot-canvas{position:relative; border:1px solid var(--line); border-radius:14px; overflow:hidden; max-width:520px; user-select:none; cursor:crosshair}
    .fa-hotspot-canvas.view,.fa-hotspot-canvas.answer{cursor:crosshair}
    .fa-hotspot-canvas img{display:block; width:100%; height:auto}
    .fa-hs-region{position:absolute; border:2px solid var(--brand); background:rgba(91,79,233,.16); border-radius:4px; pointer-events:none}
    .fa-hs-region.draft{border-style:dashed}
    .fa-hs-region.reveal{border-color:var(--correct); background:rgba(18,183,106,.18)}
    .fa-hs-dot{position:absolute; width:14px; height:14px; border-radius:50%; transform:translate(-50%,-50%); border:2px solid #fff; box-shadow:0 1px 5px rgba(0,0,0,.35); pointer-events:none; background:var(--brand)}
    .fa-hs-dot.ok{background:var(--correct)} .fa-hs-dot.no{background:var(--wrong)}
    .fa-hs-dot.me{width:18px; height:18px; background:var(--amber)}

    /* Present */
    .fa-present{max-width:900px; margin:0 auto}
    .fa-present-bar{display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:16px}
    .fa-navdots{display:flex; gap:7px; flex-wrap:wrap}
    .fa-dot{width:11px; height:11px; border-radius:50%; border:0; background:var(--line); transition:.13s}
    .fa-dot.on{background:var(--brand); transform:scale(1.35)}
    .fa-stage{background:#fff; border:1px solid var(--line); border-radius:20px; padding:30px 32px; box-shadow:0 12px 40px rgba(24,23,53,.06)}
    .fa-stage-head{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap}
    .fa-stage-meta{display:flex; align-items:center; gap:14px; font-size:13px; font-weight:600; color:var(--muted)}
    .fa-livedot{width:9px; height:9px; border-radius:50%; background:var(--muted); display:inline-block; margin-right:5px}
    .fa-livedot.on{background:var(--correct); box-shadow:0 0 0 4px rgba(18,183,106,.18); animation:pulse 1.6s infinite}
    @keyframes pulse{50%{box-shadow:0 0 0 7px rgba(18,183,106,.05)}}
    .fa-respcount{display:inline-flex; align-items:center; gap:5px}
    .fa-stage-q{font-size:26px; line-height:1.2; margin-bottom:18px}
    .fa-reveal{display:inline-flex; align-items:center; gap:9px; background:var(--amber-soft); color:#8a5a00; padding:9px 15px; border-radius:11px; font-size:14px; font-weight:600; margin-bottom:22px; cursor:pointer}
    .fa-reveal input{width:16px; height:16px; accent-color:var(--amber)}
    .fa-await{padding:40px; text-align:center; color:var(--muted); font-size:15px; background:var(--canvas); border-radius:14px}

    .fa-bars{display:flex; flex-direction:column; gap:12px}
    .fa-bar-row{display:grid; grid-template-columns:1fr 2fr auto; gap:14px; align-items:center}
    .fa-bar-label{font-size:14.5px; font-weight:600; display:flex; align-items:center; gap:6px}
    .fa-bar-check{color:var(--correct)}
    .fa-bar-row.correct .fa-bar-label{color:var(--correct)}
    .fa-bar-track{height:34px; background:var(--canvas); border-radius:9px; overflow:hidden}
    .fa-bar-fill{height:100%; background:linear-gradient(90deg,var(--brand-2),var(--brand)); border-radius:9px; transition:width .5s cubic-bezier(.2,.8,.2,1); min-width:3px}
    .fa-bar-row.correct .fa-bar-fill{background:linear-gradient(90deg,#38d68f,var(--correct))}
    .fa-bar-count{font-weight:700; font-size:15px; min-width:24px; text-align:right}

    .fa-wordcloud{display:flex; flex-wrap:wrap; gap:6px 20px; align-items:center; justify-content:center; padding:36px 20px; min-height:180px}
    .fa-word{font-family:'Bricolage Grotesque'; font-weight:700; line-height:1; animation:pop .4s cubic-bezier(.2,1.4,.4,1)}
    @keyframes pop{from{opacity:0; transform:scale(.6)}}

    .fa-hotspot-live{display:flex; justify-content:center}
    .fa-resplist{display:flex; flex-direction:column; gap:9px}
    .fa-respcard{display:flex; align-items:center; gap:12px; background:var(--canvas); border-radius:12px; padding:12px 15px; border-left:4px solid var(--line); animation:pop .3s ease}
    .fa-respcard.ok{border-left-color:var(--correct); background:var(--correct-soft)}
    .fa-respcard.no{border-left-color:var(--wrong); background:var(--wrong-soft)}
    .fa-respav{font-size:22px}
    .fa-respans{flex:1; font-size:14.5px}
    .fa-respmark.ok{color:var(--correct)} .fa-respmark.no{color:var(--wrong)}
    .fa-answer-key{margin-top:6px; font-size:13.5px; color:var(--ink2); background:var(--amber-soft); padding:10px 14px; border-radius:10px}

    .fa-present-foot{display:flex; align-items:center; justify-content:space-between; margin-top:18px}
    .fa-present-progress{font-weight:700; color:var(--muted); font-size:14px}
    .fa-empty-big{padding:60px 20px; text-align:center; color:var(--muted); font-size:15px; background:#fff; border:1px dashed var(--line); border-radius:18px}

    /* Report */
    .fa-report-head{display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:20px; flex-wrap:wrap}
    .fa-report-head h2{font-size:24px}
    .fa-report-head p{color:var(--muted); font-size:14px; margin-top:5px; max-width:440px}
    .fa-report-stats{display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:22px}
    .fa-stat{background:#fff; border:1px solid var(--line); border-radius:14px; padding:16px 18px}
    .fa-stat b{font-family:'Bricolage Grotesque'; font-size:28px; display:block; line-height:1}
    .fa-stat span{font-size:12.5px; color:var(--muted); margin-top:5px; display:block}
    .fa-stat.accent{background:var(--ink); color:#fff}
    .fa-stat.accent span{color:#b7b6dc}
    .fa-report-table{background:#fff; border:1px solid var(--line); border-radius:16px; overflow:hidden; margin-bottom:24px}
    .fa-tr{display:grid; grid-template-columns:2fr 1fr 1fr 2fr; gap:12px; align-items:center; padding:13px 18px; border-bottom:1px solid var(--line); font-size:14px}
    .fa-tr:last-child{border-bottom:0}
    .fa-th{background:var(--canvas); font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted)}
    .fa-td-name{display:flex; align-items:center; gap:9px; font-weight:600}
    .fa-td-name span{font-size:20px}
    .fa-mini-track{height:9px; background:var(--canvas); border-radius:6px; overflow:hidden}
    .fa-mini-fill{height:100%; background:linear-gradient(90deg,var(--brand-2),var(--brand)); border-radius:6px}
    .fa-item-analysis{background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px 20px}
    .fa-item-analysis h3{font-size:16px; margin-bottom:14px}
    .fa-ia-row{display:grid; grid-template-columns:auto 1fr auto auto; gap:14px; align-items:center; padding:10px 0; border-top:1px solid var(--line); font-size:13.5px}
    .fa-ia-q{color:var(--ink2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
    .fa-ia-q em{color:var(--muted)}
    .fa-ia-type{color:var(--muted); font-size:12.5px}
    .fa-ia-pct{font-weight:700; color:var(--brand); min-width:44px; text-align:right}

    /* Student login */
    .fa-login{display:flex; justify-content:center; padding-top:14px}
    .fa-login-card{background:#fff; border:1px solid var(--line); border-radius:22px; padding:34px; width:100%; max-width:460px; text-align:center; box-shadow:0 16px 50px rgba(24,23,53,.08)}
    .fa-login-emoji{font-size:64px; line-height:1; margin-bottom:8px; animation:bob 3s ease-in-out infinite}
    @keyframes bob{50%{transform:translateY(-8px)}}
    .fa-login-card h2{font-size:26px; margin-bottom:20px}
    .fa-login-card .fa-field{text-align:left}
    .fa-avatars{display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:20px}
    .fa-avatar{aspect-ratio:1; border:2px solid var(--line); background:#fff; border-radius:13px; font-size:26px; display:grid; place-items:center; transition:.13s}
    .fa-avatar:hover{border-color:var(--brand-2); transform:translateY(-2px)}
    .fa-avatar.on{border-color:var(--brand); background:var(--brand-soft); transform:scale(1.05)}
    .fa-rejoin{margin-top:20px; padding-top:18px; border-top:1px solid var(--line); text-align:left}
    .fa-rejoin>span{font-size:12.5px; color:var(--muted); font-weight:600}
    .fa-rejoin-list{display:flex; flex-wrap:wrap; gap:7px; margin-top:9px}
    .fa-chip{border:1px solid var(--line); background:#fff; border-radius:20px; padding:6px 12px; font-size:13px; font-weight:500}
    .fa-chip:hover{border-color:var(--brand); color:var(--brand)}

    /* Student answering */
    .fa-student{max-width:640px; margin:0 auto}
    .fa-student-bar{display:flex; align-items:center; justify-content:space-between; margin-bottom:16px}
    .fa-me{display:flex; align-items:center; gap:9px; font-size:15px}
    .fa-me-av{font-size:26px}
    .fa-wait{background:#fff; border:1px solid var(--line); border-radius:20px; padding:50px 30px; text-align:center}
    .fa-wait-emoji{font-size:70px; animation:bob 3s ease-in-out infinite}
    .fa-wait h2{font-size:24px; margin:14px 0 8px}
    .fa-wait p{color:var(--muted); font-size:15px}
    .fa-answer{background:#fff; border:1px solid var(--line); border-radius:20px; padding:28px; box-shadow:0 12px 40px rgba(24,23,53,.06)}
    .fa-answer-num{font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--brand); margin-bottom:10px}
    .fa-answer-q{font-size:23px; line-height:1.3; margin-bottom:22px}
    .fa-choices{display:flex; flex-direction:column; gap:10px; margin-bottom:22px}
    .fa-choices.tf{flex-direction:row}
    .fa-choices.tf .fa-choice{flex:1; justify-content:center; font-size:17px; padding:18px}
    .fa-choice{display:flex; align-items:center; gap:12px; border:2px solid var(--line); background:#fff; border-radius:13px; padding:15px 17px; font-size:15.5px; font-weight:500; text-align:left; transition:.13s; color:var(--ink)}
    .fa-choice:hover:not(:disabled){border-color:var(--brand-2)}
    .fa-choice:disabled{cursor:default}
    .fa-choice-mark{width:24px; height:24px; flex:0 0 auto; border:2px solid var(--line); border-radius:50%; display:grid; place-items:center; color:#fff; transition:.13s}
    .fa-choice-mark.check{border-radius:7px}
    .fa-choice.chosen{border-color:var(--brand); background:var(--brand-soft)}
    .fa-choice.chosen .fa-choice-mark{background:var(--brand); border-color:var(--brand)}
    .fa-choice.correct{border-color:var(--correct); background:var(--correct-soft)}
    .fa-choice.correct .fa-choice-mark{background:var(--correct); border-color:var(--correct)}
    .fa-choice.wrong{border-color:var(--wrong); background:var(--wrong-soft)}
    .fa-choice.wrong .fa-choice-mark{background:var(--wrong); border-color:var(--wrong)}
    .fa-answer-input,.fa-answer-textarea{width:100%; border:2px solid var(--line); border-radius:13px; padding:14px 16px; font-size:15.5px; margin-bottom:20px; transition:.13s}
    .fa-answer-input:focus,.fa-answer-textarea:focus{border-color:var(--brand)}
    .fa-answer-textarea{resize:vertical}
    .fa-blank{display:inline-block; width:120px; border:0; border-bottom:2.5px solid var(--brand); background:var(--brand-soft); border-radius:6px 6px 0 0; padding:2px 8px; font-size:20px; font-family:inherit; text-align:center; margin:0 4px}
    .fa-blank:focus{outline:none; background:#e0dcfd}
    .fa-wordinput{margin-bottom:20px}
    .fa-wordchips{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; min-height:4px}
    .fa-wchip{display:inline-flex; align-items:center; gap:6px; background:var(--brand-soft); color:var(--brand); font-weight:600; padding:7px 12px; border-radius:20px; font-size:14px}
    .fa-wchip button{border:0; background:transparent; color:var(--brand); display:grid; place-items:center; padding:0}
    .fa-wordadd{display:flex; gap:8px}
    .fa-wordadd input{flex:1; border:2px solid var(--line); border-radius:11px; padding:11px 14px; font-size:15px}
    .fa-wordadd input:focus{border-color:var(--brand)}
    .fa-submitted{text-align:center}
    .fa-submitted-badge{display:inline-flex; align-items:center; gap:8px; font-weight:700; font-size:16px; padding:13px 24px; border-radius:13px}
    .fa-submitted-badge.ok{background:var(--correct-soft); color:var(--correct)}
    .fa-submitted-badge.no{background:var(--wrong-soft); color:var(--wrong)}
    .fa-submitted-badge.sent{background:var(--brand-soft); color:var(--brand)}
    .fa-submitted .fa-answer-key{margin-top:14px; text-align:center}

    /* Toast */
    .fa-toast{position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; padding:13px 22px; border-radius:12px; font-size:14px; font-weight:600; box-shadow:0 12px 34px rgba(24,23,53,.35); z-index:60; animation:pop .3s ease}

    /* LaTeX */
    .fa-math-inline{white-space:nowrap}
    .fa-math-block{display:block; margin:8px 0; overflow-x:auto}
    .fa-math-raw{font-family:'Space Mono',monospace; color:var(--muted); font-size:.92em}
    .fa-math-preview{margin-top:10px; background:var(--brand-soft); border-radius:10px; padding:11px 14px; font-size:16px; color:var(--ink); display:flex; align-items:center; gap:10px; flex-wrap:wrap}
    .fa-math-preview>span{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--brand)}
    .fa-hint code{font-family:'Space Mono',monospace; background:var(--canvas); padding:1px 5px; border-radius:5px; font-size:.9em}
    .fa-shortwrap{margin-bottom:20px}
    .fa-shortwrap .fa-answer-input{margin-bottom:0}

    /* Lobby */
    .fa-lobby{max-width:820px; margin:0 auto; text-align:center}
    .fa-lobby-eyebrow{font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--brand); margin-bottom:10px}
    .fa-lobby-title{font-size:30px; margin-bottom:8px}
    .fa-lobby-sub{color:var(--muted); font-size:15px; max-width:520px; margin:0 auto 24px}
    .fa-lobby-stage{background:#fff; border:1px solid var(--line); border-radius:22px; min-height:280px; padding:30px; display:flex; align-items:center; justify-content:center; box-shadow:0 12px 40px rgba(24,23,53,.06)}
    .fa-lobby-empty{color:var(--muted)}
    .fa-lobby-empty-emoji{font-size:56px; display:block; margin-bottom:10px; opacity:.8}
    .fa-dancers{display:flex; flex-wrap:wrap; gap:22px 26px; justify-content:center; align-items:flex-end}
    .fa-dancer{display:flex; flex-direction:column; align-items:center; gap:8px; animation:dance 1s ease-in-out infinite}
    .fa-dancer-av{font-size:52px; line-height:1; filter:drop-shadow(0 6px 8px rgba(24,23,53,.18))}
    .fa-dancer-name{background:var(--brand-soft); color:var(--brand); font-weight:700; font-size:13px; padding:4px 12px; border-radius:20px; max-width:96px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
    @keyframes dance{0%,100%{transform:translateY(0) rotate(-4deg)} 25%{transform:translateY(-14px) rotate(0deg)} 50%{transform:translateY(0) rotate(4deg)} 75%{transform:translateY(-8px) rotate(0deg)}}
    .fa-dance{display:inline-block; animation:dance 1s ease-in-out infinite}
    .fa-lobby-foot{display:flex; align-items:center; justify-content:center; gap:26px; margin-top:26px; flex-wrap:wrap}
    .fa-lobby-count{display:flex; flex-direction:column; align-items:center}
    .fa-lobby-count b{font-family:'Bricolage Grotesque'; font-size:34px; line-height:1; color:var(--ink)}
    .fa-lobby-count span{font-size:12.5px; color:var(--muted); margin-top:3px}
    .fa-lobby-start{font-size:17px; padding:15px 34px; border-radius:14px}
    .fa-lobby-qcount{font-size:12.5px; color:var(--muted)}
    .fa-wait-tag{display:inline-block; margin-top:16px; background:var(--brand-soft); color:var(--brand); font-weight:700; font-size:13px; padding:6px 15px; border-radius:20px}
    .fa-roster-pill{display:inline-flex; align-items:center; gap:6px; background:var(--brand-soft); color:var(--brand); font-weight:700; font-size:13px; padding:7px 13px; border-radius:9px}
    .fa-present-actions{display:flex; align-items:center; gap:10px}

    /* Correctness histogram */
    .fa-histo{background:linear-gradient(180deg,#fff,var(--canvas)); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-bottom:22px}
    .fa-histo-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:12px}
    .fa-histo-head>span:first-child{font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--muted)}
    .fa-histo-pct{font-family:'Bricolage Grotesque'; font-weight:800; font-size:18px; color:var(--correct)}
    .fa-histo-cols{display:flex; align-items:flex-end; justify-content:space-around; gap:22px; height:150px; padding-top:20px}
    .fa-histo-col{flex:1; max-width:120px; display:flex; flex-direction:column; align-items:center; height:100%}
    .fa-histo-bar-wrap{flex:1; width:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; position:relative}
    .fa-histo-val{font-weight:800; font-size:20px; font-family:'Bricolage Grotesque'; margin-bottom:5px}
    .fa-histo-bar{width:70%; min-height:4px; border-radius:9px 9px 0 0; transition:height .55s cubic-bezier(.2,.8,.2,1)}
    .fa-histo-bar.correct{background:linear-gradient(180deg,#38d68f,var(--correct))}
    .fa-histo-bar.wrong{background:linear-gradient(180deg,#ff7a70,var(--wrong))}
    .fa-histo-bar.pending{background:linear-gradient(180deg,#c9cbe0,#a9abc9)}
    .fa-histo-label{margin-top:9px; font-size:13px; font-weight:600; color:var(--ink2)}

    /* Setup notice */
    .fa-setup{max-width:640px; margin:60px auto; padding:0 20px}
    .fa-setup-card{background:#fff; border:1px solid var(--line); border-radius:20px; padding:34px; text-align:center; box-shadow:0 16px 50px rgba(24,23,53,.08)}
    .fa-setup-ic{width:56px; height:56px; margin:0 auto 14px; border-radius:15px; background:var(--amber-soft); color:var(--amber); display:grid; place-items:center}
    .fa-setup-card h2{font-size:22px; margin-bottom:12px}
    .fa-setup-card p{color:var(--ink2); font-size:14.5px; line-height:1.6; margin:0 auto 10px; max-width:460px}
    .fa-setup-small{color:var(--muted); font-size:13px}
    .fa-setup-card code{font-family:'Space Mono',monospace; background:var(--canvas); padding:2px 6px; border-radius:6px; font-size:.9em}

    /* Go live */
    .fa-golive{max-width:520px; margin:40px auto; background:#fff; border:1px solid var(--line); border-radius:22px; padding:40px; text-align:center; box-shadow:0 12px 40px rgba(24,23,53,.06)}
    .fa-golive-ic{width:64px; height:64px; margin:0 auto 16px; border-radius:17px; background:linear-gradient(135deg,var(--brand),var(--brand-2)); color:#fff; display:grid; place-items:center; box-shadow:0 8px 20px rgba(91,79,233,.35)}
    .fa-golive h2{font-size:26px; margin-bottom:10px}
    .fa-golive p{color:var(--muted); font-size:15px; margin-bottom:24px; line-height:1.55}
    .fa-golive-btn{font-size:16px; padding:15px 28px}
    .fa-golive-note{font-size:12.5px; color:var(--muted); margin-top:14px}

    /* Share block */
    .fa-share{display:flex; gap:26px; align-items:center; justify-content:space-between; background:#fff; border:1px solid var(--line); border-radius:18px; padding:20px 22px; margin:0 auto 22px; max-width:720px; box-shadow:0 8px 26px rgba(24,23,53,.06)}
    .fa-share.compact{padding:14px 16px}
    .fa-share-main{flex:1; display:flex; flex-direction:column; gap:14px; text-align:left}
    .fa-share-code{display:flex; flex-direction:column; gap:2px}
    .fa-share-code span{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted)}
    .fa-share-code b{font-family:'Bricolage Grotesque'; font-size:40px; line-height:1; letter-spacing:.14em; color:var(--brand)}
    .fa-share-linkrow{display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:10px; padding:8px 11px; color:var(--muted); background:var(--canvas)}
    .fa-share-linkrow input{flex:1; border:0; background:transparent; font-size:13px; color:var(--ink2); font-family:'Space Mono',monospace}
    .fa-share-linkrow input:focus{outline:none}
    .fa-share-btns{display:flex; gap:8px}
    .fa-share-qr{display:flex; flex-direction:column; align-items:center; gap:7px}
    .fa-qr-box{background:#fff; border:1px solid var(--line); border-radius:14px; padding:10px; line-height:0}
    .fa-share-qr span{font-size:11.5px; color:var(--muted); font-weight:600; display:inline-flex; align-items:center; gap:4px}

    .fa-me-room{color:var(--muted); font-weight:500; font-size:13px}

    /* Join / code entry */
    .fa-join-error{display:flex; align-items:center; gap:7px; background:var(--wrong-soft); color:var(--wrong); font-size:13px; font-weight:600; padding:9px 13px; border-radius:10px; margin-bottom:16px; text-align:left}
    .fa-join-hint{font-size:12.5px; color:var(--muted); margin-top:14px}
    .fa-code-input{text-align:center; font-family:'Bricolage Grotesque',sans-serif !important; font-size:30px !important; font-weight:700; letter-spacing:.3em; text-transform:uppercase}
    .fa-login-emoji svg{color:var(--brand)}

    @media (max-width:720px){
      .fa-share{flex-direction:column-reverse; align-items:stretch}
      .fa-share-main{text-align:center}
      .fa-share-code{align-items:center}
      .fa-share-qr{align-self:center}
    }
    @media (max-width:860px){
      .fa-build{grid-template-columns:1fr}
      .fa-build-list{position:static}
      .fa-home-types{grid-template-columns:repeat(2,1fr)}
      .fa-report-stats{grid-template-columns:repeat(2,1fr)}
      .fa-tr{grid-template-columns:1.5fr 1fr 1fr; font-size:13px}
      .fa-th-bar,.fa-bar-row .fa-bar-label{display:none}
      .fa-bar-row{grid-template-columns:2fr auto}
    }
    @media (prefers-reduced-motion:reduce){
      .fa-root *{animation:none !important; transition:none !important}
    }
    `}</style>
  );
}
