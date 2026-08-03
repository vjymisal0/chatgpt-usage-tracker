import { getAllKnownModels as getAllKnownModelsFromQuota, matchModelId as matchModelIdPure, computeUsage } from './logic.js';

const CONVERSATION_URL_PATTERNS = [
  'https://chatgpt.com/backend-api/conversation',
  'https://chatgpt.com/backend-api/*/conversation',
  'https://chat.openai.com/backend-api/conversation',
  'https://chat.openai.com/backend-api/*/conversation',
];

let quotaCache = null;

async function loadQuota() {
  if (quotaCache) return quotaCache;
  const response = await fetch(chrome.runtime.getURL('src/quota.json'));
  quotaCache = await response.json();
  return quotaCache;
}

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(items) {
  return chrome.storage.local.set(items);
}

/** Every model entry across every plan, deduplicated by id, for matching incoming request bodies. */
async function getAllKnownModels() {
  const quota = await loadQuota();
  return getAllKnownModelsFromQuota(quota);
}

/** Matches a ChatGPT API model slug (e.g. "gpt-5-thinking") to a known model id. */
async function matchModelId(apiModelSlug) {
  const known = await getAllKnownModels();
  return matchModelIdPure(apiModelSlug, known);
}

async function recordUsage(modelId) {
  const key = `timestamps_${modelId}`;
  const { [key]: existing = [] } = await getStorage(key);
  existing.push(Date.now());
  await setStorage({ [key]: existing });
}

async function getActivePlan() {
  const { activePlan } = await getStorage('activePlan');
  return activePlan || 'plus';
}

async function getCustomLimits() {
  const { customLimits } = await getStorage('customLimits');
  return customLimits || {};
}

/** Computes the current usage snapshot for the active plan and writes it to storage. */
async function refreshUsageSnapshot() {
  const quota = await loadQuota();
  const plan = await getActivePlan();
  const customLimits = await getCustomLimits();
  const models = quota.plans[plan] || quota.plans.plus;

  const storageKeys = models.map((m) => `timestamps_${m.id}`);
  const stored = await getStorage(storageKeys);
  const now = Date.now();

  const timestampsByModelId = {};
  for (const model of models) {
    timestampsByModelId[model.id] = stored[`timestamps_${model.id}`] || [];
  }

  const usage = computeUsage(models, timestampsByModelId, customLimits, now);
  await setStorage({ usageSnapshot: { plan, updatedAt: now, models: usage } });
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== 'POST' || !details.requestBody?.raw?.[0]?.bytes) return;

    (async () => {
      try {
        const bodyText = new TextDecoder('utf-8').decode(details.requestBody.raw[0].bytes);
        const body = JSON.parse(bodyText);
        const modelId = await matchModelId(body.model);
        if (!modelId) return;

        await recordUsage(modelId);
        await refreshUsageSnapshot();
      } catch {
        // Malformed or unrecognized request body - ignore.
      }
    })();
  },
  { urls: CONVERSATION_URL_PATTERNS },
  ['requestBody']
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'getUsage': {
        await refreshUsageSnapshot();
        const { usageSnapshot } = await getStorage('usageSnapshot');
        sendResponse(usageSnapshot);
        break;
      }
      case 'setPlan': {
        await setStorage({ activePlan: message.plan });
        await refreshUsageSnapshot();
        sendResponse({ ok: true });
        break;
      }
      case 'setCustomLimit': {
        const customLimits = await getCustomLimits();
        customLimits[message.modelId] = { quota: message.quota, hours: message.hours };
        await setStorage({ customLimits });
        await refreshUsageSnapshot();
        sendResponse({ ok: true });
        break;
      }
      case 'clearCustomLimit': {
        const customLimits = await getCustomLimits();
        delete customLimits[message.modelId];
        await setStorage({ customLimits });
        await refreshUsageSnapshot();
        sendResponse({ ok: true });
        break;
      }
      case 'resetModel': {
        await setStorage({ [`timestamps_${message.modelId}`]: [] });
        await refreshUsageSnapshot();
        sendResponse({ ok: true });
        break;
      }
      case 'resetAll': {
        const allModels = await getAllKnownModels();
        const clear = {};
        for (const m of allModels) clear[`timestamps_${m.id}`] = [];
        await setStorage(clear);
        await refreshUsageSnapshot();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: 'unknown action' });
    }
  })();
  return true; // keep the message channel open for the async response
});

// Keeps resetsAt countdowns accurate and prunes old timestamps even with no active tab.
chrome.alarms.create('refresh', { periodInMinutes: 1 });
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh') {
    refreshUsageSnapshot();
  } else if (alarm.name === 'cleanup') {
    (async () => {
      const allModels = await getAllKnownModels();
      const longestHours = Math.max(...allModels.map((m) => m.hours || 24));
      const cutoff = Date.now() - longestHours * 60 * 60 * 1000 * 1.5;
      const storageKeys = allModels.map((m) => `timestamps_${m.id}`);
      const stored = await getStorage(storageKeys);
      const trimmed = {};
      for (const key of storageKeys) {
        const timestamps = stored[key] || [];
        trimmed[key] = timestamps.filter((ts) => ts >= cutoff);
      }
      await setStorage(trimmed);
    })();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  refreshUsageSnapshot();
});
