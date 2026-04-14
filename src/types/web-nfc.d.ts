interface NDEFScanOptions {
  signal?: AbortSignal;
}

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
  data?: DataView | null;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  message: NDEFMessage;
  serialNumber?: string;
}

interface NDEFReader extends EventTarget {
  onreading: ((this: NDEFReader, event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((this: NDEFReader, event: Event) => void) | null;
  scan(options?: NDEFScanOptions): Promise<void>;
}

declare var NDEFReader: {
  prototype: NDEFReader;
  new (): NDEFReader;
};
