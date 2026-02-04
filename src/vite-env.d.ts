/// <reference types="vite/client" />

interface Window {
  ipcRenderer: import('electron').IpcRenderer
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      src?: string;
      preload?: string;
      webpreferences?: string;
      allowpopups?: string;
      useragent?: string;
    }, HTMLElement>;
  }
}
