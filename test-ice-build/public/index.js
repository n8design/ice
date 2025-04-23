import "./styles.scss";
function greet(name) {
  return `Hello, ${name}! Build time: ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`;
}
const message = greet("Ice Build User");
console.log(message);
console.debug("Debugging information:");
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (app) {
    app.textContent = message;
  }
});
