import { useNavigate } from "react-router-dom";
import { useSession } from "../store/hooks.js";
import { logout } from "../store/store.js";
import { Button, Card, EmptyState } from "../components/ui.jsx";

export default function Account() {
  const session = useSession();
  const nav = useNavigate();

  if (!session) {
    return (
      <EmptyState glyph="🔒" title="Pas encore connecté"
        action={<Button onClick={() => nav("/connexion")}>Se connecter</Button>} />
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "12px auto" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          width: 72, height: 72, margin: "0 auto 12px", borderRadius: "50%", display: "grid", placeItems: "center",
          background: "var(--pitch-ghost)", color: "var(--pitch)", fontWeight: 800, fontSize: 28,
        }}>{session.name?.[0]?.toUpperCase()}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px" }}>{session.name}</h1>
        <p className="muted mono" style={{ margin: 0, fontSize: 13 }}>{session.phone}</p>
      </div>

      <Card className="col" style={{ gap: 12 }}>
        <Row k="Statut" v={session.role === "owner" ? "Gérant" : "Joueur"} />
        {session.role === "owner" && (
          <Button variant="soft" block onClick={() => nav("/proprietaire")}>Espace gérant</Button>
        )}
        <Button variant="ghost" block onClick={async () => { await logout(); nav("/"); }}>Se déconnecter</Button>
      </Card>
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
