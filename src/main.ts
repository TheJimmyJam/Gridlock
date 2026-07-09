import Phaser from 'phaser';
import { GridScene } from './game/GridScene';
import { loadWorldState } from './game/persistence';
import { supabase } from './game/supabaseClient';

const authOverlay = document.getElementById('auth-overlay') as HTMLDivElement;
const emailInput = document.getElementById('auth-email') as HTMLInputElement;
const passwordInput = document.getElementById('auth-password') as HTMLInputElement;
const signInBtn = document.getElementById('auth-sign-in') as HTMLButtonElement;
const signUpBtn = document.getElementById('auth-sign-up') as HTMLButtonElement;
const errorEl = document.getElementById('auth-error') as HTMLDivElement;
const statusEl = document.getElementById('auth-status') as HTMLDivElement;
const signOutBtn = document.getElementById('sign-out-btn') as HTMLButtonElement;
const buildHudEl = document.getElementById('build-hud') as HTMLDivElement;

let game: Phaser.Game | null = null;

async function startGame(userId: string): Promise<void> {
  authOverlay.classList.add('hidden');
  signOutBtn.style.display = 'block';
  buildHudEl.style.display = 'flex';

  statusEl.textContent = '';
  const initialState = (await loadWorldState(userId)) ?? undefined;

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#111111',
    scale: {
      mode: Phaser.Scale.RESIZE,
    },
    scene: [],
  });
  game.scene.add('GridScene', GridScene);
  game.scene.start('GridScene', { userId, initialState });
}

function showAuthOverlay(): void {
  authOverlay.classList.remove('hidden');
  signOutBtn.style.display = 'none';
  buildHudEl.style.display = 'none';
  if (game) {
    game.destroy(true);
    game = null;
  }
}

signInBtn.addEventListener('click', () => {
  void (async () => {
    errorEl.textContent = '';
    statusEl.textContent = 'Signing in…';
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.value,
      password: passwordInput.value,
    });
    if (error) {
      statusEl.textContent = '';
      errorEl.textContent = error.message;
    }
  })();
});

signUpBtn.addEventListener('click', () => {
  void (async () => {
    errorEl.textContent = '';
    statusEl.textContent = 'Creating account…';
    const { error } = await supabase.auth.signUp({
      email: emailInput.value,
      password: passwordInput.value,
    });
    if (error) {
      statusEl.textContent = '';
      errorEl.textContent = error.message;
    }
  })();
});

signOutBtn.addEventListener('click', () => {
  void supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    void startGame(session.user.id);
  } else {
    showAuthOverlay();
  }
});
