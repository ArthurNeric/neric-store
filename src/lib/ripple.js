// Material-style click ripple. The target element needs the "nx-ripple-host"
// class (position: relative + overflow: hidden, defined in global.css) —
// attach via onMouseDown={spawnRipple} on any button.
export function spawnRipple(event) {
  const el = event.currentTarget;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const span = document.createElement("span");
  span.className = "nx-ripple";
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${event.clientX - rect.left - size / 2}px`;
  span.style.top = `${event.clientY - rect.top - size / 2}px`;
  el.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}
