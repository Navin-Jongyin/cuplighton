export function render(root) {
  root.innerHTML = `
    <div class="page-header"><div><h1>Not found</h1><div class="page-sub">This page does not exist.</div></div></div>
    <p><a href="#/dashboard">Return to dashboard</a></p>
  `;
}
