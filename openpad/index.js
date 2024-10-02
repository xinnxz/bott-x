const { delay } = require('../modules/core');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const { parse } = require('querystring');
const readline = require('readline');
const dayjs = require('dayjs');
const NUMBER_MAX_REPEAT_TAPPING_AGAIN = 10;
const NUMBER_MAX_REPEAT_LOGIN_AGAIN = 5;
let NUMBER_MAX_REPEAT_CHECK_AUTH = NUMBER_MAX_REPEAT_LOGIN_AGAIN;
const UPGRADE_MINNER_STORAGE_LEVEL = 5;
const headers = {
  authority: 'api-miniapp.openpad.io',
  'Content-Type': 'application/json',
  Host: 'https://miniapp.openpad.io',
  Origin: 'https://miniapp.openpad.io',
  Referer: 'https://miniapp.openpad.io/',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': 'Windows',
  'Sec-Fetch-Dest': ' empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
};
const rPath = (p) => path.join(__dirname, p);
const mapAuth = new Map();
async function getHeader(username, customHeader) {
  if (!username)
    return {
      ...headers,
      ...customHeader,
    };
  const data = await getDataMapAuth(username);
  return {
    ...headers,
    Authorization: 'Bearer ' + data?.token,
    ...customHeader,
  };
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
function logs(username, message, other) {
  console.log(
    colors.magenta(`[ ${username} ]`),
    colors.green(message),
    other ? other : '',
  );
}
function toLocalTime(time) {
  const date = new Date(time * 1000); // Convert to milliseconds
  const localTime = date.toLocaleString(); // Convert to local time string
  return dayjs(localTime).format('DD/MM/YYYY hh:mm');
}

async function processAccount(username) {
  console.log();
  console.log(
    '-------- Account : ',
    colors.green(username),
    ' running --------',
  );
  const isAuth = await login(username);
  if(!isAuth) return
  await getStatus(username);
  await checkTaperDay(username);
  await farming(username);
  await doQuest(username);
}

const updateMinner = async (username, type) => {
  const user = await getDataMapAuth(username);
  const headers = await getHeader(username, {
    path: '/api/auth/sign-in',
  });
  const res = await fetch(
    'https://api-miniapp.openpad.io/api/farmings/upgrade',
    {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        userId: +user?.userId,
        type: type,
      }),
    },
  );
  const response = await res.json();

  if (!response || response?.message !== 'Success') {
    errors(username, `Update ${type} thất bại !!`);
    return;
  }
  const {
    minerLevel,
    storageLevel,
    userBalance,
    minerUpgrade,
    storageUpgrade,
  } = response?.data;

  logs(
    username,
    `Update ${type} thành công !`,
    colors.yellow(type === 'STORAGE' ? storageLevel : minerLevel),
  );

  let levelCheck = type === 'STORAGE' ? storageLevel : minerLevel;
  let balanceCheck = type === 'STORAGE' ? storageUpgrade : minerUpgrade;

  if (balanceCheck > userBalance) {
    errors(username, 'Hết mẹ kim cương rồi còn đâu mà nâng cấp !!!');
    return;
  }

  if (levelCheck < UPGRADE_MINNER_STORAGE_LEVEL) {
    logs(
      username,
      '--',
      colors.magenta(`Tiếp tục update ${type} lên level ${++levelCheck}`),
    );
    await updateMinner(username, type);
  }
};

const login = async (username) => {
  try {
    const user = await getDataMapAuth(username);
    const headers = await getHeader(null, {
      path: '/api/auth/sign-in',
    });

    const res = await fetch('https://api-miniapp.openpad.io/api/auth/sign-in', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        userId: +user?.userId,
      }),
    });

    const response = await res.json();
    const { access_token } = response;
    if (access_token) {
      NUMBER_MAX_REPEAT_CHECK_AUTH = NUMBER_MAX_REPEAT_LOGIN_AGAIN;
      logs(username, '', colors.yellow('Login thành công !'));
      await setDataMapAuth(username, {
        ...user,
        token: access_token,
      });
      return true
      // await checkTaperDay(username);
    } else {
      errors(username, 'Login thất bại !');
      if (NUMBER_MAX_REPEAT_CHECK_AUTH) {
        --NUMBER_MAX_REPEAT_CHECK_AUTH;
        logs(username, '', colors.yellow(`Đang login lại lần thứ ${NUMBER_MAX_REPEAT_LOGIN_AGAIN - NUMBER_MAX_REPEAT_CHECK_AUTH} !!`));
        await delay(5);
        await login(username);
      } else {
        errors('','Không kết nối được tới server !!!!');
      }
    }
  } catch (error) {
    errors(username, 'Login thất bại !');
    if (NUMBER_MAX_REPEAT_CHECK_AUTH) {
      --NUMBER_MAX_REPEAT_CHECK_AUTH;
      logs(username, '', colors.yellow(`Đang login lại lần thứ ${NUMBER_MAX_REPEAT_LOGIN_AGAIN - NUMBER_MAX_REPEAT_CHECK_AUTH} !!`));
      await delay(5);
      await login(username);
    } else {
      errors('','Không kết nối được tới server !!!!');
    }
  }
};

