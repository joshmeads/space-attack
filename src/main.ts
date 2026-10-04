import { bootGame } from './app/game';
import './style.css';

const host = document.querySelector<HTMLElement>('#app');
if (host) void bootGame(host);
