// Sound control, top right on every page: VolumeX when muted, Volume2 when on.
// 44 × 44 px target, native button (Enter/Space), label describes the action it performs.
import { sound } from '../sound';
import { icon, icons } from './icons';

export function createSoundToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle';
  const pill = document.createElement('span');
  pill.className = 'sound-toggle__pill';
  button.append(pill);
  const render = (on: boolean) => {
    pill.replaceChildren(icon(on ? icons.volumeOn : icons.volumeOff));
    button.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    button.dataset.state = on ? 'on' : 'off';
  };
  render(sound.enabled);
  sound.subscribe(render);
  button.addEventListener('click', () => sound.toggle());
  return button;
}
