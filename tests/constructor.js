import test from 'ava';
import Botmaster from 'botmaster';

import SocketioBot from '../lib';

test('should throw an error when settings does not have an id', (t) => {
  t.plan(1);

  try {
    const bot = new SocketioBot({});
  } catch (err) {
    t.is(err.message, 'bots of type \'socket.io\' are expected to have \'id\' in their settings');
  }
});


test('should throw an error when settings does not have a server', (t) => {
  t.plan(1);

  try {
    const bot = new SocketioBot({ id: 'something' });
  } catch (err) {
    t.is(err.message, 'bots of type \'socket.io\' must be defined with \'server\' in their settings');
  }
});

test('having a receives setting adds it to the bot params', (t) => {
  t.plan(1);

  const botmaster = new Botmaster();

  return new Promise((resolve) => {
    botmaster.on('listening', () => {
      const receives = {
        text: true,
      };
      const bot = new SocketioBot({
        receives,
        id: 'something',
        server: botmaster.server,
      });
      t.is(bot.receives, receives, 'receives setting on bot is not same as one passed');
      botmaster.server.close(resolve);
    });
  });
});

test('passing no receives setting defaults to default receives settings', (t) => {
  t.plan(1);

  const defaultReceivesSettings = {
    text: true,
    attachment: {
      audio: false,
      file: false,
      image: false,
      video: false,
      location: false,
      fallback: false,
    },
    echo: false,
    read: false,
    postback: false,
    quickReply: false,
  };
  const botmaster = new Botmaster();

  return new Promise((resolve) => {
    botmaster.on('listening', () => {
      const bot = new SocketioBot({
        id: 'something',
        server: botmaster.server,
      });
      t.deepEqual(bot.receives, defaultReceivesSettings, 'receives setting on bot is same as expected default');
      botmaster.server.close(resolve);
    });
  });
});

test('having a sends setting adds it to the bot params', (t) => {
  t.plan(1);

  const botmaster = new Botmaster();

  return new Promise((resolve) => {
    botmaster.on('listening', () => {
      const sends = {
        text: true,
      };
      const bot = new SocketioBot({
        sends,
        id: 'something',
        server: botmaster.server,
      });
      t.is(bot.sends, sends, 'sends setting on bot is not same as one passed');
      botmaster.server.close(resolve);
    });
  });
});

test('passing no sends setting defaults to default sends settings', (t) => {
  t.plan(1);

  const defaultSendsSettings = {
    text: true,
    quickReply: false,
    locationQuickReply: false,
    senderAction: {
      typingOn: false,
      typingOff: false,
      markSeen: false,
    },
    attachment: {
      audio: false,
      file: false,
      image: false,
      video: false,
    },
  };
  const botmaster = new Botmaster();

  return new Promise((resolve) => {
    botmaster.on('listening', () => {
      const bot = new SocketioBot({
        id: 'something',
        server: botmaster.server,
      });
      t.deepEqual(bot.sends, defaultSendsSettings, 'sends setting on bot is same as expected default');
      botmaster.server.close(resolve);
    });
  });
});
