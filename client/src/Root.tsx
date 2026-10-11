import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import { Landing } from "./landing";

// The app itself is loaded only when someone opens it, so the landing page stays light.
const App = lazy(() => import("./App"));

type Route = "home" | "demo" | "app";

// The real app needs Ollama on the visitor's own machine, which a hosted copy of this
// page cannot reach. Away from localhost only the landing page and the demo are offered.
const LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

function route(): Route {
  if (location.hash.startsWith("#/demo")) return "demo";
  if (location.hash.startsWith("#/app")) return LOCAL ? "app" : "demo";
  return "home";
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

// Three places, kept in the address after the #: "/" the landing page, "/demo" the
// read-only tour with test calls, "/app" the real app.
export function Root() {
  const at = useSyncExternalStore(subscribe, route);
  useEffect(() => { if (at !== "home") window.scrollTo(0, 0); }, [at]);
  if (at === "home") return <Landing local={LOCAL} />;
  return (
    <Suspense fallback={<p className="label px-5 py-6 text-muted-foreground sm:px-8">Opening Linewise…</p>}>
      <App key={at} demo={at === "demo"} />
    </Suspense>
  );
}
