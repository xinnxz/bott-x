const { delay } = require('../modules/core');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const jwt = require('jsonwebtoken');

const headers = {
  authority: 'api.djdog.io',
  'Content-Type': 'application/json',
  Origin: 'https://djdog.io',
  Priority: 'u=1, i',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': 'Windows',
  'Sec-Fetch-Dest': ' empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'X-App-Id': 'carv',
};


const mapAuth = new Map();
const timeReAuth = new Map();

function getHeader(username, customHeader) {
  if (!username) return { ...headers, ...customHeader };
  const { token } = getDataMapAuth(username);
  return { ...headers, Authorization: token, ...customHeader };
}

const formatNumber = (point = 0) => {
  return new Intl.NumberFormat('us-US').format(point);
};

async function setDataMapAuth(username, data) {
  mapAuth.set(username, data);
}

function getDataMapAuth(username) {
  return mapAuth.get(username);
}

function errors(username, message) {
  console.log(colors.red(`[ Error ]`), colors.red(message));
}

async function processAccount(username) {
  const data = getDataMapAuth(username);
  if (!data) {
    errors('', 'Lỗi lấy data từ authMap ');
    return;
  }
  const { extUserName } = data;
  console.log();
  console.log(
    '-------- Account : ',
    colors.green(extUserName),
    ' running --------',
  );
  try {
    const isAuth = await login(data);
    if (!isAuth) return;
    await checkAvailableAmountTap(extUserName);
    await checkBoxAndLevel(extUserName);
    await updateLevelOrBuyBox(extUserName);
    await checkRanking(extUserName);
    await doQuest(extUserName);
    await dailyCheckin(extUserName)
    // Show again
    await checkAvailableAmountTap(extUserName);
    await checkBoxAndLevel(extUserName);
  } catch (e) {
    errors(extUserName, e);
  }
}

const dailyCheckin = async (username) => {
  const urlCheckAvailabel = 'https://api.djdog.io/check/in/user/list';

  try {
    const res = await fetch(urlCheckAvailabel, {
      method: 'GET',
      headers: getHeader(username, {
        path: '/check/in/user/list',
      }),
    });

    const response = await res.json();
    if(!response) {
      errors(username,'Get task daily lỗi !')
      return
    }
    const { data } = response;
    const listTaskUnFinish = data?.filter((e) => !e.finished)

    if(!listTaskUnFinish.length){
      console.log(
        `[ ${colors.magenta(`${username}`)} ]`,
        colors.yellow(
          `Không còn quest daily nào !`,
        ),
      );
      return
    }

    for await (const task of listTaskUnFinish) {
      const { id } = task;
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        `[ ${colors.magenta(`${username}`)} ]` +
          colors.yellow(` Quest daily id : ${colors.white(id)} `) +
          colors.red('Đang làm... '),
      );
      await delay(2, true);
      const isFinish = await finishQuestDaily(username, id);
      readline.cursorTo(process.stdout, 0);
      if (isFinish) {
        process.stdout.write(
          `[ ${colors.magenta(`${username}`)} ]` +
            colors.yellow(` Quest daily : ${colors.white(id)} `) +
            colors.green('Done !                  '),
        );
      } else {
        process.stdout.write(
          `[ ${colors.magenta(`${username}`)} ]` +
            colors.yellow(` Quest daily : ${colors.white(id)} `) +
            colors.red('Faild !                  '),
        );
      }
      console.log();
    }
  } catch (error) {
    errors(username, error);
  }
};


const finishQuestDaily = async (username, id) => {
  const res = await fetch('https://api.djdog.io/check/in?id=' + id, {
    method: 'POST',
    headers: getHeader(username, {
      path: '/check/in?id=' + id,
    }),
    body:JSON.stringify({
      id:id
    })
  });
  const response = await res.json();
  return response?.returnCode === 200;
};


function extractTimeTokenDie(time) {
  const date = new Date(time * 1000);
  const options = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false };
  const vietnamTime = new Intl.DateTimeFormat('vi-VN', options).format(date);
  return vietnamTime;
}

