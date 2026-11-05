import { TOAST_DURATION_MS } from '../constants.js';

export function createToast(element) {
  return (message) => {
    element.textContent = message;
    element.classList.add('show');
    window.setTimeout(() => element.classList.remove('show'), TOAST_DURATION_MS);
  };
}
