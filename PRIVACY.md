# Privacy Policy - ChatGPT Usage Tracker

**Everything this extension does stays on your device. Nothing is sent to any external server.**

## What data is collected

- The **model name** (e.g. `gpt-5`, `o3`) and a **timestamp** each time you send a message on chatgpt.com or chat.openai.com. This is read from the outgoing request your own browser already makes to ChatGPT - the extension does not create or intercept any new network traffic, it only observes requests you were already sending.
- Your selected **plan** (Free/Plus/Pro/Team) and any **custom limit overrides** you choose to set in the popup.

## Where it's stored

All of the above is stored using `chrome.storage.local` - a storage area private to your own browser profile. It is never transmitted anywhere: not to the extension's developer, not to any analytics service, not to any third party.

## What the extension does NOT do

- It does not read the content of your messages or ChatGPT's responses.
- It does not read your account credentials, session tokens, or any personal information.
- It does not communicate with any server other than the two domains it's built for (chatgpt.com / chat.openai.com), and only to observe your own outgoing requests - it never makes requests of its own.
- It does not use cookies, analytics, or tracking of any kind.

## Permissions used and why

| Permission | Why it's needed |
|---|---|
| `storage` | Save your usage counts, plan selection, and custom limits locally. |
| `webRequest` | Read (not modify) the model name from your own outgoing message requests to detect which model you just used. |
| `alarms` | Periodically refresh the displayed countdown and prune old usage records. |
| Host access to `chatgpt.com` / `chat.openai.com` | Required for the above to function on those specific sites only - no other site is accessed. |

## Uninstalling

Removing the extension deletes all locally stored data with it. There is nothing to "clean up" elsewhere, because nothing ever left your browser.
