import { mount } from "@continuum-js/dom";
import { App } from "./App.js";
import "./app.css";

mount(document.getElementById("app")!, () => <App />);
