import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FACILITY } from "../config/facility.js";
import { signIn } from "../store/store.js";
import { Button, Card, Field, useToast } from "../components/ui.jsx";

// Instant account — no SMS/code. The phone is the account id; the owner
// approves each booking (and can call an unknown number), which is the
// anti-fake guard. Real verification would need SMS (paid) or email/Telegram.
export default function Login() {
  const [phone, setPhone] = useState("+216 ");
  const [name, setName] = useState("");
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const redirect = loc.state?.redirect || "/";

  function submit(e) {
    e.preventDefault();
    const res = signIn(phone, name);
    if (!res.ok) {
      toast(res.error, { err: true });
      return;
    }
    toast(`Bienvenue, ${res.user.name} !`);
    nav(res.user.role === "owner" ? "/proprietaire" : redirect);
  }

  return (
    <div style={{ maxWidth: 420, margin: "12px auto" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          width: 60, height: 60, margin: "0 auto 14px", borderRadius: 16, display: "grid", placeItems: "center",
          background: "linear-gradient(150deg, var(--pitch), var(--pitch-deep))", color: "#04140b",
          fontSize: 30, boxShadow: "var(--shadow-glow)",
        }}>⚽</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 4px" }}>Connexion</h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Ton numéro suffit — pas de code à saisir.
        </p>
      </div>

      <Card>
        <form className="col" style={{ gap: 14 }} onSubmit={submit}>
          <Field label="Numéro de téléphone">
            <input className="input mono" value={phone} onChange={(e) => setPhone(e.target.value)}
              inputMode="tel" placeholder="+216 20 123 456" autoFocus />
          </Field>
          <Field label="Prénom">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Skander" />
          </Field>
          <Button type="submit" block>Continuer</Button>
        </form>
      </Card>

      <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        En réservant, le gérant confirme ta demande (il peut t'appeler pour vérifier).<br />
        Gérant : connecte-toi avec <strong className="mono">{FACILITY.ownerPhone}</strong>.
      </p>
    </div>
  );
}
