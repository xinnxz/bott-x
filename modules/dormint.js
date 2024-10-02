const { innerLog, setTime, delay, writeLog } = require('./core');

const api = {
  claim: 'https://api.dormint.io/tg/farming/claimed',
  startFarm: 'https://api.dormint.io/tg/farming/start',
  status: 'https://api.dormint.io/tg/farming/status',
  task: 'https://api.dormint.io/tg/quests/list',
  claimTask: 'https://api.dormint.io/tg/quests/start',
};

async function claimedDormint(username, token) {
  const status = await dormintAPI(api.status, token, username);
  if (
    status.farming_left !== 0 &&
    status.farming_status !== 'farming_status_not_started'
  )
    return;

  const claim = await dormintAPI(api.claim, token, username);
  innerLog('claimed Dormint', username, claim.sleepcoin_balance);
  await delay(2, true);
  const start = await dormintAPI(api.startFarm, token, username);
  if (start?.status === 'ok') {
    innerLog('start farming Dormint', username, claim.sleepcoin_balance);
    setTime(username, 'dormint', start.farming_time);
    await delay(1, true);
  }
}

async function dormintAPI(domain, token, username, ignoreTime) {
  try {
    const path = domain.replace('https://api.dormint.io', '');
    const res = await fetch(domain, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authority: 'api.dormint.io',
        method: ' POST',
        path: path,
        scheme: 'https',
      },
      body: JSON.stringify({ auth_token: token, geo: 'VN' }),
    }).then(async (d) => await d.json());
    writeLog({
      project: 'dormint',
      username,
      domain,
      data: res,
    });
    if (res.status_code === 'missing_parameter_error_geo') {
      innerLog('dormint', 'The system is maintenance');
      return { status: 'error' };
    }
    return res;
  } catch (e) {
    writeLog({
      project: 'dormint',
      username,
      domain,
      data: e,
    });
    !ignoreTime && setTime(username, 'dormint', 0);
    return { status: 'error' };
  }
}

async function getDormintTask(token, username) {
  try {
    const task = await dormintAPI(api.task, token, username, true);
    writeLog({
      project: 'dormint',
      username,
      domain: api.task,
      data: task,
    });
    // icon: 'https://cdn.dormint.io/quests/FASTX_36x36.png',
    // name: 'Subscribe to FastX',
    // quest_id: 15,
    // reward: 70,
    // status: 'quest_not_completed',
    // url: 'https://t.me/fastXparking911'
    if (JSON.stringify(task).startsWith('{')) {
      return [];
    }
    return task;
  } catch (e) {
    writeLog({
      project: 'dormint',
      username,
      domain: api.task,
      data: e,
    });
    return [];
  }
}

async function claimDormintTask(tasks, token, username) {
  for await (const task of tasks) {
    try {
      const maxChar = 30;
      let name = `${task.name}`;

      if (name.length > maxChar) name = name.slice(0, maxChar - 5) + '.....';
      if (name.length <= maxChar) {
        const spaceCount = ' '.repeat(maxChar - name.length);
        name = `${name}${spaceCount}`;
      }

      const path = api.claimTask.replace('https://api.dormint.io', '');
      const res = await fetch(api.claimTask, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authority: 'api.dormint.io',
          method: ' POST',
          path: path,
          scheme: 'https',
        },
        body: JSON.stringify({ auth_token: token, quest_id: task.quest_id }),
      }).then(async (d) => await d.json());
      writeLog({
        project: 'dormint',
        username,
        domain: api.claimTask,
        data: res,
      });
      await delay(1, true);

      if (res.status === 'error') {
        innerLog('dormint quest', 'error', res.status_code);
        continue;
      }
      innerLog('dormint quest', name, 'done');
    } catch (e) {
      writeLog({
        project: 'dormint',
        username,
        domain: api.claimTask,
        data: e,
      });
      await delay(1, true);
      innerLog(
        'dormint quest',
        username + ' claimTask ' + task.name + ' error',
        e.message,
      );
    }
  }
}

const public = {
  dormintAPI,
  claimedDormint,
  api,
  getDormintTask,
  claimDormintTask,
};

module.exports = public;
