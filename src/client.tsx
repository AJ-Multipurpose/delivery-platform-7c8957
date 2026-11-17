import React from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
const bootstrap = JSON.parse(
  document.getElementById("dbd-bootstrap")!.textContent!,
);
hydrateRoot(
  document.getElementById("root")!,
  <App
    surface={bootstrap.surface}
    initialPath={bootstrap.path}
    initialCatalog={bootstrap.catalog}
  />,
);
