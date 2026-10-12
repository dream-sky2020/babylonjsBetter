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

test('event catalog retains declared zero-listener events and separates module count from callback count', () => {
  const communication = new LabCommunication(), source = communication.scope('source'), receiver = communication.scope('receiver');
  source.declareEvent(changedEvent, { publishes: true });
  assert.equal(communication.inspectEvents()[0].listenerCount, 0);
  const off = receiver.on(changedEvent, () => {}); receiver.on(changedEvent, () => {});
  assert.equal(communication.inspectEvents()[0].listenerCount, 2); assert.equal(communication.inspectEvents()[0].moduleCount, 1);
  off(); assert.equal(communication.inspectEvents()[0].listenerCount, 1);
  receiver.dispose(); source.dispose();
  assert.equal(communication.inspectEvents()[0].listenerCount, 0); assert.deepEqual(communication.inspectEvents()[0].declaredPublishers, []);
  communication.dispose();
});

test('dispatch records preserve parameter snapshots and recipient identities after unsubscribe', async () => {
  const communication = new LabCommunication(), source = communication.scope('undeclared-source'), receiver = communication.scope('receiver');
  receiver.on(changedEvent, () => {}); receiver.on(changedEvent, () => { throw new Error('failed listener'); });
  const payload = { value: 1 }, pending = source.publish(changedEvent, payload);
  payload.value = 2; receiver.dispose();
  const report = await pending; assert.equal(report.delivered, 1); assert.equal(report.failed.length, 1);
  const records = communication.journal.getEntries();
  const start = records.find(entry => entry.phase === 'event-published')!, end = records.find(entry => entry.phase === 'event-completed')!;
  assert.deepEqual(start.payloadPreview, { value: 1 }); assert.equal(start.recipients?.length, 2);
  assert.notEqual(start.recipients![0].listenerId, start.recipients![1].listenerId);
  assert.deepEqual(end.listenerResults?.map(result => result.status), ['success', 'failed']);
  assert.equal(communication.inspectEvents()[0].listenerCount, 0);
  assert.deepEqual(communication.inspectEvents()[0].observedPublishers, ['undeclared-source']);
  communication.dispose();
});

test('conflicting described event definitions fail at registration while legacy definitions remain compatible', () => {
  const communication = new LabCommunication(), scope = communication.scope('test');
  scope.declareEvent(changedEvent);
  const described = createLabEvent<{ value: number }>('test.changed', 1, { label: 'Changed', fields: [{ name: 'value', type: 'number' }] });
  scope.declareEvent(described); assert.equal(communication.inspectEvents()[0].definition.metadata?.label, 'Changed');
  assert.throws(() => scope.on(createLabEvent('test.changed', 1, { label: 'Conflicting' }), () => {}), /冲突定义/);
  scope.on(changedEvent, () => {}); assert.equal(communication.inspectEvents()[0].listenerCount, 1);
  communication.dispose();
});

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
