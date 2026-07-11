import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FACILITY } from "../config/facility.js";
import { requestOtp, verifyOtp } from "../store/store.js";
import { Button, Card, Field, useToast } from "../components/ui.jsx";

// Phone + OTP login. DEV-FREE: the 6-digit code is shown on screen instead of
// paying an SMS gateway. In production the code is generated + sent server-side
// (Firebase Phone Auth or a Tunisian SMS gateway) and never revealed here.
export default function Login() {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("+216 ");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const redirect = loc.state?.redirect || "/";

  function sendCode(e) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 8) {
      toast("Numéro invalide.", { err: true });
      return;
    }
    const c = requestOtp(phone.trim());
    setDevCode(c);
    setStep("otp");
  }

  function verify(e) {
    e.preventDefault();
    const res = verifyOtp(phone.trim(), code.trim(), name);
    if (res.ok) {
      toast(`Bienvenue, ${res.user.name} !`);
      nav(res.user.role === "owner" ? "/proprietaire" : redirect);
    } else {
      toast(res.error, { err: true });
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "12px auto" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          width: 60, height: 60, margin: "0 auto 14px", borderRadius: 16, display: "grid", placeItems: "center",
          background: "linear-gradient(150deg, var(--pitch), var(--pitch-deep))", color: "#04140b",
          fontSize: 30, boxShadow: "var(--shadow-glow)",
        }}>⚽</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 4px" }}>
          {step === "phone" ? "Connexion" : "Vérification"}
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {step === "phone"
            ? "Reçois un code par SMS pour réserver."
            : `Code envoyé au ${phone}`}
        </p>
      </div>

      <Card>
        {step === "phone" ? (
          <form className="col" style={{ gap: 14 }} onSubmit={sendCode}>
            <Field label="Numéro de téléphone">
              <input className="input mono" value={phone} onChange={(e) => setPhone(e.target.value)}
                inputMode="tel" placeholder="+216 20 123 456" autoFocus />
            </Field>
            <Field label="Prénom (nouveau joueur)">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Skander" />
            </Field>
            <Button type="submit" block>Envoyer le code</Button>
          </form>
        ) : (
          <form className="col" style={{ gap: 14 }} onSubmit={verify}>
            {devCode && (
              <div style={{
                background: "var(--pitch-ghost)", border: "1px solid var(--pitch)", color: "var(--pitch)",
                borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, textAlign: "center",
              }}>
                Mode démo — code : <strong className="mono" style={{ fontSize: 16 }}>{devCode}</strong>
              </div>
            )}
            <OtpInput value={code} onChange={setCode} />
            <Button type="submit" block disabled={code.length < 6}>Vérifier</Button>
            <button type="button" onClick={() => setStep("phone")}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>
              ← Changer de numéro
            </button>
          </form>
        )}
      </Card>

      <p className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Astuce démo : connecte-toi avec <strong className="mono">{FACILITY.ownerPhone}</strong> pour
        accéder à l'espace gérant.
      </p>
    </div>
  );
}

// Six single-digit boxes with auto-advance.
function OtpInput({ value, onChange }) {
  const refs = useRef([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const digits = value.padEnd(6).slice(0, 6).split("");
  function set(i, v) {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[i] = d;
    const joined = next.join("").slice(0, 6);
    onChange(joined.replace(/\s/g, ""));
    if (d && i < 5) refs.current[i + 1]?.focus();
  }
  function onKey(i, e) {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus();
  }
  return (
    <div className="row" style={{ gap: 8, justifyContent: "center" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="input mono"
          style={{ width: 46, textAlign: "center", fontSize: 20, padding: "12px 0" }}
          inputMode="numeric"
          maxLength={1}
          value={digits[i].trim()}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
        />
      ))}
    </div>
  );
}
