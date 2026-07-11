import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession, useStore } from "../store/hooks.js";
import { addSuggestion } from "../store/store.js";
import { Button, Card, EmptyState, useToast } from "../components/ui.jsx";

const AGO = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};

export default function Suggestions() {
  const session = useSession();
  const state = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [text, setText] = useState("");

  // The owner reviews suggestions in the dashboard — they don't submit them.
  if (session?.role === "owner") {
    return (
      <EmptyState
        glyph="📋"
        title="Suggestions des joueurs"
        message="Les suggestions se consultent et se traitent dans le tableau de bord."
        action={<Button onClick={() => nav("/proprietaire")}>Ouvrir le tableau de bord</Button>}
      />
    );
  }

  const mine = session ? state.suggestions.filter((s) => s.phone === session.phone) : [];

  function submit(e) {
    e.preventDefault();
    if (!session) { nav("/connexion"); return; }
    if (!text.trim()) return;
    addSuggestion(text);
    setText("");
    toast("Merci ! Suggestion envoyée au gérant.");
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: "4px 0 6px" }}>
        Améliorer le terrain 💡
      </h1>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Un filet à changer, l'éclairage, les vestiaires… dis-nous quoi améliorer.
      </p>

      <Card>
        <form className="col" style={{ gap: 12 }} onSubmit={submit}>
          <textarea
            className="input"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ta suggestion…"
            style={{ resize: "vertical", fontFamily: "var(--font)" }}
          />
          <Button type="submit" block disabled={!text.trim()}>Envoyer</Button>
        </form>
      </Card>

      <div className="muted" style={{ fontSize: 13, margin: "24px 0 10px" }}>Mes suggestions</div>
      {mine.length === 0 ? (
        <EmptyState glyph="💬" title="Aucune suggestion pour l'instant"
          message="Tes idées aident le gérant à améliorer le terrain." />
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {mine.map((s) => (
            <Card key={s.id} className="spread">
              <span style={{ fontSize: 14 }}>{s.text}</span>
              <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap", marginLeft: 12 }}>{AGO(s.createdAt)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
