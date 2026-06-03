import './process-shim';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installConsoleCapture } from './debug-log';
import './globals.css';
import './styles.css';

installConsoleCapture();

const el = document.getElementById('sidebar');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
