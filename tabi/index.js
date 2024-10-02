const { delay } = require('../modules/core');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const LEVEL_TO_UPDATE = 30;

const headers = {
  authority: 'app.tabibot.com',
  'Content-Type': 'application/json',
  Origin: 'https://app.tabibot.com',
  referer: 'https://app.tabibot.com/',
  Priority: 'u=1, i',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': "Android",
  'Sec-Fetch-Dest': ' empty',
  'Sec-Fetch-Mode': 'cors',
  'scheme':'https',
  'Sec-Fetch-Site': 'same-site',
  'accept':'*/*',
  'accept-encoding':'gzip, deflate, br, zstd',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
};

const mapAuth = new Map();
const timeClaim = new Map();

function getHeader(username, customHeader) {
  if (!username) return { ...headers, ...customHeader };
  const { query_id } = getDataMapAuth(username);
  return { ...headers, rawdata: query_id, ...customHeader };
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

function logs(username, message) {
  console.log(colors.magenta(`[ ${username} ]`), message);
}

async function callApi({ url, method, headers, body }) {
  const res = await fetch(url, {
    method: method,
    headers: headers,
    body: JSON.stringify(body),
  });
  const response = await res.json();
  if (!response) {
    errors('', 'Lỗi call api -' + response?.message);
    return response;
  }
  return response;
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
    const isAuth = await login(username);
    if (!isAuth) return;
    await getInfoMinning(username);
    await doQuest(username);
  } catch (e) {
    errors(extUserName, e);
  }
}

async function login(username) {
  try {
    const response = await callApi({
      url: 'https://app.tabibot.com/api/user/sign-in',
      method: 'POST',
      headers: getHeader(username),
    });

    const {
      user: {
        name,
        level,
        invites,
        coins,
        tabiAddress,
        tonAddress,
        streak,
        checkInDate,
        hasCheckedIn,
      },
    } = response;
    logs(username, colors.reset('Login thành công !'));
    logs(username, colors.green(`Username: ${colors.yellow(name)}`));
    logs(username, colors.green(`Level: ${colors.yellow(level)}`));
    logs(username, colors.green(`Invite: ${colors.yellow(invites)}`));
    logs(
      username,
      colors.green(`Balance: ${colors.yellow(formatNumber(coins))}`),
    );
    logs(username, tabiAddress ?  colors.green(`Tabi address: ${colors.yellow(tabiAddress)}`) : colors.red('Chưa bind ví Tabi !'));
    logs(username, tonAddress ?  colors.green(`Ton address: ${colors.yellow(tonAddress)}`) : colors.red('Chưa bind ví TON !'));
    logs(
      username,
      colors.green(`Số ngày đã checkin liên tục: ${colors.yellow(streak)} 🔥`),
    );
    logs(
      username,
      colors.green(`Ngày checkin gần nhất: ${colors.cyan(checkInDate)}`),
    );
    logs(
      username,
      colors.green(
        hasCheckedIn
          ? colors.yellow('Hôm nay đã điểm danh !')
          : colors.red('Hôm nay chưa điểm danh !'),
      ),
    );

    if (!hasCheckedIn) {
      await checkIn(username);
    }

    let levelCurrent = level;
    if (levelCurrent < LEVEL_TO_UPDATE) {
      logs(
        username,
        colors.green(`Bắt đầu upgrade level lên ${colors.yellow(level)}`),
      );
      do {
        const levelUpgrade = await upgradeLevel(username, levelCurrent);
        levelCurrent = levelUpgrade;
        await delay(2,true);
      } while (levelCurrent < LEVEL_TO_UPDATE);
      logs(username, colors.green(`Upgrade xong !`));
    }
    return true;
  } catch (error) {
    errors(username,'Login thất bại !!')
    return;
  }
}