async function login(data) {
  const { extUserName, query_id } = data;
  const urlAuth = 'https://api.djdog.io/telegram/login?' + query_id;
  try {
    const res = await fetch(urlAuth, {
      method: 'GET',
      headers: getHeader(false, {
        path: '/telegram/login?' + query_id,
      }),
    });

    const response = await res.json();

    if (response?.returnCode === 200) {
      const { refreshToken, accessToken, telegramUsername } = response?.data;
      const token = accessToken?.split(' ')[1]
      const { exp } = jwt.decode(token);

      console.log(
        `[ ${colors.magenta(`${telegramUsername}`)} ]`,
        colors.green(`Login thành công !`),
      );
      console.log(
        `[ ${colors.magenta(`${telegramUsername}`)} ]`,
        colors.green(`Phiên login sẽ hết hạn vào: `,colors.red(extractTimeTokenDie(exp))),
      );
      await setDataMapAuth(extUserName, {
        ...data,
        token: accessToken ? accessToken : refreshToken,
      });
      return true;
    }
    errors('', 'Auth Error !!!!! - Lấy lại query_id ');
  } catch (error) {
    errors('', 'Auth Error !!!!! - Lấy lại query_id ');
  }
}

async function checkAvailableAmountTap(username) {
  const urlCheckAvailabel = 'https://api.djdog.io/pet/barAmount';

  try {
    const res = await fetch(urlCheckAvailabel, {
      method: 'GET',
      headers: getHeader(username, {
        path: '/pet/barAmount',
      }),
    });

    const response = await res.json();
    const { availableAmount, level } = response?.data;
    const abailableAmount = formatNumber(availableAmount);
    const barGoldLimit = formatNumber(response?.data?.barGoldLimit);
    const isClaimAll = level === 50;
    const numberClick = isClaimAll ? 0 : Math.round(availableAmount / level);

    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(
        `Point đang có: ${
          colors.white(abailableAmount) + '/' + colors.white(barGoldLimit)
        }`,
      ),
    );

    if (level < 50 && !numberClick) return;
    await tap(numberClick, username);
  } catch (error) {
    errors(username, error);
  }
}

const boxMallApi = async (username) => {
  const res = await fetch('https://api.djdog.io/pet/boxMall', {
    method: 'GET',
    headers: getHeader(username),
  });
  const response = await res.json();
  return response;
};

const information = async (username) => {
  const res = await fetch('https://api.djdog.io/userCenter/information', {
    method: 'GET',
    headers: getHeader(username, {
      path: '/userCenter/information',
    }),
  });
  const response = await res.json();
  return response;
};

const checkBoxAndLevel = async (username) => {
  try {
    const [response, informationRes] = await Promise.all([
      boxMallApi(username),
      information(username),
    ]);

    if (response?.returnCode !== 200 || informationRes?.returnCode !== 200) {
      errors(username, response?.returnDesc + ' ' + informationRes?.returnDesc);
    }

    const {
      username: userName,
      goldAmount,
      boxAmount,
      levelUpAmount,
    } = response?.data;
    const { hskAmount, level } = informationRes?.data;

    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Username: ${colors.white(userName)}`),
    );
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Level: ${colors.white(level)}`),
    );
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Gold Amount: ${colors.white(formatNumber(goldAmount))}`),
    );
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Box Amount: ${colors.white(boxAmount)}`),
    );
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(
        `Gold cần để up level: ${colors.white(formatNumber(levelUpAmount))}`,
      ),
    );
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(
        `HSK Eligible: ${colors.white(hskAmount)}`,
        colors.yellow('$HSK'),
      ),
    );
  } catch (error) {
    errors(username, error);
  }
};

async function tap(numberClick = 0, username) {
  const url = 'https://api.djdog.io/pet/collect?clicks=';
  try {
    const response = await fetch(url + numberClick, {
      method: 'POST',
      headers: getHeader(username, {
        path: '/pet/collect?clicks=' + numberClick,
      }),
    });

    const data = await response.json();

    if (data?.returnCode === 200) {
      console.log(
        `[ ${colors.magenta(username)} ]`,
        colors.green(
          numberClick === 0
            ? `Click all thành công`
            : `Click thành công : ${colors.white(numberClick || 0) + 'click'}`,
        ),
      );
    } else {
      errors(username, data?.returnDesc);
    }
  } catch (error) {
    errors(username, error);
  }
}

