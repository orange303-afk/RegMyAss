import React from 'react';
import ReactDOM from 'react-dom/client';
import { Options } from './Options';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  );
}