const getInfoMinning = async (username) => {
  try {
    const response = await callApi({
      url: 'https://app.tabibot.com/api/mining/info',
      method: 'GET',
      headers: getHeader(username),
    });

    const { nextClaimTimeInSecond, current, topLimit } = response;

    if(!nextClaimTimeInSecond){
      await claimMinning(username)
      return
    }

    logs(
      username,
      colors.green(
        `Đang minning: ${colors.yellow(
          `${formatNumber(current)}/${formatNumber(topLimit)}`,
        )}`,
      ),
    );
    logs(
      username,
      colors.green(
        `Còn ${colors.yellow(nextClaimTimeInSecond)}s nữa để claim !`,
      ),
    );

    timeClaim.set(username, nextClaimTimeInSecond);
  } catch (error) {
    errors(username, 'Lấy thông tin minning lỗi !');
  }

};

const claimMinning = async (username) => {
  try {
    const response = await callApi({
      url: 'https://app.tabibot.com/api/mining/claim',
      method: 'POST',
      headers: getHeader(username),
    });

    logs(username,colors.green(`Claim thành công !`))

  } catch (error) {
    errors(username,'Claim thất bại !')
    return;
  }
};

const upgradeLevel = async (username, levelCurrent) => {
  try {
    const response = await callApi({
      url: 'https://app.tabibot.com/api/user/level-up',
      method: 'POST',
      headers: getHeader(username),
    });

    const { level, coins } = response;
    if(levelCurrent === level){
      logs(username,colors.red('Không đủ tabi để nâng cấp level !'))
      return 50
    }
    logs(
      username,
      colors.green(
        `Upgrade thành công lên level ${colors.yellow(
          level,
        )}, còn lại ${colors.cyan(formatNumber(coins))}`,
      ),
    );

    return level;
  } catch (error) {
    return;
  }
};

const checkIn = async (username) => {
  try {
    const response = await callApi({
      url: 'https://app.tabibot.com/api/user/check-in',
      method: 'POST',
      headers: getHeader(username),
    });

    const { coins } = response;
    logs(username, colors.green(`Checkin thành công ! ${coins}`));

  } catch (error) {
    errors(username, 'Checkin thất bại !');
    return;
  }
};

const doQuest = async (username) => {
  try {
    const response = await callApi({
      url: 'https://app.tabibot.com/api/mono/projects',
      method: 'POST',
      headers: getHeader(username),
    });

    const listQuestUnClaim = response?.filter((e) => !e.isClaimed);

    if (listQuestUnClaim.length) {
      logs(
        username,
        colors.green(
          `Bắt đầu làm ${colors.yellow(listQuestUnClaim.length)} nhiệm vụ`,
        ),
      );
    } else {
      logs(username, colors.cyan(`Đã làm hết nhiệm vụ !`));
      return;
    }

    for await (const quest of listQuestUnClaim) {
      const {
        projectEntity: { id, title },
      } = quest;

      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        `[ ${colors.magenta(`${username}`)} ]` +
          colors.yellow(` Quest : ${colors.white(title)} `) +
          colors.red('Đang làm... '),
      );
      await delay(2, true);
      const isFinish = await claimQuest(username, id);
      readline.cursorTo(process.stdout, 0);
      if (isFinish) {
        process.stdout.write(
          `[ ${colors.magenta(`${username}`)} ]` +
            colors.yellow(` Quest : ${colors.white(title)} `) +
            colors.green('Done !                  '),
        );
      } else {
        process.stdout.write(
          `[ ${colors.magenta(`${username}`)} ]` +
            colors.yellow(` Quest : ${colors.white(title)} `) +
            colors.red('Faild !                  '),
        );
      }
      console.log();
    }

    return level;
  } catch (error) {
    return;
  }
};

const claimQuest = async (username, id) => {
  try {
    const response = await callApi({
      url: `https://app.tabibot.com/api/mono/${id}/claim`,
      method: 'POST',
      headers: getHeader(username),
    });

    return response;
  } catch (error) {
    return;
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
      console.log(` Load thành công profile `.green);
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
  const listTime = timeClaim.values()
  const minSecondClaim = Math.min(...Array.from(listTime))
  await waitWithCountdown(minSecondClaim);
  await eventLoop();
}

(async function main() {
  await loadProfile();
  await delay(1, true);
  await eventLoop();
})();
