import { createCharacter } from '../logics/authApi.js';

export function initialiseCharacterCreation(onCreated) {
  const modal = document.querySelector('#characterCreationModal');
  const form = document.querySelector('#characterCreationForm');
  const error = document.querySelector('#characterCreationError');
  const open = () => { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); };
  const close = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true; error.textContent = '';
    try { const { character } = await createCharacter(Object.fromEntries(new FormData(form))); close(); onCreated(character); }
    catch (requestError) { error.textContent = requestError.message; }
    finally { submit.disabled = false; }
  });
  return { open };
}
