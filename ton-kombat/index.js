const { delay } = require('../modules/core');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const { parse } = require('querystring');
const readline = require('readline');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const HOUSE = {
  0: 'Hamster',
  1: 'Tapswap',
  2: 'Notcoin',
  3: 'Yescoin',
  4: 'Blum',
  5: 'Catizen',
  6: 'SEED',
  7: 'Dogs',
};
const DEFAULT_HOUSE = 5;

const headers = {
  authority: 'liyue.tonkombat.com',
  Origin: 'https://liyue.tonkombat.com',
  Referer: 'https://liyue.tonkombat.com/',
  'Content-Type': 'application/json',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': 'Windows',
  'Sec-Fetch-Dest': ' empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
};
const mapAuth = new Map();
const timeClaim = new Map();

// --------------COMMON--------------------

async function getHeader(username, customHeader) {
  const data = await getDataMapAuth(username);
  return {
    ...headers,
    Authorization: 'tma ' + data?.query_id,
    ...customHeader,
  };
}
const formatNumber = (point = 0) => {
  return new Intl.NumberFormat('us-US').format(point);
};
async function setDataMapAuth(username, data) {
  mapAuth.set(username, data);
}
async function setDataMapTime(username, data) {
  timeClaim.set(username, data);
}

const formatBalance = (number) => {
  return ((number || 0) / 1000000000).toFixed(6);
};

function getDataMapTime(username) {
  return timeClaim.set(username, data);
}
async function getDataMapAuth(username) {
  return mapAuth.get(username);
}
function errors(username, message) {
  console.log(colors.red(`[ Error ]`), colors.red(message));
}
function logs(username, message, other) {
  console.log(
    colors.magenta(`[ ${username} ]`),
    colors.green(message),
    other ? other : '',
  );
}
function toLocalTime(time, addHour) {
  return dayjs(time)
    .add(addHour ? addHour : 0, 'hour')
    .tz('Asia/Ho_Chi_Minh')
    .format('DD/MM/YYYY HH:mm');
}

const unixToDateTime = (time) => {
  return dayjs.unix(time).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm');
};

const toUnix = (dateTimeStr) => {
  // Parse the date and time string
  const [day, month, year, hour, minute] = dateTimeStr
    .match(/\d+/g)
    .map(Number);
  const date = new Date(year, month - 1, day, hour, minute); // Note: Months are 0-based in JavaScript

  // Convert to Unix timestamp (seconds since epoch)
  const timestamp = Math.floor(date.getTime() / 1000);

  return timestamp;
};

// --------------ACTION--------------------
async function processAccount(username) {
  console.log();
  console.log(
    '-------- Account : ',
    colors.green(username),
    ' running --------',
  );

  await getInfomation(username, {
    showAll: true,
  });
  await getBalance(username);
  const current_energy = await getEnergy(username);
  await claim(username);
  await daily(username);
  await questProgresses(username);
  await attach(username, current_energy);
}

const changeHouse = async (username, idHouse = DEFAULT_HOUSE) => {
  const url = 'https://liyue.tonkombat.com/api/v1/combats/house';
  const header = await getHeader(username, {
    path: `/api/v1/combats/house`,
  });
  const res = await fetch(url, {
    method: 'PATCH',
    headers: header,
    body: JSON.stringify({
      house_id: idHouse,
    }),
  });
  const response = await res.json();
  const { data } = response;
  if (!data) {
    errors(username, 'Lỗi chuyển House !');
    return;
  } else {
    logs(username, 'Chuyển House thành công !');
    await getInfomation(username, {
      showHouse: true,
    });
  }
};

const findMatch = async (username) => {
  const url = 'https://liyue.tonkombat.com/api/v1/combats/find';
  const header = await getHeader(username, {
    path: `/api/v1/combats/find`,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: header,
  });
  const response = await res.json();
  const { data } = response;
  if (!data) {
    errors(username, 'Không có thằng ngu nào đủ tầm để solo !');
    return;
  }
  const { house_id, username: usernameByYoung } = data;
  logs(
    username,
    `Thằng ngu này tên là ${colors.yellow(
      usernameByYoung,
    )}, nhà ở ${colors.yellow(HOUSE[house_id])}`,
  );
  return usernameByYoung;
};

const fightMatch = async (username) => {
  const url = 'https://liyue.tonkombat.com/api/v1/combats/fight';
  const header = await getHeader(username, {
    path: `/api/v1/combats/fight`,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: header,
  });
  const response = await res.json();

  const { data } = response;
  if (!data) {
    errors(username, 'Má đang solo thì bị lỗi !');
    return;
  }
  const {
    rank,
    winner,
    enemy: { username: usernameByYoung },
  } = data;
  if (winner === 'attacker') {
    logs(
      username,
      `Bố mày win rồi nhé thằng nhóc ${colors.yellow(usernameByYoung)} 🤡🤡🤡`,
    );
    logs(username, `Điểm rank tăng lên ${colors.yellow(rank)}`);
  } else {
    logs(
      username,
      `${colors.red(
        `Chấp thằng ngu ${colors.yellow(usernameByYoung)} 1 game win 💩💩💩`,
      )}`,
    );
  }
  return usernameByYoung;
};

