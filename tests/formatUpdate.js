import test from 'ava';
import io from 'socket.io-client';
import Botmaster from 'botmaster';

import SocketioBot from '../lib';

test.beforeEach((t) => {
  return new Promise((resolve) => {
    t.context.botmaster = new Botmaster();
    t.context.bot = new SocketioBot({
      id: 'botId',
      server: t.context.botmaster.server,
    });
    t.context.botmaster.addBot(t.context.bot);
    t.context.botmaster.on('listening', resolve);
  });
});

test.afterEach((t) => {
  return new Promise((resolve) => {
    t.context.botmaster.server.close(resolve);
  });
});

test('should always result in the update having a sender.id, a recipient.id ' +
    'a timestamp and a message.mid', (t) => {
  t.plan(6);

  const socket = io('ws://localhost:3000');

  return new Promise((resolve) => {
    socket.on('connect', () => {
      socket.send({ message: {} });
    });

    t.context.botmaster.use({
      type: 'incoming',
      controller: (bot, update) => {
        t.is(update.recipient.id, 'botId', 'recipient.id not same as expected');
        t.is(update.sender.id, socket.id, 'sender.id not same as expected');
        t.truthy(update.timestamp, 'No timestamp was found');
        t.is(update.message.mid, `botId.${socket.id}.${String(update.timestamp)}`,
            'update.message.mid is not the same as expected');
        t.falsy(update.socket);
        t.is(update.raw.socket.id, socket.id);
        socket.disconnect();
        resolve();
      },
    });
  });
});
