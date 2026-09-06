import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import AdminPage from "../app/admin/page";
import PrivacyPage from "../app/privacy/page";
import TermsPage from "../app/terms/page";
import "../app/globals.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const pathname = window.CLOUT_ROUTE || window.location.pathname.replace(basePath, "").replace(/\/+$/, "") || "/";

const routes: Record<string, { title: string; component: ReactNode }> = {
  "/": { title: "CLOUT Studios | Robinhood Play to Earn", component: <Home /> },
  "/admin": { title: "Studio Control | CLOUT Studios", component: <AdminPage /> },
  "/privacy": { title: "Privacy Policy | CLOUT Studios", component: <PrivacyPage /> },
  "/terms": { title: "Terms of Use | CLOUT Studios", component: <TermsPage /> },
};

const route = routes[pathname] || routes["/"];
document.title = route.title;

createRoot(document.getElementById("root")!).render(<StrictMode>{route.component}</StrictMode>);
