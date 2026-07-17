import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Schedule.css";
import { FACILITY } from "../config/facility.js";
import { upcomingDays, slotsForDay, longDate, isPast } from "../lib/dates.js";
import { useStore, useSession } from "../store/hooks.js";
import {
  confirmedAt, pendingAt, createBooking, ownerCreateBooking, getPitches,
  confirmBooking, cancelBooking, declineBooking,
} from "../store/store.js";
import { Button, Card, Modal, StatusBadge, Field, useToast } from "../components/ui.jsx";
import PitchPhoto from "../components/PitchPhoto.jsx";

export default function Schedule() {
  const days = useMemo(() => upcomingDays(14), []);
  const slots = useMemo(() => slotsForDay(), []);
  useStore(); // re-render when bookings / pitches change
  const pitches = getPitches();
  const [dayKey, setDayKey] = useState(days[0].key);
  const [pitchId, setPitchId] = useState(pitches[0]?.id);
  const [confirm, setConfirm] = useState(null); // free slot → new request/booking
  const [requested, setRequested] = useState(null); // player: "wait for confirmation" screen
  const [manage, setManage] = useState(null); // owner managing a taken/contested slot
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const session = useSession();
  const toast = useToast();
  const nav = useNavigate();

  const isOwner = session?.role === "owner";
  const pitch = pitches.find((p) => p.id === pitchId) || pitches[0];

  function onSlot(slot) {
    if (!pitch || pitch.status === "maintenance") return;
    if (isPast(dayKey, slot.start)) return;
    const confirmed = confirmedAt(dayKey, pitch.id, slot.start);
    const pending = pendingAt(dayKey, pitch.id, slot.start);
    if (isOwner) {
      // Owner: manage a slot that has a confirmed booking OR pending requests;
      // otherwise book a walk-in on the free slot.
      if (confirmed || pending.length > 0) setManage(slot);
      else { setClientName(""); setClientPhone(""); setConfirm(slot); }
      return;
    }
    // Player:
    if (confirmed) return; // locked
    if (pending.some((b) => session && b.phone === session.phone)) return; // already requested
    if (!session) { nav("/connexion", { state: { redirect: "/" } }); return; }
    setConfirm(slot);
  }

  async function doBook() {
    const slot = confirm;
    setConfirm(null);
    const args = { dayKey, pitchId: pitch.id, slotStart: slot.start, slotEnd: slot.end };
    const res = isOwner
      ? await ownerCreateBooking({ ...args, name: clientName, phone: clientPhone })
      : await createBooking(args);
    if (res.ok) {
      if (isOwner) toast("Réservation confirmée pour le client.");
      else setRequested(slot); // show the "wait for confirmation" screen
    } else if (res.error === "auth") {
      nav("/connexion");
    } else {
      toast(res.error, { err: true });
    }
  }

  if (!pitch) {
    return <Card><p className="muted" style={{ margin: 0 }}>Aucun terrain disponible. Le gérant doit en ajouter.</p></Card>;
  }

  const inMaintenance = pitch.status === "maintenance";
  // Live data for the manage modal.
  const mConfirmed = manage ? confirmedAt(dayKey, pitch.id, manage.start) : null;
  const mPending = manage ? pendingAt(dayKey, pitch.id, manage.start) : [];

  return (
    <div>
      <div className="hero">
        <div className="center-circle" />
        <h1>{isOwner ? "Planning des terrains" : "Réserve ton terrain"}</h1>
        <p>
          {isOwner
            ? "Clique un créneau : réserve pour un client (appel), ou choisis parmi les demandes."
            : `Matchs de 1h30 · ${pitches.map((p) => p.players).join(" · ")}. Choisis un stade et un créneau libre.`}
        </p>
      </div>

      {/* Day strip */}
      <div className="daystrip hide-scroll">
        {days.map((d) => (
          <button key={d.key} className={`daychip ${d.key === dayKey ? "on" : ""}`} onClick={() => setDayKey(d.key)}>
            <div className="wd">{d.isToday ? "Auj." : d.isTomorrow ? "Dem." : d.weekday}</div>
            <div className="dn">{d.dayNum}</div>
          </button>
        ))}
      </div>

      {/* Stadium selector */}
      <div className="muted" style={{ fontSize: 13, margin: "18px 0 10px" }}>Choisis ton stade</div>
      <div className="pitch-cards">
        {pitches.map((p) => (
          <button key={p.id} className={`pitch-card ${p.id === pitch.id ? "on" : ""}`} onClick={() => setPitchId(p.id)}>
            <div className="ph">
              <PitchPhoto pitch={p} height={92} radius={12} rounded="top" />
              <span className="fmt-badge">{p.players}</span>
              {p.status === "maintenance"
                ? <span className="cov-badge" style={{ background: "rgba(245,158,11,.85)", color: "#1a1206" }}>Maintenance</span>
                : p.covered && <span className="cov-badge">Couvert</span>}
            </div>
            <div className="meta">
              <span className="nm">{p.name}</span>
              <span className="pr">{p.price} {FACILITY.currency}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="spread" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>{longDate(dayKey)}</strong>
        <span className="muted" style={{ fontSize: 13 }}>{pitch.name}</span>
      </div>

      {inMaintenance ? (
        <Card>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛠️</span>
            <div>
              <strong style={{ fontSize: 14 }}>Terrain en maintenance</strong>
              <div className="muted" style={{ fontSize: 13 }}>Ce stade n'est pas réservable pour le moment.</div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="slots">
          {slots.map((slot) => {
            const confirmed = confirmedAt(dayKey, pitch.id, slot.start);
            const pending = pendingAt(dayKey, pitch.id, slot.start);
            const myConfirmed = confirmed && session && confirmed.phone === session.phone;
            const myPending = session && pending.some((b) => b.phone === session.phone);
            const past = isPast(dayKey, slot.start);

            // clickable: owner → any non-past slot; player → free or others-pending (to request)
            const disabled = past
              || (!isOwner && !!confirmed)
              || (!isOwner && myPending);

            return (
              <button
                key={slot.start}
                className={`slot ${confirmed ? "taken" : ""} ${myConfirmed || myPending ? "mine" : ""} ${past && !confirmed ? "past" : ""}`}
                onClick={() => onSlot(slot)}
                disabled={disabled}
              >
                <span>
                  <span className="time">{slot.start}</span>
                  <span className="sub">→ {slot.end}</span>
                </span>
                {renderSlotBadge({ isOwner, confirmed, pending, myConfirmed, myPending, past })}
              </button>
            );
          })}
        </div>
      )}

      {/* Free-slot booking / request modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)}>
        {confirm && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, letterSpacing: "-0.02em" }}>
              {isOwner ? "Réserver pour un client" : "Demander ce créneau"}
            </h2>
            <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
              {isOwner
                ? "Réservation confirmée immédiatement au nom du client."
                : "Ta demande part au gérant. D'autres joueurs peuvent aussi la demander — le gérant choisit."}
            </p>
            <div style={{ marginBottom: 14 }}><PitchPhoto pitch={pitch} height={120} /></div>
            <Card pad className="col" style={{ gap: 10, marginBottom: 18 }}>
              <Row k="Stade" v={`${pitch.name} · ${pitch.players}`} />
              <hr className="pitch-line" />
              <Row k="Date" v={longDate(dayKey)} />
              <hr className="pitch-line" />
              <Row k="Heure" v={`${confirm.start} → ${confirm.end}`} />
              <hr className="pitch-line" />
              <Row k="Prix" v={`${pitch.price} ${FACILITY.currency}`} />
            </Card>
            {isOwner && (
              <div className="col" style={{ gap: 12, marginBottom: 16 }}>
                <Field label="Nom du client (au téléphone)">
                  <input className="input" autoFocus value={clientName} onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex : Groupe de Karim" />
                </Field>
                <Field label="Téléphone du client (pour le SMS, optionnel)">
                  <input className="input mono" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+216 …" />
                </Field>
              </div>
            )}
            <div className="row" style={{ gap: 10 }}>
              <Button variant="ghost" block onClick={() => setConfirm(null)}>Annuler</Button>
              <Button block onClick={doBook} disabled={isOwner && !clientName.trim()}>
                {isOwner ? "Réserver" : "Envoyer la demande"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Owner: manage a taken / contested slot */}
      <Modal open={!!manage} onClose={() => setManage(null)}>
        {manage && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, letterSpacing: "-0.02em" }}>
              {mConfirmed ? "Gérer le créneau" : `Choisir une demande${mPending.length > 1 ? ` (${mPending.length})` : ""}`}
            </h2>
            <p className="muted" style={{ margin: "0 0 16px", fontSize: 14 }}>
              {pitch.name} · {longDate(dayKey)} · {manage.start}→{manage.end}
            </p>

            {mConfirmed ? (
              <>
                <Card pad className="col" style={{ gap: 10, marginBottom: 16 }}>
                  <Row k="Client" v={mConfirmed.name} />
                  <hr className="pitch-line" />
                  <Row k="Téléphone" v={mConfirmed.phone} />
                  <div className="spread">
                    <span className="muted" style={{ fontSize: 13 }}>Statut</span>
                    <StatusBadge status="confirmed" />
                  </div>
                </Card>
                <div className="col" style={{ gap: 10 }}>
                  <Button variant="danger" block onClick={() => { cancelBooking(mConfirmed.id); setManage(null); toast("Créneau libéré."); }}>
                    Libérer le créneau
                  </Button>
                  <Button variant="ghost" block onClick={() => setManage(null)}>Fermer</Button>
                </div>
              </>
            ) : mPending.length === 0 ? (
              <>
                <p className="muted" style={{ fontSize: 14 }}>Plus aucune demande sur ce créneau.</p>
                <Button variant="ghost" block onClick={() => setManage(null)}>Fermer</Button>
              </>
            ) : (
              <>
                {mPending.length > 1 && (
                  <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
                    Plusieurs joueurs veulent ce créneau. Confirmes-en un — les autres seront refusés.
                  </p>
                )}
                <div className="col" style={{ gap: 10, marginBottom: 14 }}>
                  {mPending.map((b) => (
                    <Card key={b.id} pad className="spread">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name}</div>
                        <div className="muted mono" style={{ fontSize: 12 }}>{b.phone}</div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <Button size="sm" variant="danger" onClick={() => { declineBooking(b.id); toast("Demande refusée."); }}>Refuser</Button>
                        <Button size="sm" onClick={() => { confirmBooking(b.id); setManage(null); toast("Réservation confirmée."); }}>Confirmer</Button>
                      </div>
                    </Card>
                  ))}
                </div>
                <Button variant="ghost" block onClick={() => setManage(null)}>Fermer</Button>
              </>
            )}
          </>
        )}
      </Modal>

      {/* Player: request sent — wait for the manager to confirm */}
      <Modal open={!!requested} onClose={() => setRequested(null)}>
        {requested && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 66, height: 66, margin: "0 auto 14px", borderRadius: "50%", display: "grid", placeItems: "center",
              background: "var(--pitch-ghost)", color: "var(--pitch)", fontSize: 32,
            }}>⏳</div>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, letterSpacing: "-0.02em" }}>Demande envoyée !</h2>
            <p className="muted" style={{ margin: "0 0 4px", fontSize: 14.5, lineHeight: 1.55 }}>
              Ta demande pour <strong style={{ color: "var(--ink)" }}>{pitch.name}</strong> le{" "}
              <strong style={{ color: "var(--ink)" }}>{longDate(dayKey)} à {requested.start}</strong> a bien été reçue.
            </p>
            <p className="muted" style={{ margin: "0 0 18px", fontSize: 14.5, lineHeight: 1.55 }}>
              Le gérant doit la <strong style={{ color: "var(--ink)" }}>confirmer</strong>. Reviens vérifier
              dans <strong style={{ color: "var(--pitch)" }}>~5 minutes</strong> dans « Mes réservations ».
            </p>
            <div className="col" style={{ gap: 10 }}>
              <Button block onClick={() => { setRequested(null); nav("/mes-reservations"); }}>Voir mes réservations</Button>
              <Button variant="ghost" block onClick={() => setRequested(null)}>Continuer à parcourir</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function renderSlotBadge({ isOwner, confirmed, pending, myConfirmed, myPending, past }) {
  if (isOwner) {
    if (confirmed) return <StatusBadge status="confirmed" label={confirmed.name} />;
    if (pending.length > 0) return <StatusBadge status="pending" label={`${pending.length} demande${pending.length > 1 ? "s" : ""}`} />;
    if (past) return <span className="muted" style={{ fontSize: 12 }}>Passé</span>;
    return <StatusBadge status="free" />;
  }
  // player
  if (confirmed) return <StatusBadge status={myConfirmed ? "confirmed" : "taken"} label={myConfirmed ? undefined : "Réservé"} />;
  if (myPending) return <StatusBadge status="pending" />;
  if (past) return <span className="muted" style={{ fontSize: 12 }}>Passé</span>;
  return <StatusBadge status="free" />;
}

function Row({ k, v }) {
  return (
    <div className="spread">
      <span className="muted" style={{ fontSize: 13 }}>{k}</span>
      <strong style={{ fontSize: 14 }}>{v}</strong>
    </div>
  );
}
