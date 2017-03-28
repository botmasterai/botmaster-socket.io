import test from 'ava';
import http from 'http';
import io from 'socket.io-client';
import { attachmentFixtures } from 'botmaster-test-fixtures';
import Botmaster from 'botmaster';

import SocketioBot from '../lib';

test.beforeEach((t) => {
  return new Promise((resolve) => {
    t.context.server = http.createServer();
    t.context.server.listen(3000, '0.0.0.0', () => {

      t.context.bot = new SocketioBot({
        id: 'botId',
        server: t.context.server,
      });

      // can be used either with or without the botmaster object.
      t.context.botmaster = new Botmaster({
        server: t.context.server,
      });

      t.context.botmaster.addBot(t.context.bot);

      resolve();
    });
  });
});

test.afterEach((t) => {
  return new Promise((resolve) => {
    t.context.botmaster.server.close(resolve);
  });
});

test('receiving an update should emit an error event to the bot object when' +
     'update is badly formatted', (t) => {
  t.plan(1);

  const socket = io('ws://localhost:3000');

  return new Promise((resolve) => {
    socket.on('connect', () => {
      socket.send('Hello World!');
    });

    t.context.botmaster.on('error', (bot, err) => {
      t.is(err.message,
           'Expected JSON object but got \'string\' Hello World! instead',
           'Error message is not same as expected');
      socket.disconnect();
      resolve();
    });
  });
});

test('a client should be able to send a message', (t) => {
  t.plan(2);

  const socket = io('ws://localhost:3000');
  const botmaster = t.context.botmaster;

  return new Promise((resolve) => {
    socket.on('connect', () => {
      socket.send({
        message: {
          text: 'Hello World!',
        },
      });
    });

    botmaster.use({
      type: 'incoming',
      controller: (bot, update) => {
        t.is(update.recipient.id, 'botId');
        return bot.reply(update, update.message.text)

        .catch((err) => {
          t.fail(err.message);
          socket.disconnect();
          resolve();
        });
      },
    });

    botmaster.on('error', (bot, err) => {
      t.fail(err.message);
      socket.disconnect();
      resolve();
    });

    socket.on('message', (message) => {
      t.is(message.message.text, 'Hello World!');
      socket.disconnect();
      resolve();
    });
  });
});

test('a client should be able to set a botmasterUserId and find it' +
     'in the update object', (t) => {
  t.plan(2);

  const socket = io('ws://localhost:3000?botmasterUserId=something');

  return new Promise((resolve) => {
    socket.on('connect', () => {
      socket.send({ message: {} });
    });

    t.context.botmaster.use({
      type: 'incoming',
      controller: (bot, update) => {
        t.is(update.sender.id, 'something');
        t.context.bot.reply(update, 'Bye');
      },
    });

    socket.on('message', (message) => {
      t.is(message.message.text, 'Bye');
      socket.disconnect();
      resolve();
    });
  });
});

test('two clients with the same botmasterUserId should receive the same ' +
     'answer from botmaster', (t) => {
  t.plan(2);

  const socketOne = io('ws://localhost:3000?botmasterUserId=userId1');
  const socketTwo = io('ws://localhost:3000?botmasterUserId=userId1');
  let connectedClientCount = 0;
  let gotMessageCount = 0;

  return new Promise((resolve) => {
    t.context.botmaster.use({
      type: 'incoming',
      controller: (bot, update) => {
        bot.reply(update, update.message.text);
      },
    });

    const verifyBothReceived = (message) => {
      t.is(message.message.text, 'Hello');

      gotMessageCount += 1;
      if (gotMessageCount === 2) {
        socketOne.disconnect();
        socketTwo.disconnect();
        resolve();
      }
    };

    const trySendMessage = function trySendMessage() {
      connectedClientCount += 1;
      if (connectedClientCount === 2) {
        socketOne.send({
          message: {
            text: 'Hello',
          },
        });
      }
    };

    socketOne.on('message', verifyBothReceived);
    socketTwo.on('message', verifyBothReceived);

    socketOne.on('connect', trySendMessage);
    socketTwo.on('connect', trySendMessage);
  });
});

