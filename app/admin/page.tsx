"use client";

import { useState } from "react";
import { JUSTICES } from "@/lib/justices";

type Side = "M" | "D" | "A" | "T";
const SIDE_LABEL: Record<Side, string> = {
  M: "Majority / concurrence",
  D: "Dissent",
  A: "No part",
  T: "Tied (equally divided)",
};

const blankVotes = (): Record<string, Side> =>
  Object.fromEntries(JUSTICES.map((j) => [j.id, "A" as Side]));

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [term, setTerm] = useState("");
  const [docket, setDocket] = useState("");
  const [name, setName] = useState("");
  const [decided, setDecided] = useState("");
  const [winningParty, setWinningParty] = useState("");
  const [question, setQuestion] = useState("");
  const [holding, setHolding] = useState("");
  const [votes, setVotes] = useState<Record<string, Side>>(blankVotes());
  const [majorityAuthor, setMajorityAuthor] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${secret}` });

  async function loadExisting() {
    setMsg(null);
    if (!term || !docket) return setMsg({ ok: false, text: "Enter term and docket to load." });
    setBusy(true);
    try {
      const r = await fetch(`/api/admin?term=${encodeURIComponent(term)}&docket=${encodeURIComponent(docket)}`, {
        headers: headers(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "failed");
      if (!data.case) return setMsg({ ok: false, text: "No existing case for that term + docket." });
      const c = data.case;
      setName(c.name ?? "");
      setDecided(c.decided ?? "");
      setWinningParty(c.winningParty ?? "");
      setQuestion(c.question ?? "");
      setHolding(c.holding ?? "");
      setVotes({ ...blankVotes(), ...c.votes });
      setMajorityAuthor(c.opinions?.find((o: { type: string }) => o.type === "majority")?.author ?? "");
      setMsg({ ok: true, text: `Loaded “${c.name}” (source: ${c.source ?? "oyez"}).` });
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ term, docket, name, decided, winningParty, question, holding, votes, majorityAuthor }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "failed");
      setMsg({ ok: true, text: `Saved ${data.case.name} (${data.case.lineupKey}, ${data.case.majority}–${data.case.minority}).` });
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setMsg(null);
    if (!term || !docket) return setMsg({ ok: false, text: "Enter term and docket." });
    setBusy(true);
    try {
      const r = await fetch(`/api/admin?term=${encodeURIComponent(term)}&docket=${encodeURIComponent(docket)}`, {
        method: "DELETE",
        headers: headers(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "failed");
      setMsg({ ok: true, text: data.ok ? "Manual override removed (reverted to source data)." : "No manual override to remove." });
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  const majorityJustices = JUSTICES.filter((j) => votes[j.id] === "M");
  const input = "w-full rounded border border-ink-line bg-ink-raised/60 px-2 py-1.5 text-[13px] text-cream focus:border-gold/60 focus:outline-none";
  const label = "smallcaps mb-1 block text-[10px] text-gold/80";

  return (
    <main className="relative z-10 mx-auto w-full max-w-2xl px-5 pb-16 pt-12">
      <header className="mb-8 text-center">
        <p className="smallcaps text-[13px] text-gold">editor</p>
        <h1 className="font-display mt-1 text-4xl font-medium text-cream">
          SCOTUS<span className="italic text-gold-bright">admin</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-cream-dim">
          Add a new case or correct an existing one. Edits are stored as manual overrides that take precedence over
          Oyez/SCDB and survive the daily refresh. Load an existing case first to modify it.
        </p>
        <a href="/" className="mt-4 inline-block rounded border border-gold/60 px-4 py-1.5 font-mono text-[12px] text-gold hover:bg-gold/10">
          ← the full board
        </a>
      </header>

      <div className="space-y-4">
        <div>
          <label className={label}>admin secret</label>
          <input type="password" className={input} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ADMIN_SECRET" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>term (4-digit, e.g. 2024)</label>
            <input className={input} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="2024" />
          </div>
          <div>
            <label className={label}>docket</label>
            <input className={input} value={docket} onChange={(e) => setDocket(e.target.value)} placeholder="23-1234" />
          </div>
        </div>
        <button onClick={loadExisting} disabled={busy} className="rounded border border-gold/50 px-3 py-1 font-mono text-[12px] text-gold hover:bg-gold/10 disabled:opacity-50">
          load existing →
        </button>

        <div>
          <label className={label}>case name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Smith v. Jones" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>decided (YYYY-MM-DD)</label>
            <input className={input} value={decided} onChange={(e) => setDecided(e.target.value)} placeholder="2025-06-01" />
          </div>
          <div>
            <label className={label}>winning party (optional)</label>
            <input className={input} value={winningParty} onChange={(e) => setWinningParty(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={label}>votes</label>
          <div className="space-y-1.5">
            {JUSTICES.map((j) => (
              <div key={j.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] text-cream-dim">{j.lastName}</span>
                <select
                  className={input}
                  value={votes[j.id]}
                  onChange={(e) => setVotes((v) => ({ ...v, [j.id]: e.target.value as Side }))}
                >
                  {(["M", "D", "A", "T"] as Side[]).map((s) => (
                    <option key={s} value={s}>{s} — {SIDE_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>majority opinion author (optional)</label>
          <select className={input} value={majorityAuthor} onChange={(e) => setMajorityAuthor(e.target.value)}>
            <option value="">— none —</option>
            {majorityJustices.map((j) => (
              <option key={j.id} value={j.id}>{j.lastName}</option>
            ))}
          </select>
        </div>

        <details>
          <summary className="cursor-pointer font-mono text-[11px] text-cream-faint">optional: question / holding text</summary>
          <div className="mt-2 space-y-3">
            <textarea className={`${input} h-20`} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question presented" />
            <textarea className={`${input} h-20`} value={holding} onChange={(e) => setHolding(e.target.value)} placeholder="Holding" />
          </div>
        </details>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={busy} className="rounded border border-gold bg-gold/15 px-4 py-1.5 font-mono text-[13px] text-gold-bright hover:bg-gold/25 disabled:opacity-50">
            save case
          </button>
          <button onClick={remove} disabled={busy} className="rounded border border-slate-dissent/50 px-3 py-1.5 font-mono text-[12px] text-slate-dissent hover:bg-slate-dissent/10 disabled:opacity-50">
            remove override
          </button>
        </div>

        {msg && (
          <p className={`font-mono text-[12px] ${msg.ok ? "text-gold-bright" : "text-slate-dissent"}`}>{msg.text}</p>
        )}
      </div>
    </main>
  );
}
