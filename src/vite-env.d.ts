/// <reference types="vite/client" />

interface Window {
  __TAURI__?: Record<string, unknown>;
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
