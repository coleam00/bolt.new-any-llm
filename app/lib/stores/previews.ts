import type { WebContainer } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

export class PreviewsStore {
  #availablePreviews = new Map<number, PreviewInfo>();
  #webcontainer: Promise<WebContainer>;

  previews: WritableAtom<PreviewInfo[]> = atom<PreviewInfo[]>([]);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
    this.#init();
  }

  async #init() {
    const webcontainer = await this.#webcontainer;
    webcontainer.on('port', this.#handlePortEvent);
  }

  #handlePortEvent = (port: number, type: 'open' | 'close', url: string) => {
    if (type === 'close') {
      this.#removePreview(port);
      return;
    }

    this.#updateOrAddPreview(port, url);
  };

  #removePreview(port: number) {
    this.#availablePreviews.delete(port);
    this.previews.set(this.previews.get().filter(preview => preview.port !== port));
  }

  #updateOrAddPreview(port: number, url: string) {
    const previews = this.previews.get();
    let previewInfo = this.#availablePreviews.get(port);

    if (!previewInfo) {
      previewInfo = { port, ready: true, baseUrl: url };
      this.#availablePreviews.set(port, previewInfo);
      previews.push(previewInfo);
    } else {
      previewInfo.ready = true;
      previewInfo.baseUrl = url;
    }

    this.previews.set([...previews]);
  }
}