const getStatus = async (username) => {
  try {
    const user = await getDataMapAuth(username);
    const headers = await getHeader(username);
    const url = `https://api-miniapp.openpad.io/api/member-reward/${user?.userId}/status`;
    const res = await fetch(url, {
      method: 'GET',
      headers: headers,
    });
    const response = await res.json();
    const {
      data: { claimable },
      status,
      message,
    } = response;

    if (!status) {
      errors(username, message);
      return;
    }
    if (claimable) {
      logs(username, 'Reward từ bạn bè sẵn sàng claim !', colors.yellow('YES'));
    } else {
      logs(username, 'Reward từ bạn bè chưa thể claim !', colors.red('NO'));
    }
  } catch (error) {
    errors(username, error);
  }
};

const farming = async (username) => {
  try {
    const user = await getDataMapAuth(username);
    const headers = await getHeader(username, {
      path: '/api/farmings',
    });

    const res = await fetch('https://api-miniapp.openpad.io/api/farmings', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        userId: +user?.userId,
      }),
    });
    const response = await res.json();
    if (!response?.status) {
      errors(username, response?.message);
    } else {
      const {
        reward,
        session: { end },
        userBalance,
      } = response?.data;
      logs(username, 'Farming thành công', colors.yellow(reward.toFixed(5)));
      logs(username, 'Balance ', colors.yellow(userBalance.toFixed(5)));
      logs(
        username,
        'Thời gian claim tiếp theo',
        colors.yellow(toLocalTime(end)),
      );
    }

    return;
  } catch (error) {
    errors(username, error);
  }
};

const checkTaperDay = async (username) => {
  try {
    let coutCheckAgain = 0;
    const { userId } = await getDataMapAuth(username);
    const headers = await getHeader(username, {
      path: '/api/farmings/' + userId,
    });
    const res = await fetch(
      'https://api-miniapp.openpad.io/api/farmings/' + userId,
      {
        method: 'GET',
        headers: headers,
      },
    );
    const response = await res.json();
    if (!response?.status) {
      errors(username, response?.message);
      if (response?.statusCode === 401) {
        if (coutCheckAgain >= NUMBER_MAX_REPEAT_CHECK_AUTH) {
          errors(username, 'Đăng nhập không thành công !');
          return;
        }
        ++coutCheckAgain;
        logs(
          username,
          'Đang đăng nhập lại ...',
          colors.white(`Call lần ${coutCheckAgain}`),
        );
        await login(username);
      }
    } else {
      const {
        tapClaimed,
        maxNumberTapPerDay,
        checkNewsStatus,
        minerLevel,
        minerAmount,
        minerUpgrade,
        storageLevel,
        storageAmount,
        storageUpgrade,
        userBalance,
      } = response?.data;

      logs(
        username,
        'Hôm nay đã tap ',
        colors.yellow(`${tapClaimed}/${maxNumberTapPerDay}`),
      );
      if (!checkNewsStatus) {
        await checkNew(username);
      }
      logs(username, 'Miner Level: ', colors.yellow(minerLevel));
      logs(username, 'Miner Amount: ', colors.yellow(minerAmount));
      logs(username, 'Miner Upgrade: ', colors.yellow(minerUpgrade));
      logs(username, 'Storage Level: ', colors.yellow(storageLevel));
      logs(username, 'Storage Amount: ', colors.yellow(storageAmount));
      logs(username, 'Storage Upgrade: ', colors.yellow(storageUpgrade));
      logs(username, 'Kim cương - Balance: ', colors.cyan(userBalance));

      let numberUnTaperDay = maxNumberTapPerDay - tapClaimed;
      let numberReTappingAgain = NUMBER_MAX_REPEAT_TAPPING_AGAIN;

      if (
        storageUpgrade < userBalance &&
        storageLevel < UPGRADE_MINNER_STORAGE_LEVEL
      ) {
        await updateMinner(username, 'STORAGE');
      }

      if (
        minerUpgrade < userBalance &&
        minerLevel < UPGRADE_MINNER_STORAGE_LEVEL
      ) {
        await updateMinner(username, 'MINER');
      }

      if (!numberUnTaperDay) return;

      do {
        if (!numberReTappingAgain) return;
        const hasTap = await tapping(username);
        if (!!hasTap) {
          --numberUnTaperDay;
          numberReTappingAgain = NUMBER_MAX_REPEAT_TAPPING_AGAIN;
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(
            `${colors.magenta(`[ ${username} ]`)} ${colors.green(
              'Đang tapping :',
            )} ${colors.white(hasTap)} / ${colors.white(maxNumberTapPerDay)}`,
          );
        } else {
          --numberReTappingAgain;
          readline.cursorTo(process.stdout, 1);
          process.stdout.write(
            `${colors.magenta(`[ ${username} ]`)} ${colors.red(
              `Đang kết nối lại tapping... còn ${numberReTappingAgain} lần !`,
            )}`,
          );
          console.log();
        }
        await delay(1, true);
      } while (numberReTappingAgain && numberUnTaperDay > 2);
      console.log();
      return;
    }
  } catch (error) {
    errors(username, error);
  }
};

