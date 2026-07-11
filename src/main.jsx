import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Apply the saved theme before first paint to avoid a flash.
const saved = localStorage.getItem("lefive.theme") || "dark";
document.documentElement.setAttribute("data-theme", saved);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