const attach = async (username, current_energy) => {
  if (!current_energy) {
    logs(username, '', colors.red('Hết năng lượng !'));
    return;
  }

  let coutAttact = current_energy || 0;
  const deepArray = Array(coutAttact).fill(1);

  for await (const i of deepArray) {
    await delay(2, true);
    const userMatch = await findMatch(username);
    if (!userMatch) continue;
    await delay(2, true);
    await fightMatch(username);
  }

  logs(username, 'Hết năng lượng !');
};

const daily = async (username) => {
  const url = 'https://liyue.tonkombat.com/api/v1/daily';
  const header = await getHeader(username, {
    path: `/api/v1/daily`,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: header,
  });
  const response = await res.json();

  const { data, message } = response;

  if (message && message === 'already claimed for today') {
    logs(username, `Hôm nay điểm danh rồi !`);
    return;
  }

  if (!data) {
    errors(username, 'Không điểm danh được !');
    return;
  }

  const { amount } = data;
  logs(username, `Điểm danh được ${formatBalance(amount)} điểm`);
};

const questProgresses = async (username) => {
  const url = 'https://liyue.tonkombat.com/api/v1/tasks/progresses';
  const header = await getHeader(username, {
    path: `/api/v1/tasks/progresses`,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: header,
  });
  const response = await res.json();
  const { data } = response;
  if (!data) {
    errors(username, 'Không lấy được thông tin nhiệm vụ :)) dit !');
    return;
  }

  const listMisstionUnComplete = data?.filter((e) => !e.task_user);
  if (listMisstionUnComplete.length) {
    logs(
      username,
      `Còn ${listMisstionUnComplete.length} quest chưa làm 🙄 Bắt đầu làm ....`,
    );

    for await (const quest of listMisstionUnComplete) {
      const { id, name, type } = quest;

      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        `[ ${colors.magenta(`${username}`)} ]` +
          colors.yellow(` Quest : ${colors.white(name + ' ' + type)} `) +
          colors.red('Đang làm... '),
      );
      await delay(2, true);
      const isFinish = await claimQuest(username, id);
      readline.cursorTo(process.stdout, 0);
      if (isFinish) {
        process.stdout.write(
          `[ ${colors.magenta(`${username}`)} ]` +
            colors.yellow(` Quest : ${colors.white(name + ' ' + type)} `) +
            colors.green('Done !                  '),
        );
      } else {
        process.stdout.write(
          `[ ${colors.magenta(`${username}`)} ]` +
            colors.yellow(` Quest : ${colors.white(name + ' ' + type)} `) +
            colors.red('Faild !                  '),
        );
      }
      console.log();
    }
  } else {
    logs(username, `Hết quest rồi,còn loz đâu mà nhìn !`);
  }
};

const claimQuest = async (username, id) => {
  const url = 'https://liyue.tonkombat.com/api/v1/tasks/' + id;
  const header = await getHeader(username, {
    path: `/api/v1/tasks/${id}`,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: header,
  });
  const response = await res.json();
  const { data } = response;
  return data;
};

const claim = async (username) => {
  const url = 'https://liyue.tonkombat.com/api/v1/users/claim';
  const header = await getHeader(username, {
    path: `/api/v1/users/claim`,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: header,
  });
  const response = await res.json();
  const { data } = response;

  if (!data) {
    errors(username, 'Lỗi mẹ nó claim rồi ditme, tí tao claim lại cho !');
    return;
  }

  const { amount } = data;
  logs(username, 'Claim được bằng này điểm:', colors.yellow(`${amount}`));
};

const getEnergy = async (username) => {
  const url = 'https://liyue.tonkombat.com/api/v1/combats/energy';
  const header = await getHeader(username, {
    path: `/api/v1/combats/energy`,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: header,
  });
  const response = await res.json();
  const { data } = response;
  if (!data) {
    errors(username, 'Lấy thông tin năng lượng lỗi !');
    return;
  }

  const { current_energy, next_refill } = data;
  logs(username, 'Năng lượng hiện tại:', colors.yellow(`${current_energy}/10`));
  if (current_energy < 10) {
    logs(
      username,
      'Hồi 5 năng lượng lúc:',
      colors.cyan(toLocalTime(next_refill)),
    );
  }
  return current_energy;
};