const checkNew = async (username) => {
  const url = 'https://api-miniapp.openpad.io/api/farmings/checknews';
  const user = await getDataMapAuth(username);
  const headers = await getHeader(username, {
    path: '/api/farmings/checknews',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      userId: +user?.userId,
    }),
  });
  const response = await res.json();
  const { isEnable } = response;

  if (isEnable) {
    logs(username, 'Check New success ');
  } else {
    errors(username, 'Check New Faild !');
  }
};

const tapping = async (username) => {
  try {
    const user = await getDataMapAuth(username);
    const headers = await getHeader(username, {
      path: '/api/tap-to-earn',
    });
    const res = await fetch('https://api-miniapp.openpad.io/api/tap-to-earn', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        userId: +user?.userId,
      }),
    });
    const response = await res.json();
    if (!response || !response?.status) {
      errors(username, response?.message);
      await delay(7);
      await login(username);
      return 0;
    } else {
      const { currentTap } = response?.data;
      return currentTap;
    }
  } catch (error) {
    return 0;
  }
};

const doQuest = async (username) => {
  try {
    const { userId } = await getDataMapAuth(username);
    const headers = await getHeader(username, {
      path: '/api/quest/' + userId,
    });
    const res = await fetch(
      'https://api-miniapp.openpad.io/api/quest/' + userId,
      {
        method: 'GET',
        headers: headers,
      },
    );
    const response = await res.json();
    if (!response?.status) {
      errors(username, response?.message);
    } else {
      const { data } = response;
      const listQuestNotKYC = data
        .map((e) => e.quests)
        .flat(1)
        .filter((e) => !['KYC'].includes(e.action) && !e.isDone);
      const findTaskKyc = data.find((e) => e.action === 'KYC' && !isDone);
      logs(
        username,
        'Quest KYC Status : ',
        findTaskKyc?.isDone ? colors.green('DONE') : colors.red('NOT DONE'),
      );

      const questInTele = listQuestNotKYC.filter(
        (e) => e.network === 'TELEGRAM',
      );
      const questOutTele = listQuestNotKYC.filter(
        (e) => e.network !== 'TELEGRAM',
      );

      if (questInTele.length) {
        logs(username, '', colors.red('Còn quest TELEGRAM chưa làm !!!'));
      }

      for await (const quest of questOutTele) {
        const { action, questCmsId, title, network } = quest;

        readline.cursorTo(process.stdout, 0);
        process.stdout.write(
          `[ ${colors.magenta(`${username}`)} ]` +
            colors.yellow(` Quest : ${colors.white(title + ' ' + network)} `) +
            colors.red('Đang làm... '),
        );
        await delay(2, true);
        const isFinish = await claimQuest(username, questCmsId, action);
        readline.cursorTo(process.stdout, 0);
        if (isFinish) {
          process.stdout.write(
            `[ ${colors.magenta(`${username}`)} ]` +
              colors.yellow(
                ` Quest : ${colors.white(title + ' ' + network)} `,
              ) +
              colors.green('Done !                  '),
          );
        } else {
          process.stdout.write(
            `[ ${colors.magenta(`${username}`)} ]` +
              colors.yellow(
                ` Quest : ${colors.white(title + ' ' + network)} `,
              ) +
              colors.red('Faild !                  '),
          );
        }
        console.log();
      }
    }
  } catch (error) {
    errors(username, error);
  }
};

const claimQuest = async (username, questCmsId, actionQuest) => {
  const { userId } = await getDataMapAuth(username);
  const headers = await getHeader(username, {
    path: '/api/quest',
  });
  const res = await fetch('https://api-miniapp.openpad.io/api/quest', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      userId: +userId,
      questCmsId: questCmsId,
      action: actionQuest,
    }),
  });
  const response = await res.json();
  return response?.status;
};

async function loadProfile() {
  const v = JSON.parse(fs.readFileSync(rPath('data.json'), 'utf8') || '[]');
  if (v.length) {
    console.log(
      colors.green(
        `Load thành công ${colors.white(v.length)} profile : [ ${colors.yellow(
          v.map((e) => e.username).join(', '),
        )} ]`,
      ),
    );
    for (let a of v) {
      setDataMapAuth(a.username, a);
    }
    return v;
  }
  console.log(colors.red('Không tìm thấy thông tin nào trong data.json'));
  return [];
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
    NUMBER_MAX_REPEAT_CHECK_AUTH = NUMBER_MAX_REPEAT_LOGIN_AGAIN
    await processAccount(username);
    await delay(1, true);
  }
  const timeWait = 1 * 60 * 60; //1h
  await waitWithCountdown(timeWait);
  await eventLoop();
}

(async function main() {
  await loadProfile();
  await delay(1, true);
  await eventLoop();
})();