test('The non-sender of two clients connected with the same ' +
     'botmasterUserId should receive a "own message" event', (t) => {
  t.plan(1);

  const socketOne = io('ws://localhost:3000?botmasterUserId=userId1');
  const socketTwo = io('ws://localhost:3000?botmasterUserId=userId1');
  let connectedClientCount = 0;

  return new Promise((resolve) => {
    const trySendMessage = function trySendMessage() {
      connectedClientCount += 1;
      if (connectedClientCount === 2) {
        socketOne.send({
          message: {
            text: 'Hello',
          },
        });
      }
    };

    socketOne.on('connect', trySendMessage);
    socketTwo.on('connect', trySendMessage);

    socketTwo.on('own message', (msg) => {
      t.is(msg.message.text, 'Hello');
      socketOne.disconnect();
      socketTwo.disconnect();
      resolve();
    });
  });
});

test('Only the remaining connected client of the two clients with the  ' +
     'same botmasterUserId should receive the update after one disconnected', (t) => {
  t.plan(1);

  t.context.botmaster.addBot(t.context.bot);
  const socketOne = io('ws://localhost:3000?botmasterUserId=userId1');
  const socketTwo = io('ws://localhost:3000?botmasterUserId=userId1');
  let connectedClientCount = 0;

  return new Promise((resolve) => {
    const tryDisconnectSocketTwo = function tryDisconnectSocketTwo() {
      connectedClientCount += 1;
      if (connectedClientCount === 2) {
        socketOne.disconnect();
      }
    };

    socketOne.on('connect', tryDisconnectSocketTwo);
    socketTwo.on('connect', tryDisconnectSocketTwo);

    socketOne.on('disconnect', () => {
      socketTwo.send({ message: {} });
    });

    t.context.botmaster.use({
      type: 'incoming',
      controller: (bot, update) => {
        bot.reply(update, 'Sup');
      },
    });

    socketTwo.on('message', (msg) => {
      // timeout to make sure we don't enter socketOne.on('message')
      t.is(msg.message.text, 'Sup');
      setTimeout(() => {
        socketTwo.disconnect();
        resolve();
      }, 70);
    });

    socketOne.on('message', () => {
      t.fail('socketOne should not have received a message');
    });
  });
});

test('developer can route message to other user if wanted without duplication', (t) => {
  t.plan(1);

  const socketOne = io('ws://localhost:3000?botmasterUserId=userId1');
  const socketTwo = io('ws://localhost:3000?botmasterUserId=userId2');
  let connectedClientCount = 0;

  return new Promise((resolve) => {
    const trySendMessage = function trySendMessage() {
      connectedClientCount += 1;
      if (connectedClientCount === 2) {
        socketOne.send({ message: {} });
      }
    };

    socketOne.on('connect', trySendMessage);
    socketTwo.on('connect', trySendMessage);

    t.context.botmaster.use({
      type: 'incoming',
      controller: (bot) => {
        return bot.sendTextMessageTo('Sup', 'userId2');
      },
    });

    socketTwo.on('message', (msg) => {
      // timeout to make sure we don't enter socketOne.on('message')
      t.is(msg.message.text, 'Sup');
      setTimeout(() => {
        socketOne.disconnect();
        socketTwo.disconnect();
        resolve();
      }, 70);
    });

    socketOne.on('message', () => {
      t.fail('socketOne should not have received a message');
    });
  });
});

test('a client sending an attachment should work', (t) => {
  const socket = io('ws://localhost:3000');

  return new Promise((resolve) => {
    socket.on('connect', () => {
      socket.send({
        message: {
          attachments: [attachmentFixtures.audioAttachment()],
        },
      });
    });

    t.context.botmaster.use({
      type: 'incoming',
      controller: (bot, update) => {
        t.deepEqual(update.message.attachments[0],
                    attachmentFixtures.audioAttachment());
        socket.disconnect();
        resolve();
      },
    });
  });
});


