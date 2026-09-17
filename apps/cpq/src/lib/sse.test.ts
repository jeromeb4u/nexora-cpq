import { describe, expect, it } from 'vitest';

import { createServerSentEventParser, encodeServerSentEvent } from './sse';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('server-sent events', () => {
  it('round-trips an encoded event', () => {
    const push = createServerSentEventParser();
    const events = push(decode(encodeServerSentEvent('step', { id: 'render', status: 'active' })));

    expect(events).toEqual([{ event: 'step', data: '{"id":"render","status":"active"}' }]);
  });

  it('holds a partial event until the rest arrives', () => {
    const push = createServerSentEventParser();
    const wire = decode(encodeServerSentEvent('complete', { fileName: 'QT-1-v1.pdf' }));

    expect(push(wire.slice(0, 12))).toEqual([]);
    expect(push(wire.slice(12))).toHaveLength(1);
  });

  it('parses several events from one chunk, ignoring comments and CRLF', () => {
    const push = createServerSentEventParser();
    const events = push(': keep-alive\r\n\r\nevent: a\r\ndata: 1\r\n\r\nevent: b\ndata: 2\n\n');

    expect(events.map((event) => [event.event, event.data])).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]);
  });

  it('joins multi-line data and defaults the event name', () => {
    const push = createServerSentEventParser();
    expect(push('data: first\ndata: second\n\n')).toEqual([{ event: 'message', data: 'first\nsecond' }]);
  });
});
