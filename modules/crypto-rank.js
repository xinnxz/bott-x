const { innerLog, setTime, delay, writeLog } = require("./core");
const urlStartFarm = "https://api.cryptorank.io/v0/tma/account/end-farming";
const urlEndFarm = "https://api.cryptorank.io/v0/tma/account/start-farming";

async function getTimeFarmStart(username, token) {
  try {
    const response = await fetch("https://api.cryptorank.io/v0/tma/account", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        authority: "api.cryptorank.io",
        method: "POST",
        path: "/v0/tma/account/start-farming",
        scheme: "https",
      },
    });

    const data = await response.json();

    innerLog("crypto-rank", username, data.balance);
    writeLog({
      project: "Crypto-rank",
      username,
      domain: "https://api.cryptorank.io/v0/tma/account",
      data,
    });

    if (!data?.farming?.timestamp) {
      setTime(username, "crypto-rank", 0);
      return;
    }

    if (data?.farming.state === "END") {
      setTime(username, "crypto-rank", 0);
      return;
    }

    setTime(
      username,
      "crypto-rank",
      data?.farming?.timestamp + 60 * 60 * 6 * 1000
    );
  } catch (error) {

    console.log('error _____',error);
    
    writeLog({
      project: "Crypto-rank",
      username,
      domain: "https://api.cryptorank.io/v0/tma/account",
      data: error,
    });
    setTime(username, "crypto-rank", 0);
    innerLog("crypto-rank", "error check status", username);
    return;
  }
}

async function farm(isStart = true, username, token) {
  innerLog("crypto-rank", username, isStart ? "CLAIM" : "FARM...");
  try {
    const response = await fetch(isStart ? urlStartFarm : urlEndFarm, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        authority: "api.cryptorank.io",
        method: "POST",
        path: "/v0/tma/account/start-farming",
        scheme: "https",
      },
    });

    const data = await response.json();
    writeLog({
      project: "Crypto-rank",
      username,
      domain: isStart ? urlStartFarm : urlEndFarm,
      data: data,
    });
    if (data?.farming?.state === "START") {
      innerLog("crypto-rank", username, "FARMing.... " + data?.balance);
    }

    if (data?.farming?.state === "END") {
      innerLog("crypto-rank", username, `CLAIM DONE: ${data?.balance}`);
    }

    if (data?.farming?.timestamp) {
      setTime(
        username,
        "crypto-rank",
        data.farming.timestamp + 60 * 60 * 6 * 1000
      );
    }
  } catch (error) {
    writeLog({
      project: "Crypto-rank",
      username,
      domain: isStart ? urlStartFarm : urlEndFarm,
      data: error,
    });
    setTime(username, "crypto-rank", 0);
    console.log(error);
  }
}

async function getTask(username, token) {
  try {
    const response = await fetch(
      "https://api.cryptorank.io/v0/tma/account/tasks",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
          authority: "api.cryptorank.io",
          method: "POST",
          path: "/v0/tma/account/tasks",
          scheme: "https",
        },
      }
    );

    const data = await response.json();
    writeLog({
      project: "Crypto-rank",
      username,
      domain: "https://api.cryptorank.io/v0/tma/account/tasks",
      data: data,
    });
    return data;
  } catch (e) {
    writeLog({
      project: "Crypto-rank",
      username,
      domain: "https://api.cryptorank.io/v0/tma/account/tasks",
      data: e,
    });
    innerLog("crypto-rank quest", username + " getTask error", e.message);
    return [];
  }
}

async function claimTask(tasks, token, username) {
  for await (const task of tasks) {
    try {
      const response = await fetch(
        "https://api.cryptorank.io/v0/tma/account/claim/task/" + task.id,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
            authority: "api.cryptorank.io",
            method: "POST",
            path: "/v0/tma/account/claim/task/" + task.id,
            scheme: "https",
          },
        }
      );
      const data = await response.json();
      writeLog({
        project: "Crypto-rank",
        username,
        domain:
          "https://api.cryptorank.io/v0/tma/account/claim/task/" + task.id,
        data: data,
      });
      const maxChar = 25;
      let name = `${task.name}`;

      if (name.length > maxChar) name = name.slice(0, maxChar) + ".....";
      if (name.length <= maxChar) {
        const spaceCount = " ".repeat(maxChar - name.length);
        name = `${name}${spaceCount}`;
      }

      await delay(1, true);

      if ([400, 409].includes(data.statusCode)) {
        innerLog("crypto-rank quest", name, data.massage);
        continue;
      }

      if (data.balance) {
        innerLog("crypto-rank quest", name, "done");
      }
      // {"balance":1300,"farming":{"state":"START","timestamp":1721398307058}}
    } catch (e) {
      writeLog({
        project: "Crypto-rank",
        username,
        domain:
          "https://api.cryptorank.io/v0/tma/account/claim/task/" + task.id,
        data: e,
      });
      await delay(1, true);
      innerLog(
        "crypto-rank quest",
        username + " claimTask " + task.name + " error",
        e.message
      );
    }
  }
}

const public = { getTimeFarmStart, farm, claimTask, getTask };
module.exports = public;
