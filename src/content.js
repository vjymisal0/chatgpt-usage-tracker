const HOST_ID = 'chatgpt-usage-tracker-host';

function formatCountdown(resetsAt, now) {
  if (!resetsAt) return 'no data yet';
  const diffMs = resetsAt - now;
  if (diffMs <= 0) return 'resets now';
  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `resets in ${days}d ${hours}h`;
  if (hours > 0) return `resets in ${hours}h ${minutes}m`;
  return `resets in ${minutes}m`;
}

function toneForPercent(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warn';
  return 'ok';
}

const STYLES = `
  :host { all: initial; }
  .root {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    color: #e5e5e5;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #202123;
    color: #e5e5e5;
    border: 1px solid #3a3b3d;
    border-radius: 999px;
    padding: 8px 14px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    user-select: none;
  }
  .tab:hover { background: #2b2c2f; }
  .card {
    margin-top: 8px;
    width: 260px;
    background: #202123;
    border: 1px solid #3a3b3d;
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    max-height: 60vh;
    overflow-y: auto;
  }
  .card.hidden { display: none; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .plan-badge {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #9b9ba1;
  }
  .model { margin-bottom: 10px; }
  .model:last-child { margin-bottom: 0; }
  .model-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .model-label { color: #e5e5e5; }
  .model-percent { color: #9b9ba1; }
  .meter {
    height: 6px;
    background: #3a3b3d;
    border-radius: 999px;
    overflow: hidden;
  }
  .meter-fill { height: 100%; border-radius: 999px; }
  .meter-fill.ok { background: #22c55e; }
  .meter-fill.warn { background: #f59e0b; }
  .meter-fill.danger { background: #ef4444; }
  .model-meta {
    margin-top: 3px;
    font-size: 11px;
    color: #9b9ba1;
  }
  .empty { color: #9b9ba1; text-align: center; padding: 8px 0; }
`;

function render(root, snapshot, collapsed) {
  const now = Date.now();
  const models = snapshot?.models ?? [];

  const modelsHtml = models.length
    ? models
        .map((model) => {
          if (model.unlimited) {
            return `
              <div class="model">
                <div class="model-row">
                  <span class="model-label">${model.label}</span>
                  <span class="model-percent">unlimited</span>
                </div>
              </div>
            `;
          }
          const percent = model.quota > 0 ? Math.min(100, Math.round((model.used / model.quota) * 100)) : 0;
          const tone = toneForPercent(percent);
          return `
            <div class="model">
              <div class="model-row">
                <span class="model-label">${model.label}</span>
                <span class="model-percent">${percent}%</span>
              </div>
              <div class="meter">
                <div class="meter-fill ${tone}" style="width: ${percent}%"></div>
              </div>
              <div class="model-meta">${model.used} / ${model.quota} &middot; ${formatCountdown(model.resetsAt, now)}</div>
            </div>
          `;
        })
        .join('')
    : '<div class="empty">Send a message to start tracking.</div>';

  root.innerHTML = `
    <style>${STYLES}</style>
    <div class="root">
      <div class="tab" id="aiu-tab">
        <span>Usage</span>
      </div>
      <div class="card ${collapsed ? 'hidden' : ''}" id="aiu-card">
        <div class="header">
          <span>ChatGPT Usage</span>
          <span class="plan-badge">${snapshot?.plan ?? 'plus'}</span>
        </div>
        ${modelsHtml}
      </div>
    </div>
  `;

  root.querySelector('#aiu-tab').addEventListener('click', async () => {
    const { overlayCollapsed } = await chrome.storage.local.get('overlayCollapsed');
    await chrome.storage.local.set({ overlayCollapsed: overlayCollapsed === false });
  });
}

async function main() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
  }
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  const draw = async () => {
    const { usageSnapshot, overlayCollapsed } = await chrome.storage.local.get(['usageSnapshot', 'overlayCollapsed']);
    render(root, usageSnapshot, overlayCollapsed !== false);
  };

  await draw();
  chrome.runtime.sendMessage({ action: 'getUsage' }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.usageSnapshot || changes.overlayCollapsed)) {
      draw();
    }
  });

  // Keeps the "resets in Xm" countdown text fresh between snapshot updates.
  setInterval(draw, 30_000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
