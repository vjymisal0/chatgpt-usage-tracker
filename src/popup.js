function formatCountdown(resetsAt) {
  if (!resetsAt) return 'no data yet';
  const diffMs = resetsAt - Date.now();
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

async function getDefaultModel(plan, modelId) {
  const response = await fetch(chrome.runtime.getURL('src/quota.json'));
  const quota = await response.json();
  return (quota.plans[plan] || []).find((m) => m.id === modelId);
}

function renderModels(container, snapshot) {
  const models = snapshot?.models ?? [];
  if (!models.length) {
    container.innerHTML = '<div class="empty">Send a message in ChatGPT to start tracking.</div>';
    return;
  }

  container.innerHTML = models
    .map((model) => {
      const percent = !model.unlimited && model.quota > 0 ? Math.min(100, Math.round((model.used / model.quota) * 100)) : 0;
      const tone = toneForPercent(percent);
      const meter = model.unlimited
        ? ''
        : `<div class="meter"><div class="meter-fill ${tone}" style="width:${percent}%"></div></div>`;
      const meta = model.unlimited
        ? 'unlimited'
        : `${model.used} / ${model.quota} &middot; ${formatCountdown(model.resetsAt)}`;

      return `
        <div class="model" data-model-id="${model.id}">
          <div class="model-header">
            <span class="model-label">${model.label}</span>
            <span class="model-percent">${model.unlimited ? '' : percent + '%'}</span>
          </div>
          ${meter}
          <div class="model-meta">${meta}</div>
          <div class="row-actions">
            <button class="link edit-toggle">Edit limit</button>
            <button class="link reset-count">Reset count</button>
            <button class="link danger revert-default">Revert to default</button>
          </div>
          <div class="edit-row">
            <input type="number" class="quota-input" min="-1" value="${model.quota}" />
            <span>per</span>
            <input type="number" class="hours-input" min="1" value="${model.hours}" />
            <span>hrs</span>
            <button class="link save-limit">Save</button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function loadAndRender() {
  const { activePlan } = await chrome.storage.local.get('activePlan');
  const plan = activePlan || 'plus';
  document.getElementById('plan').value = plan;

  const snapshot = await chrome.runtime.sendMessage({ action: 'getUsage' });
  renderModels(document.getElementById('models'), snapshot);
}

document.getElementById('plan').addEventListener('change', async (e) => {
  await chrome.runtime.sendMessage({ action: 'setPlan', plan: e.target.value });
  await loadAndRender();
});

document.getElementById('reset-all').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'resetAll' });
  await loadAndRender();
});

document.getElementById('models').addEventListener('click', async (e) => {
  const modelEl = e.target.closest('.model');
  if (!modelEl) return;
  const modelId = modelEl.dataset.modelId;

  if (e.target.classList.contains('edit-toggle')) {
    modelEl.querySelector('.edit-row').classList.toggle('open');
    return;
  }

  if (e.target.classList.contains('reset-count')) {
    await chrome.runtime.sendMessage({ action: 'resetModel', modelId });
    await loadAndRender();
    return;
  }

  if (e.target.classList.contains('revert-default')) {
    await chrome.runtime.sendMessage({ action: 'clearCustomLimit', modelId });
    await loadAndRender();
    return;
  }

  if (e.target.classList.contains('save-limit')) {
    const quota = Number(modelEl.querySelector('.quota-input').value);
    const hours = Number(modelEl.querySelector('.hours-input').value);
    await chrome.runtime.sendMessage({ action: 'setCustomLimit', modelId, quota, hours });
    await loadAndRender();
  }
});

loadAndRender();
