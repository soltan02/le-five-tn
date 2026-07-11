import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Schedule.css";
import { FACILITY } from "../config/facility.js";
import { upcomingDays, slotsForDay, longDate, isPast } from "../lib/dates.js";
import { useStore, useSession } from "../store/hooks.js";
import { bookingAt, createBooking, ownerCreateBooking, getPitches, confirmBooking, cancelBooking } from "../store/store.js";
import { Button, Card, Modal, StatusBadge, Field, useToast } from "../components/ui.jsx";
import PitchPhoto from "../components/PitchPhoto.jsx";

export default function Schedule() {
  const days = useMemo(() => upcomingDays(14), []);
  const slots = useMemo(() => slotsForDay(), []);
  useStore(); // re-render when bookings / pitches change
  const pitches = getPitches(); // active + maintenance (removed hidden)
  const [dayKey, setDayKey] = useState(days[0].key);
  const [pitchId, setPitchId] = useState(pitches[0]?.id);
  const [confirm, setConfirm] = useState(null); // free slot pending confirmation
  const [manage, setManage] = useState(null); // owner managing a taken slot
  const [clientName, setClientName] = useState("");
  const session = useSession();
  const toast = useToast();
  const nav = useNavigate();

  const isOwner = session?.role === "owner";
  // Keep a valid selection if pitches change (e.g. one gets removed).
  const pitch = pitches.find((p) => p.id === pitchId) || pitches[0];

  function onSlot(slot) {
    if (!pitch || pitch.status === "maintenance") return;
    if (isPast(dayKey, slot.start)) return;
    const taken = bookingAt(dayKey, pitch.id, slot.start);
    if (taken) {
      // Only the owner can act on a taken slot (free it / confirm it).
      if (isOwner) setManage({ slot, booking: taken });
      return;
    }
    if (!session) {
      nav("/connexion", { state: { redirect: "/" } });
      return;
    }
    setClientName("");
    setConfirm(slot);
  }

  function freeSlot() {
    const b = manage.booking;
    setManage(null);
    cancelBooking(b.id);
    toast("Créneau libéré.");
  }

  function doBook() {
    const slot = confirm;
    setConfirm(null);
    const args = { dayKey, pitchId: pitch.id, slotStart: slot.start, slotEnd: slot.end };
    const res = isOwner
      ? ownerCreateBooking({ ...args, name: clientName })
      : createBooking(args);
    if (res.ok) {
      toast(isOwner ? "Réservation confirmée pour le client." : "Réservation envoyée — en attente de confirmation.");
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

  return (
    <div>
      <div className="hero">
        <div className="center-circle" />
        <h1>{isOwner ? "Planning des terrains" : "Réserve ton terrain"}</h1>
        <p>
          {isOwner
            ? "Clique un créneau libre pour réserver au nom d'un client (appel téléphonique)."
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

      {/* Stadium selector — photo + format */}
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
            const taken = bookingAt(dayKey, pitch.id, slot.start);
            const mine = taken && session && taken.phone === session.phone;
            const past = isPast(dayKey, slot.start);
            // The owner can click a taken (future) slot to manage it; players can't.
            const disabled = past || (!!taken && !isOwner);
            return (
              <button
                key={slot.start}
                className={`slot ${taken ? "taken" : ""} ${mine ? "mine" : ""} ${past && !taken ? "past" : ""}`}
                onClick={() => onSlot(slot)}
                disabled={disabled}
              >
                <span>
                  <span className="time">{slot.start}</span>
                  <span className="sub">→ {slot.end}</span>
                </span>
                {taken ? (
                  isOwner
                    ? <StatusBadge status={taken.status} label={taken.name} />
                    : <StatusBadge status={mine ? taken.status : "taken"} label={mine ? undefined : "Réservé"} />
                ) : past ? (
                  <span className="muted" style={{ fontSize: 12 }}>Passé</span>
                ) : (
                  <StatusBadge status="free" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)}>
        {confirm && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, letterSpacing: "-0.02em" }}>
              {isOwner ? "Réserver pour un client" : "Confirmer la réservation"}
            </h2>
            <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
              {isOwner ? "Réservation confirmée immédiatement au nom du client." : "La demande sera envoyée au gérant pour confirmation."}
            </p>
            <div style={{ marginBottom: 14 }}>
              <PitchPhoto pitch={pitch} height={120} />
            </div>
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
              <div style={{ marginBottom: 16 }}>
                <Field label="Nom du client (au téléphone)">
                  <input className="input" autoFocus value={clientName} onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex : Groupe de Karim" />
                </Field>
              </div>
            )}
            <div className="row" style={{ gap: 10 }}>
              <Button variant="ghost" block onClick={() => setConfirm(null)}>Annuler</Button>
              <Button block onClick={doBook} disabled={isOwner && !clientName.trim()}>
                Réserver
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Owner: manage an existing (taken) slot — confirm or free it */}
      <Modal open={!!manage} onClose={() => setManage(null)}>
        {manage && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, letterSpacing: "-0.02em" }}>Gérer le créneau</h2>
            <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
              Libère le créneau si le client a annulé, ou confirme la demande.
            </p>
            <Card pad className="col" style={{ gap: 10, marginBottom: 18 }}>
              <Row k="Client" v={manage.booking.name} />
              <hr className="pitch-line" />
              <Row k="Téléphone" v={manage.booking.phone} />
              <hr className="pitch-line" />
              <Row k="Stade" v={`${pitch.name} · ${manage.slot.start}→${manage.slot.end}`} />
              <hr className="pitch-line" />
              <div className="spread">
                <span className="muted" style={{ fontSize: 13 }}>Statut</span>
                <StatusBadge status={manage.booking.status} />
              </div>
            </Card>
            <div className="col" style={{ gap: 10 }}>
              {manage.booking.status === "pending" && (
                <Button block onClick={() => { confirmBooking(manage.booking.id); setManage(null); toast("Réservation confirmée."); }}>
                  Confirmer la réservation
                </Button>
              )}
              <Button variant="danger" block onClick={freeSlot}>Libérer le créneau</Button>
              <Button variant="ghost" block onClick={() => setManage(null)}>Fermer</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="spread">
      <span className="muted" style={{ fontSize: 13 }}>{k}</span>
      <strong style={{ fontSize: 14 }}>{v}</strong>
    </div>
  );
}