const weeklyComboQuest = async (username) => {
  const res = await fetch('https://api.djdog.io/mission/group', {
    method: 'GET',
    headers: getHeader(username, {
      path: '/mission/group',
    }),
  });
  const response = await res.json();
  if (response?.returnCode !== 200) {
    errors(username, 'Lấy dữ liệu weeklyComboQuest lỗi !');
    return [];
  }
  return response?.data;
};

const walkFindsQuest = async (username) => {
  const res = await fetch('https://api.djdog.io/mission/walkFinds', {
    method: 'GET',
    headers: getHeader(username, {
      path: '/mission/walkFinds',
    }),
  });
  const response = await res.json();
  if (response?.returnCode !== 200) {
    errors(username, 'Lấy dữ liệu walkFindsQuest lỗi !');
    return [];
  }
  return response?.data;
};

const partnersQuest = async (username) => {
  const res = await fetch('https://api.djdog.io/mission/partners', {
    method: 'GET',
    headers: getHeader(username, {
      path: '/mission/partners',
    }),
  });
  const response = await res.json();
  if (response?.returnCode !== 200) {
    errors(username, 'Lấy dữ liệu partnersQuest lỗi !');
    return [];
  }
  return response?.data;
};

const finishQuest = async (username, id) => {
  const res = await fetch('https://api.djdog.io/mission/finish?id=' + id, {
    method: 'POST',
    headers: getHeader(username, {
      path: '/mission/finish?id=' + id,
    }),
  });
  const response = await res.json();
  return response?.returnCode === 200;
};

const doQuest = async (username) => {
  const [weeklyCombo, walkFinds, partners] = await Promise.all([
    weeklyComboQuest(username),
    walkFindsQuest(username),
    partnersQuest(username),
  ]);

  const weeklyComboUnFinish =
    weeklyCombo
      .filter((e) => !e.finished)
      .map((e) => e.missionRows)
      .flat(2)
      .filter((e) => !e.finished) || [];
  const walkFindsUnFinish =
    walkFinds.missionRows.filter((e) => !e.finished) || [];
  const partnersUnFinish =
    partners.missionRows.filter((e) => !e.finished) || [];

  let allQuest = [];
  allQuest = [
    ...weeklyComboUnFinish,
    ...walkFindsUnFinish,
    ...partnersUnFinish,
  ];

  for await (const task of allQuest) {
    const { title, taskId, taskType } = task;
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `[ ${colors.magenta(`${username}`)} ]` +
        colors.yellow(` Quest : ${colors.white(title + ' ' + taskType)} `) +
        colors.red('Đang làm... '),
    );
    await delay(2, true);
    const isFinish = await finishQuest(username, taskId);
    readline.cursorTo(process.stdout, 0);
    if (isFinish) {
      process.stdout.write(
        `[ ${colors.magenta(`${username}`)} ]` +
          colors.yellow(` Quest : ${colors.white(title + ' ' + taskType)} `) +
          colors.green('Done !                  '),
      );
    } else {
      process.stdout.write(
        `[ ${colors.magenta(`${username}`)} ]` +
          colors.yellow(` Quest : ${colors.white(title + ' ' + taskType)} `) +
          colors.red('Faild !                  '),
      );
    }
    console.log();
  }
};

const exchangeBox = async (username) => {
  const res = await fetch('https://api.djdog.io/pet/exchangeBox/0', {
    method: 'POST',
    headers: getHeader(username, {
      path: '/pet/exchangeBox/0',
    }),
  });
  const response = await res.json();
  if (response?.returnCode !== 200) {
    errors(username, response?.returnDesc);
  }
  return response;
};

const upgradeLevel = async (username) => {
  const res = await fetch('https://api.djdog.io/pet/levelUp/0', {
    method: 'POST',
    headers: getHeader(username, {
      path: '/pet/levelUp/0',
    }),
  });
  const response = await res.json();
  if (response?.returnCode !== 200) {
    errors(username, response?.returnDesc);
  }
  return response;
};

