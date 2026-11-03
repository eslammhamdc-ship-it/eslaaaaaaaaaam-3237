import { Route, Switch } from "wouter";
import Index from "./pages/index";
import Account from "./pages/account";
import Team from "./pages/team";
import { lazy, Suspense } from "react";
const CRM = lazy(() => import("./crm/pages/workspace"));
import { SessionGate } from "./lib/workspace";
import "./workspace.css";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <SessionGate>
        <Suspense fallback={<div className="loading-panel">جارٍ تحميل مساحة العمل…</div>}>
          <Switch>
            <Route path="/account" component={Account} />
            <Route path="/team" component={Team} />
            <Route path="/crm" component={CRM} />
            <Route path="/" component={Index} />
            <Route path="/requests" component={Index} />
            <Route path="/companies" component={Index} />
            <Route path="/employees" component={Index} />
            <Route path="/reports" component={Index} />
            <Route component={Index} />
          </Switch>
        </Suspense>
      </SessionGate>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
