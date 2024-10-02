const { delay, setTime, innerLog, writeLog } = require("./core");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const headers = {
  Referer: "https://tgapp.matchain.io/",
  Origin: "https://tgapp.matchain.io",
  "Content-Type": "application/json",
  "Sec-Ch-Ua": `"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"`,
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": "Windows",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const token = new Map();

async function loginMatchain(data, state) {
  const domain = "https://tgapp-api.matchain.io/api/tgapp/v1/user/login";

  try {
    const res = await fetch(domain, {
      method: "POST",
      body: JSON.stringify(data),
      headers,
    });

    const d = await res.json();
    

    
    writeLog({
      project: "matchain",
      username: data.username || data.nickname,
      domain: domain,
      data: d,
    });
    if(d.code !== 200){
      return
    }
    if (d.code === 200 && d.data.token) {
      token.set(data.username, d.data.token);
    }


    await checkStatus(data.uid, data.username || data.nickname, state);
  } catch (e) {
    writeLog({
      project: "matchain",
      username: data.username || data.nickname,
      domain: domain,
      data: e,
    });
    console.log('ERROR ____________',e);
  }
}

async function purchase(username, uid) {
  const domain =
    "https://tgapp-api.matchain.io/api/tgapp/v1/daily/task/purchase";
  try {
    const res = await fetch(domain, {
      method: "POST",
      body: JSON.stringify({ uid, type: "daily" }),
      headers: { ...headers, Authorization: token.get(username) },
    });
    await delay(0.3, true);
    const res2 = await fetch(domain, {
      method: "POST",
      body: JSON.stringify({ uid, type: "game" }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const r = await res.json();
    // const r2 = await res2.json();

    writeLog({
      project: "matchain",
      username,
      domain: domain,
      data: r,
    });
    writeLog({
      project: "matchain",
      username,
      domain: domain,
      data: r2,
    });

    innerLog("matchain", username, 'daily ' + r.msg);
    innerLog("matchain", username, 'game ' + r2.msg);
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: domain,
      data: e,
    });
  }
}

async function checkStatus(uid, username, state) {
  const domain = "https://tgapp-api.matchain.io/api/tgapp/v1/point/balance";
  try {
    const res = await fetch(domain, {
      method: "POST",
      body: JSON.stringify({ uid }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const d = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: domain,
      data: d,
    });
    if (d.code === 200 && d.data) {
      innerLog("matchain", username + ":", String(d.data / 1000));
    }

    await checkMining(uid, username, state);
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: domain,
      data: e,
    });
  }
}

async function checkMining(uid, username, state) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/point/reward";
  try {
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ uid }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const d = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: d,
    });
    if (d.code === 200 && d.data) {
      setTime(username, "matchain", d.data.next_claim_timestamp);
      await delay(1, true);
      await purchase(username, uid);

      if (!state) {
        await delay(1, true);
        await getQuest(username);
        await delay(1, true);
        await playGame(username);

        await delay(1, true);
        await playGame(username);
        await delay(1, true);
        await getTask(uid, username);
      }
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function playGame(username) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/game/play";
  try {
    const res = await fetch(api, {
      method: "GET",
      headers: { ...headers, Authorization: token.get(username) },
    });

    const d = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: d,
    });
    if (d.code === 200 && d.data.game_id) {
      innerLog("matchain", username, "start playing game");
      await claimGame(d.data.game_id, username);
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function claimGame(id, username) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/game/claim";
  try {
    const point = Math.floor(Math.random() * (200 - 150 + 1)) + 150;
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ game_id: id, point }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const d = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: d,
    });
    if (d.code === 200 && String(d.data)) {
      innerLog(
        "matchain",
        username,
        `claimed ${point} from game ${id}, ${d.data} game left`
      );
      if (d.data) {
        await delay(1, true);
        await playGame(username);
      }
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function getTask(uid, username) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/point/task/list";
  try {
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ uid }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const d = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: d,
    });
    if (d.code === 200 && Object.keys(d.data).includes("Tasks")) {
      const tg = Object.values(d.data).flat();
      for await (const task of tg) {
        await checkComplete(uid, task.name, task.description, username);
        await delay(1, true);
      }
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function checkComplete(uid, type, desc, username) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/point/task/complete";
  try {
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ uid, type }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const r = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: r,
    });
    if (r.code === 200 && r.data) {
      await claimTask(uid, type, desc, username);
      return;
    }

    innerLog("matchain daily-task", desc, r.data);
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function claimTask(uid, type, desc, username) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/point/task/claim";
  try {
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ uid, type }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const maxChar = 30;
    let name = `${desc}`;

    if (name.length > maxChar) name = name.slice(0, maxChar - 5) + ".....";
    if (name.length <= maxChar) {
      const spaceCount = " ".repeat(maxChar - name.length);
      name = `${name}${spaceCount}`;
    }

    const r = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: r,
    });
    if (r.code === 200) {
      innerLog("matchain daily-task", name, r.data);
    }

    if (r.code === 401) {
      innerLog("matchain daily-task", name, r.err);
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function startFarming(username, uid) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/point/reward/farming";
  try {
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ uid }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const d = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: d,
    });
    if (d.code === 200) {
      innerLog("matchain", username, "start farm");
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function getQuest(username) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/daily/quiz/progress";
  try {
    const res = await fetch(api, {
      method: "GET",
      headers: { ...headers, Authorization: token.get(username) },
    });

    const r = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: r,
    });
    if (r.code === 200 && r.data) {
      const answers = r.data.map((i) => {
        const items = i.items;
        const correct = items.find((i) => i.is_correct === true);
        const selected_item = correct;
        return {
          quiz_id: i.Id,
          selected_item: selected_item.number,
          correct_item: correct.number,
        };
      });
      await submitQuest(answers, username);
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function submitQuest(answer_result, username) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/daily/quiz/submit";
  try {
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ answer_result }),
      headers: { ...headers, Authorization: token.get(username) },
    });

    const r = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: r,
    });
    if (r.code === 200 && r.msg === "OK") {
      innerLog("matchain", username, "submited quest");
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

async function startClaim(username, uid) {
  const api = "https://tgapp-api.matchain.io/api/tgapp/v1/point/reward/claim";
  try {
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ uid }),
      headers: { ...headers, Authorization: token.get(username) },
    });
    const r = await res.json();
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: r,
    });
    if (r.code === 200 && r.data) {
      innerLog("matchain", username, "claimed " + r.data);
    }
  } catch (e) {
    writeLog({
      project: "matchain",
      username,
      domain: api,
      data: e,
    });
  }
}

const lol = { loginMatchain, startFarming, startClaim };

module.exports = lol;
