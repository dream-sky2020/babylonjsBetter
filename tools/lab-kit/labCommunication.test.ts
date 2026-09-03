import assert from 'node:assert/strict';
import test from 'node:test';
import { LabCommunication } from './labCommunication.ts';
import {
  createLabEvent,
  createLabRequest,
  LabCommunicationError,
} from './labCommunication.types.ts';

const sumRequest = createLabRequest<{ left: number; right: number }, number>('test.sum');
const changedEvent = createLabEvent<{ value: number }>('test.changed');

test('typed request reaches one handler and returns its result', async () => {
  const communication = new LabCommunication();
  const server = communication.scope('server');
  const client = communication.scope('client');
  server.handle(sumRequest, ({ left, right }, { message }) => {
    assert.equal(message.sourceModuleId, 'client');
    assert.equal(message.type, 'test.sum');
    return left + right;
  });

  assert.equal(await client.request(sumRequest, { left: 2, right: 5 }), 7);
  assert.deepEqual(
    communication.journal.getEntries().map(({ phase, status }) => ({ phase, status })),
    [
      { phase: 'request-started', status: 'pending' },
      { phase: 'request-completed', status: 'success' },
    ],
  );
  communication.dispose();
});

test('duplicate and missing request handlers produce structured errors', async () => {
  const communication = new LabCommunication();
  const first = communication.scope('first');
  const second = communication.scope('second');
  assert.equal(second.hasHandler(sumRequest), false);
  first.handle(sumRequest, () => 1);
  assert.equal(second.hasHandler(sumRequest), true);

  assert.throws(
    () => second.handle(sumRequest, () => 2),
    (error) => error instanceof LabCommunicationError && error.code === 'DUPLICATE_HANDLER',
  );
  first.dispose();
  assert.equal(second.hasHandler(sumRequest), false);
  await assert.rejects(
    second.request(sumRequest, { left: 0, right: 0 }),
    (error) => error instanceof LabCommunicationError && error.code === 'NO_HANDLER',
  );
  communication.dispose();
});

test('request timeout aborts the handler context', async () => {
  const communication = new LabCommunication();
  const server = communication.scope('server');
  const client = communication.scope('client');
  let handlerAborted = false;
  server.handle(sumRequest, (_input, { signal }) => new Promise<number>((resolve) => {
    signal.addEventListener('abort', () => {
      handlerAborted = true;
      resolve(0);
    }, { once: true });
  }));

  await assert.rejects(
    client.request(sumRequest, { left: 1, right: 2 }, { timeoutMs: 5 }),
    (error) => error instanceof LabCommunicationError && error.code === 'TIMEOUT',
  );
  assert.equal(handlerAborted, true);
  communication.dispose();
});

test('event listeners are isolated and scope disposal removes registrations', async () => {
  const communication = new LabCommunication();
  const publisher = communication.scope('publisher');
  const healthy = communication.scope('healthy');
  const failing = communication.scope('failing');
  let received = 0;
  healthy.on(changedEvent, ({ value }) => { received += value; });
  failing.on(changedEvent, () => { throw new Error('listener failure'); });

  const firstReport = await publisher.publish(changedEvent, { value: 3 });
  assert.equal(received, 3);
  assert.equal(firstReport.delivered, 1);
  assert.equal(firstReport.failed.length, 1);
  assert.equal(firstReport.failed[0].moduleId, 'failing');
  assert.deepEqual(
    communication.journal.getEntries().map(({ phase }) => phase),
    ['event-published', 'event-listener-failed', 'event-completed'],
  );

  healthy.dispose();
  failing.dispose();
  const secondReport = await publisher.publish(changedEvent, { value: 4 });
  assert.deepEqual(secondReport, { delivered: 0, failed: [] });
  communication.dispose();
});

test('communication journal is bounded and stores detached payload previews', async () => {
  const communication = new LabCommunication({ journalCapacity: 2 });
  const server = communication.scope('server');
  const client = communication.scope('client');
  server.handle(sumRequest, ({ left, right }) => left + right);
  const input = { left: 1, right: 2 };

  await client.request(sumRequest, input);
  input.left = 99;
  await client.request(sumRequest, { left: 3, right: 4 });

  const entries = communication.journal.getEntries();
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(({ sequence }) => sequence), [3, 4]);
  assert.deepEqual(entries[0].payloadPreview, { left: 3, right: 4 });
  communication.journal.clear();
  assert.deepEqual(communication.journal.getEntries(), []);
  communication.dispose();
});
