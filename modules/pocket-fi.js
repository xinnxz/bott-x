const { setTime, innerLog, time, delay, writeLog } = require("./core");

const headers = {
  Referer: "https://pocketfi.app/",
  Origin: "https://pocketfi.app",
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

async function checkStatusPocketFi(username, token) {
  const api = "https://gm.pocketfi.org/mining/getUserMining";
  try {
    const res = await fetch(api, {
      method: 'GET',
      headers: { ...headers, Telegramrawdata: token },
    });
    const d = await res.json();
    writeLog({
      project: "pocket-fi",
      username,
      domain: api,
      data: d,
    });

    if (d.userMining) {
      const data = d.userMining;
      innerLog("pocket-fi", username, ":" + data.gotAmount);
      const key = `${username}$${"pocket-fi"}`;
      if (!time.has(key)) {
        const d = data.dttmClaimDeadline;
        const n = Date.now() + 30 * 60 * 1000;
        const t = d < n ? d : n
        setTime(username, "pocket-fi", t);

      }

      // await taskExecuting(username, token);
    }
  } catch (e) {
    writeLog({
      project: "pocket-fi",
      username,
      domain: api,
      data: e,
    });
    setTime(username, "pocket-fi", 0);
    if (JSON.stringify(e).includes("Unexpected token < in JSON")) {
      innerLog("pocket-fi", username, "internal server error");
    }
  }
}

async function claimPocketFi(username, token) {
  const api = "https://gm.pocketfi.org/mining/claimMining";
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: { ...headers, Telegramrawdata: token },
    });

    const d = await res.json();
    writeLog({
      project: "pocket-fi",
      username,
      domain: api,
      data: d,
    });
    if (d.userMining) {
      innerLog("pocket-fi", username, "claim done");
      setTime(username, "pocket-fi", Date.now() + 30 * 60 * 1000);
    }
  } catch (e) {
    writeLog({
      project: "pocket-fi",
      username,
      domain: api,
      data: e,
    });
    setTime(username, "pocket-fi", 0);
    if (JSON.stringify(e).includes("Unexpected token < in JSON")) {
      innerLog("pocket-fi", username, "internal server error");
    }
  }
}

async function taskExecuting(username, token) {
  try {
    const api = "https://gm.pocketfi.org/mining/taskExecuting";
    const res = await fetch(api, {
      method: "GET",
      headers: { ...headers, Telegramrawdata: token },
    });

    const d = await res.json();
    if (d.tasks) {
      const taskList = Object.values(d.tasks)
        .flat()
        .filter((i) => i.code === "dailyReward");

      innerLog("pocket-fi", username, "get quest list");
      for await (const task of taskList) {
        if (task.code === "dailyReward") {
          console.log("Diem danh");
          await activateDailyBoost(username, task.currentDay, token);
          continue;
        }
        await confirmSubscription(username, task.code, token);
      }
    }
  } catch (e) {
    innerLog("pocket-fi", username, "cant get quest list");
  }
}

async function confirmSubscription(username, subscriptionType, token) {
  console.log("activateDailyBoost");
  try {
    const api = "https://gm.pocketfi.org/confirmSubscription";
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ subscriptionType }),
      headers: { ...headers, Telegramrawdata: token },
    });

    const d = await res.json();
    console.log(d);
    if (d.ok) {
      innerLog("pocket-fi", username, "claimed: " + subscriptionType);
    }
    await delay(0.5, true);
  } catch (e) {
    console.log(username, "cant done quest", subscriptionType);
  }
}

async function activateDailyBoost(username, updatedForDay, token) {
  try {
    const api = "https://gm.pocketfi.org/boost/activateDailyBoost";
    const res = await fetch(api, {
      method: "POST",
      body: JSON.stringify({ updatedForDay: updatedForDay + 1 }),
      headers: { ...headers, Telegramrawdata: token },
    });

    const d = await res.json();
    console.log(d);
    if (d.ok) {
      innerLog("pocket-fi", username, "daily boost done: " + updatedForDay);
    }
    await delay(0.5, true);
  } catch (e) {
    console.log(username, "cant done daily boost", subscriptionType);
  }
}

const public = { checkStatusPocketFi, claimPocketFi };

module.exports = public;
