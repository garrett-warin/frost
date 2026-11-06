export function isYouTube(url) {
  try {
    const { hostname, protocol } = new URL(url);
    return /^(https?:)$/.test(protocol) && (hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com'));
  } catch { return false; }
}

const accepted = new WeakSet();
let pending;

export async function confirmYouTube(url, tab) {
  if (!isYouTube(url) || accepted.has(tab)) return true;
  if (!pending) {
    pending = new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'youtube-notice';
      dialog.setAttribute('aria-labelledby', 'youtube-notice-title');
      dialog.setAttribute('aria-describedby', 'youtube-notice-description');
      const heading = document.createElement('h2');
      heading.id = 'youtube-notice-title';
      heading.textContent = 'YouTube requires sign-in';
      const description = document.createElement('p');
      description.id = 'youtube-notice-description';
      description.textContent = 'To watch content on YouTube through Grove, you must sign in to a YouTube account. Without an account, videos won’t play.';
      const actions = document.createElement('form');
      actions.method = 'dialog';
      for (const [value, label] of [['cancel', 'Cancel'], ['continue', 'Continue to YouTube']]) {
        const button = document.createElement('button');
        button.value = value;
        button.textContent = label;
        actions.append(button);
      }
      dialog.append(heading, description, actions);
      dialog.addEventListener('close', () => {
        const proceed = dialog.returnValue === 'continue';
        dialog.remove();
        pending = undefined;
        resolve(proceed);
      }, { once: true });
      document.body.append(dialog);
      dialog.showModal();
    });
  }
  const proceed = await pending;
  if (proceed) accepted.add(tab);
  return proceed;
}
