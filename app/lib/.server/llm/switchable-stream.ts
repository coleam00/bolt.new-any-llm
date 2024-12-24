export default class SwitchableStream extends TransformStream {
  private _controller: TransformStreamDefaultController | null = null;
  private _currentReader: ReadableStreamDefaultReader | null = null;
  private _switches = 0;

  constructor() {
    let controllerRef: TransformStreamDefaultController | undefined;

    super({
      start(controller) {
        controllerRef = controller;
      },
    });

    if (controllerRef === undefined) {
      throw new Error('Controller not properly initialized');
    }

    this._controller = controllerRef;
  }

  async switchSource(newStream: ReadableStream) {
    if (this._currentReader) {
      await this._currentReader.cancel();
    }

    this._currentReader = newStream.getReader();

    try {
      await this._pumpStream();
    } catch (error) {
      console.error('Error switching stream source:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }

    this._switches++;
  }

  private async _pumpStream() {
    if (!this._currentReader || !this._controller) {
      throw new Error('Stream is not properly initialized');
    }

    try {
      while (true) {
        const { done, value } = await this._currentReader.read();

        if (done) {
          break;
        }

        // Handle different types of chunks that might come from different providers
        if (value instanceof Uint8Array) {
          // Handle binary data
          this._controller.enqueue(value);
        } else if (typeof value === 'string') {
          // Handle string data
          this._controller.enqueue(new TextEncoder().encode(value));
        } else if (value && typeof value === 'object') {
          // Handle structured data (like from Azure OpenAI)
          try {
            const chunk = JSON.stringify(value);
            this._controller.enqueue(new TextEncoder().encode(chunk + '\n'));
          } catch (e) {
            console.error('Error stringifying chunk:', e);
            this._controller.enqueue(new TextEncoder().encode(String(value)));
          }
        } else {
          // Handle any other type by converting to string
          this._controller.enqueue(new TextEncoder().encode(String(value)));
        }
      }
    } catch (error) {
      console.error('Error pumping stream:', error);

      if (this._controller) {
        this._controller.error(error instanceof Error ? error : new Error(String(error)));
      }

      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  close() {
    if (this._currentReader) {
      this._currentReader.cancel();
    }

    this._controller?.terminate();
  }

  get switches() {
    return this._switches;
  }
}
