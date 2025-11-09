/**
 * TypeScript declarations for <model-viewer> custom element
 * @see https://modelviewer.dev/
 */

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerJSX & React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

interface ModelViewerJSX {
  src?: string;
  alt?: string;
  ar?: boolean;
  'ar-modes'?: string;
  'ar-scale'?: string;
  'camera-controls'?: boolean;
  'shadow-intensity'?: string;
  autoplay?: boolean;
  'auto-rotate'?: boolean;
  'loading'?: 'auto' | 'lazy' | 'eager';
  'reveal'?: 'auto' | 'interaction' | 'manual';
  ref?: React.Ref<any>;
  onLoad?: (event: Event) => void;
  onArStatus?: (event: CustomEvent) => void;
  children?: React.ReactNode;
}

export {};