const rankByLevel = async (username) => {
  const res = await fetch('https://api.djdog.io/pet/ranking/0', {
    method: 'GET',
    headers: getHeader(username, {
      path: '/pet/ranking/0',
    }),
  });
  const response = await res.json();
  if (response?.returnCode !== 200) {
    errors(username, response?.returnDesc);
  }
  return response?.data?.selfBoard;
};

const rankByBox = async (username) => {
  const res = await fetch('https://api.djdog.io/pet/ranking/1', {
    method: 'GET',
    headers: getHeader(username, {
      path: '/pet/ranking/1',
    }),
  });
  const response = await res.json();
  if (response?.returnCode !== 200) {
    errors(username, response?.returnDesc);
  }
  return response?.data?.selfBoard;
};

const checkRanking = async (username) => {
  const [rankLevel, rankBox] = await Promise.all([
    rankByLevel(username),
    rankByBox(username),
  ]);

  const { rank: rank0 } = rankLevel;
  const { rank: rank1 } = rankBox;

  console.log(
    `[ ${colors.magenta(`${username}`)} ]`,
    colors.green(`Rank by Level: ${colors.white(formatNumber(rank0))}`),
  );
  console.log(
    `[ ${colors.magenta(`${username}`)} ]`,
    colors.green(`Rank by Box: ${colors.white(formatNumber(rank1))}`),
  );
};

const updateLevelOrBuyBox = async (username) => {
  const res = await boxMallApi(username);

  if (res?.returnCode !== 200) {
    errors(username, res?.returnDesc);
    return;
  }
  const { level, boostLimit, boxBuyLimit } = res?.data;

  console.log(
    `[ ${colors.magenta(`${username}`)} ]`,
    colors.cyan(level < 50 ? `Upgrade level` : 'Buy Box'),
  );

  if (level < 50) {
    // update level
    const deepArray = Array(boostLimit).fill(0);
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Có thể update ${colors.white(boostLimit)} level`),
    );
    if (!boostLimit) return;
    for await (const i of deepArray) {
      await upgradeLevel(username);
      delay(2, true);
    }
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Upgrade level thành công !`),
    );
  } else {
    // buy box
    const deepArray = Array(boxBuyLimit).fill(0);
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Box có thể mua:`),
      colors.white(boxBuyLimit),
    );
    if (!boxBuyLimit) return;
    for await (const i of deepArray) {
      await exchangeBox(username);
      delay(2, true);
    }
    console.log(
      `[ ${colors.magenta(`${username}`)} ]`,
      colors.green(`Mua Box thành công !`),
    );
  }
};

function extractUserData(queryId) {
  const decodedString = decodeURIComponent(queryId);
  const params = new URLSearchParams(decodedString);
  const user = JSON.parse(params.get('user'));
  return {
    extUserId: user.id,
    extUserName: user.username,
    queryDecode: decodedString,
    user: user,
    query_id: queryId,
  };
}

async function loadProfile() {
  try {
    const dataFile = path.join(__dirname, 'data.txt');
    const v = fs
      .readFileSync(dataFile, 'utf8')
      .replace(/\r/g, '')
      .split('\n')
      .filter(Boolean);

    if (v.length) {
      for await (let a of v) {
        const data = extractUserData(a);
        const { extUserName } = data;
        if (!extUserName) {
          errors('', 'Lỗi đọc query_id ! Lấy lại query_id ');
          return;
        }
        await setDataMapAuth(extUserName, data);
      }
      console.log(colors.green(`Load thành công profile]`));
      return v;
    }
    console.log(colors.red('Không tìm thấy thông tin nào trong data.txt'));
    return [];
  } catch (e) {
    console.log(colors.red('Không thể load profile: ', e));
  }
}

async function waitWithCountdown(seconds) {
  for (let i = seconds; i >= 0; i--) {
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log('');
}

async function eventLoop() {
  for await (const username of mapAuth.keys()) {
    await processAccount(username);
    await delay(1, true);
  }
  const timeWait = 4 * 60 * 60; //8h
  await waitWithCountdown(timeWait);
  await eventLoop();
}

(async function main() {
  await loadProfile();
  await delay(1, true);
  await eventLoop();
})();
