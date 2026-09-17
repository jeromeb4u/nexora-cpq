/**
 * Server-Sent Events framing, both directions.
 *
 * The document generator is consumed with `fetch` rather than `EventSource`
 * (it is a POST), so the browser does not parse the stream for us. The format
 * is small enough to implement exactly: `event:` and `data:` lines, a blank
 * line between events (https://html.spec.whatwg.org/multipage/server-sent-events.html).
 */

export interface ServerSentEvent {
  readonly event: string;
  readonly data: string;
}

const encoder = new TextEncoder();

export function encodeServerSentEvent(event: string, data: unknown): Uint8Array {
  // JSON never contains a raw newline, so the payload is always one data line.
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Incremental parser: feed it decoded text as chunks arrive and it returns the
 * events completed so far, holding any partial event until the next chunk.
 */
export function createServerSentEventParser() {
  let buffer = '';

  return function push(chunk: string): ServerSentEvent[] {
    buffer += chunk.replace(/\r\n?/g, '\n');
    const events: ServerSentEvent[] = [];

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue; // comment / keep-alive
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      if (data.length > 0) events.push({ event, data: data.join('\n') });

      boundary = buffer.indexOf('\n\n');
    }

    return events;
  };
}
