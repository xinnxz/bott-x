const { innerLog, setTime, delay, writeLog } = require('./core');

const urlCheckTime = 'https://cms-api.nomis.cc/api/users/farm-data?user_id=';
const urlStart = 'https://cms-tg.nomis.cc/api/ton-twa-users/start-farm';
const urlClaim = 'https://cms-tg.nomis.cc/api/ton-twa-users/claim-farm';
const urlAuth = 'https://cms-tg.nomis.cc/api/ton-twa-users/auth/';

function getHeader(query, token) {
  return {
    'x-app-init-data': query,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
    'sec-fetch-site': 'same-site',
    origin: 'https://telegram.nomis.cc',
    referer: 'https://telegram.nomis.cc/',
    'sec-fetch-mode': 'cors',
    'sec-ch-ua-platform': 'Windows',
    'sec-fetch-dest': 'empty',
    authorization: 'Bearer ' + token,
    'sec-ch-ua': `"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127", "Microsoft Edge WebView2";v="127"`,
    'sec-ch-ua-mobile': '?0',
    path: '/api/ton-twa-users/auth/',
    authority: 'cms-tg.nomis.cc',
    scheme: 'https',
    pragma: 'no-cache',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'accept-language': 'en-US,en;q=0.9',
  };
}

const nomisId = new Map();

function formatPoint(point) {
  const convert = (Number(point) / 1000).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return convert;
}

async function checkAuthNomis(data) {
  try {
    const response = await fetch(urlAuth, {
      method: 'POST',
      headers: getHeader(data.query_id, data.token),
      body: JSON.stringify({
        referrer: data.referrer,
        telegram_user_id: data.telegramId,
        telegram_username: data.username,
      }),
    });

    const res = await response.json();
    if(!res?.telegramUsername) return
    res?.id && nomisId.set(data.username, res?.id);
    return res?.telegramUsername
  } catch (error) {
    innerLog('nomis', error.message);
  }
}

async function claimNomis(data) {
  const id = nomisId.get(data.username);
  try {
    const response = await fetch(urlClaim, {
      method: 'POST',
      headers: getHeader(data.query_id, data.token),
      body: JSON.stringify({
        user_id: id,
      }),
    });

    const res = await response.json();
    if (res.status === 404) {
      innerLog('nomis', data.username, res.message);
    }

    writeLog({
      project: 'nomis',
      username: data.username,
      domain: urlClaim,
      data: res,
    });

    if (res?.telegramUsername) {
      // logs(`Claim success : [ ${data?.telegramUsername} ]`);
      innerLog('nomis', data.username, 'claimed success');
    }
  } catch (error) {
    innerLog('ERROR API nomis', error.message);
    setTime(data.username, 'nomis', 0);
  }
}

async function farmNomis(data) {
  const id = nomisId.get(data.username);

  try {
    const response = await fetch(urlStart, {
      method: 'POST',
      headers: getHeader(data.query_id, data.token),
      body: JSON.stringify({
        user_id: id,
      }),
    });

    const res = await response.json();
    if (res?.telegramUsername) {
      innerLog('nomis', data.username, 'start farming....');
      const next = 8 * 60 * 60;
      setTime(data.username, 'nomis', Date.now() + next);
    }

    return res;
  } catch (error) {
    innerLog('nomis', error.message);
    setTime(data.username, 'nomis', 0);
  }
}

async function getTimeToClaim(data) {
  const id = nomisId.get(data.username);
  try {
    const response = await fetch(urlCheckTime + id, {
      method: 'GET',
      headers: getHeader(data.query_id, data.token),
    });

    const res = await response.json();
    innerLog(
      'nomis',
      data.username + ':',
      String(formatPoint(res.points || 0)),
    );

    if (!res?.nextFarmClaimAt) {
      innerLog('nomis', res?.error?.message);
      return;
    }

    writeLog({
      project: 'nomis',
      username: data.username,
      domain: urlCheckTime,
      data: res,
    });

    // await doTask(data);

    return res?.nextFarmClaimAt || 0;
  } catch (error) {
    innerLog('nomis', error.message);
  }
}

function getTimeDifference(timestamp) {
  const currentTime = Date.now();
  const timeDifference = timestamp - currentTime;
  const differenceInMinutes = timeDifference / (1000 * 60);
  return Math.floor(differenceInMinutes).toFixed(0);
}

async function doTask(data) {
  const id = nomisId.get(data.username);
  const domain =
    'https://cms-tg.nomis.cc/api/ton-twa-tasks/by-groups?user_id=' + id;
  try {
    const response = await fetch(domain, {
      method: 'GET',
      headers: getHeader(data.query_id, data.token),
    });

    const res = await response.json();
    if (res.length) {
      for await (const task of res.map((i) => i.ton_twa_tasks).flat()) {
        await delay(0.3, true);
        await doneTask(data, task);
      }
    }

    return res?.nextFarmClaimAt || 0;
  } catch (error) {
    innerLog('nomis', id, error.message);
  }
}

async function doneTask(data, task) {
  const id = nomisId.get(data.username);
  const domain = 'https://cms-tg.nomis.cc/api/ton-twa-user-tasks/verify';
  try {
    const response = await fetch(domain, {
      method: 'POST',
      body: JSON.stringify({ user_id: id, task_id: task.id }),
      headers: getHeader(data.query_id, data.token),
    });

    const res = await response.json();
    if (res?.data?.result) {
      innerLog('nomis', data.username, task.description + ' done ');
      return;
    }
    innerLog('nomis', data.username, task.description + ' failed ');
  } catch (error) {
    innerLog('nomis', error.message);
  }
}

const object = {
  checkAuthNomis,
  claimNomis,
  farmNomis,
  getTimeToClaim,
  getTimeDifference,
};

module.exports = object;