const getBalance = async (username) => {
  const url = 'https://liyue.tonkombat.com/api/v1/users/balance';
  const header = await getHeader(username, {
    path: `/api/v1/users/balance`,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: header,
  });
  const response = await res.json();
  const { data } = response;

  if (!data) {
    errors(username, 'Lấy thông tin balance lỗi !');
  } else {
    logs(username, 'Balance:', colors.yellow(formatBalance(data)));
  }

  return response?.data;
};

const getUserMe = async (username, isCombats = false) => {
  const urlMe = 'https://liyue.tonkombat.com/api/v1/users/me';
  const urlCombatsMe = 'https://liyue.tonkombat.com/api/v1/combats/me';
  const header = await getHeader(username, {
    path: `/api/v1/${isCombats ? 'combats' : 'users'}/me`,
  });
  const res = await fetch(isCombats ? urlCombatsMe : urlMe, {
    method: 'GET',
    headers: header,
  });
  const response = await res.json();
  if (isCombats && response?.code === 'authentication') {
    errors(username, 'Hết hạn token !');
  }
  return response?.data;
};

const getInfomation = async (username, data) => {
  const [combatsMe, userMe] = await Promise.all([
    getUserMe(username, true),
    getUserMe(username),
  ]);

  const { showAll, showHouse } = data;

  if (userMe) {
    const { last_claim, wallet_address_ton } = userMe;
    logs(username, 'Claim lần cuối lúc:', colors.cyan(toLocalTime(last_claim)));
    logs(username, 'Lần sau claim:', colors.cyan(toLocalTime(last_claim, 1.7)));
    const timeNextClaim = toLocalTime(last_claim, 1.7);
    const timeStamp = toUnix(timeNextClaim);
    await setDataMapTime(username, timeStamp);
    logs(
      username,
      'Wallet address:',
      wallet_address_ton
        ? colors.yellow(wallet_address_ton)
        : colors.red('Chưa bind ví !!! 💀💀💀💀'),
    );
  }

  if (combatsMe) {
    const { house_id, rank } = combatsMe;
    if (!showAll && showHouse) {
      logs(username, 'Current house:', colors.yellow(HOUSE[house_id]));
    } else {
      logs(username, 'Current house:', colors.yellow(HOUSE[house_id]));
      logs(username, 'Current point rank:', colors.yellow(rank));
    }

    if (house_id !== DEFAULT_HOUSE) {
      logs(
        username,
        `Chuyển House sang ${colors.white(HOUSE[DEFAULT_HOUSE])}...`,
      );
      await changeHouse(username, DEFAULT_HOUSE);
    }
  }

  if (!combatsMe) {
    errors(username, 'Lấy thông tin CombatsMe lỗi !');
  }

  if (!userMe) {
    errors(username, 'Lấy thông tin UserMe lỗi !');
  }
};

async function loadProfile() {
  const dataFile = path.join(__dirname, 'data.txt');
  const v = fs
    .readFileSync(dataFile, 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .filter(Boolean);

  if (v.length) {
    for await (let a of v) {
      const data = await extractUserData(a);
      await setDataMapAuth(data?.extUserName, {
        ...data,
        query_id: a,
      });
    }
    console.log(
      colors.green(`Load thành công ${colors.white(v.length)} profile`),
    );
    return v;
  }
  console.log(colors.red('Không tìm thấy thông tin nào trong data.txt'));
  return [];
}

const extractUserData = async (queryId) => {
  const decodedString = decodeURIComponent(queryId);
  const params = new URLSearchParams(decodedString);
  const user = JSON.parse(params.get('user'));
  return {
    extUserId: user.id,
    extUserName: user.username,
  };
};

async function waitWithCountdown(seconds) {
  console.log();
  for (let i = seconds; i >= 0; i--) {
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log('');
}

const getTimeClaimMin = async () => {
  const keyValue = Array.from(timeClaim, ([k, v]) => ({ k, v }));
  const nearest = Math.min(...Object.values(keyValue.map((i) => i.v)));
  const data = keyValue.find((i) => i.v === nearest);
  console.log(
    colors.red(
      `======== Tiếp theo ${colors.green(
        data.k,
      )} thời gian claim : ${colors.cyan(unixToDateTime(nearest))}`,
    ),
  );
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const secondsUntilTarget = nearest - currentTimestamp;
  return secondsUntilTarget;
};

async function eventLoop() {
  for await (const username of mapAuth.keys()) {
    await processAccount(username);
    await delay(1, true);
  }
  const timeClaim = await getTimeClaimMin();
  await waitWithCountdown(timeClaim);
  await eventLoop();
}

(async function main() {
  await loadProfile();
  await delay(1, true);
  await eventLoop();
})();
