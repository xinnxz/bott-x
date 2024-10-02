const fs = require("fs");
const path = require("node:path");
const {
  checkAuthNomis,
  claimNomis,
  farmNomis,
  getTimeToClaim,
  getTimeDifference,
} = require("./modules/nomis");
const {
  innerLog,
  delay,
  timestampToUTC,
  setTime,
  milisecondToRemainTime,
  profileSumary,
  profile,
  time,
  state,
  STRING,
} = require("./modules/core");
const {
  claimedDormint,
  api,
  dormintAPI,
  getDormintTask,
  claimDormintTask,
} = require("./modules/dormint");
const {
  farm,
  claimTask,
  getTask,
  getTimeFarmStart,
} = require("./modules/crypto-rank");

const {
  loginMatchain,
  startFarming,
  startClaim,
} = require("./modules/matchain");

const { checkStatusPocketFi, claimPocketFi } = require("./modules/pocket-fi");

const DELAY = 60 * 60; // minute

(async function main() {
  await loadConfig("data.json");
  console.log("");
  profileSumary();
  console.log("");
  await checkWallet();
})();

//#region checkWallet
async function checkWallet() {
  await checkClaimAvaiable();
  showRemainTime();
  const nearest = await getNearestTime();
  if (nearest === null) {
    await delay(5);
    return checkWallet();
  }
  const delayTime = nearest < DELAY ? (nearest < 0 ? 0 : nearest) : DELAY;

  const needClaim = await checkClaimedAvaiable();

  if (!needClaim.length) {
    await delay(delayTime);
    return checkWallet();
  }

  console.log("DELAY BEFORE CLAIM");
  await delay(5);

  for await (const name of needClaim) {
    const [username, project] = name.split("$");
    await toClaimed(username, project);
  }

  await delay(1);
  checkWallet();
}
//#endregion

//#region toClaimed
async function toClaimed(nameInput, projectName) {
  const {
    username: sample,
    token,
    nickname,
  } = getProfile(projectName, nameInput) || {};
  const username = sample || nickname;
  const data = getProfile(projectName, nameInput);
  innerLog("to-claim", username, projectName);
  switch (projectName) {
    case "pocket-fi": {
      await claimPocketFi(username, token);
      break;
    }
    case "matchain": {
      await startClaim(username, data.uid);
      await delay(1, true);
      await startFarming(username, data.uid);
      break;
    }
    case "dormint": {
      await claimedDormint(username, token);
      break;
    }
    case "crypto-rank": {
      await farm(true, username, token);
      await delay(1, true);
      await farm(false, username, token);
      break;
    }
    case "nomis": {
      await claimNomis(data);
      await delay(1, true);
      await farmNomis(data);
      break;
    }
    default: {
      console.log("NO HANDLDER");
    }
  }
}
//#endregion

//#region loadConfig
async function loadConfig(link) {
  return new Promise((res, rej) => {
    fs.readFile(path.resolve(__dirname, link), "utf-8", async (err, data) => {
      if (err) {
        innerLog("main", "load error", err);
        rej(err);
      }

      const d = JSON.parse(data);

      for (const item in d) {
        profile.set(item, d[item]);
      }

      await delay(2, true);
      res(d);
    });
  });
}
//#endregion

//#region showRemainTime
function showRemainTime() {
  const r = [];

  const array = Array.from(time, ([name, value]) => ({ name, value })).sort(
    (a, b) => a.value - b.value
  );

  for (const i of array) {
    const [username, project] = i.name.split("$");
    r.push({ username, project, remain: timestampToUTC(i.value) });
  }
  console.table(r);
}
//#endregion

//#region getProfile
function getProfile(project, username) {
  if (!profile.has(project)) return null;
  const projectData = [...profile.get(project)];
  const prf = projectData.find((i) => i.username === username);
  return prf;
}
//#endregion

//#region checkClaimAvaiable
async function checkClaimAvaiable() {
  for await (const project of profile.keys()) {
    const listAccount = profile.get(project).map((i) => i.username);
    for await (const username of listAccount) {
      await getStatus(project, username);
    }
    console.log("");
  }
  state.set(STRING.dailyMatch, true);
}
//#endregion

//#region getNearestTime
async function getNearestTime() {
  return new Promise((ok) => {
    const keyValue = Array.from(time, ([k, v]) => ({ k, v }));
    if (!keyValue.length) ok(null);
    const nearest = Math.min(...Object.values(keyValue.map((i) => i.v)));
    const zz = keyValue.find((i) => i.v === nearest);
    if (!zz) ok(null);
    const [username, project] = zz.k.split("$");
    const remainTime = nearest - Date.now();
    console.log("");
    innerLog(
      "next claim",
      `${username} ${project} ${
        remainTime <= 0 ? "NOW" : milisecondToRemainTime(remainTime)
      }`,
      remainTime > 0 ? timestampToUTC(nearest) : ""
    );
    console.log("");
    ok(Math.round(remainTime) / 1000);
  });
}
//#endregion

//#region getStatus
async function getStatus(projectName, nameInput) {
  const data = getProfile(projectName, nameInput);
  const { token, username: username1, nickname } = data;
  const username = username1 || nickname;

  switch (projectName) {
    case "pocket-fi": {
      await checkStatusPocketFi(username, token);
      break;
    }
    case "matchain": {
      const isClaimQuest = state.get(STRING.dailyMatch);
      const isAuth = await loginMatchain(data, isClaimQuest);
      if(!isAuth) return
      break;
    }
    case "dormint": {
      if (!state.has(STRING.dailyDormint + username)) {
        console.log(" ");
        const task = await getDormintTask(token, username);
        await claimDormintTask(task, token, username);
        state.set(STRING.dailyDormint + username, true);
      }
      const res = await dormintAPI(api.status, token, username);
      
      if (res.status !== "ok") {
        console.log('dormint auth error', username)
        return
      }; // need retry
      innerLog("dormint", nameInput + ":", String(res.sleepcoin_balance));
      if (res.farming_status === "farming_status_not_started") {
        setTime(username, projectName, 0);
        console.log(" ");
        break;
      }

      if(res.farming_status === 'farming_status_finished'){
        setTime(username, projectName, 0);
        console.log(" ");
        break;
      }

      const claimedTime = Date.now() + Math.ceil(res.farming_left * 1000); // ms
      setTime(username, projectName, claimedTime);

      break;
    }
    case "crypto-rank": {
      if (!state.has(STRING.dailyCryproRank + username)) {
        console.log(" ");
        const task = await getTask(username, token);
        await claimTask(task, token, username);
        state.set(STRING.dailyCryproRank + username, true);
      }
      await getTimeFarmStart(username, token);
      break;
    }
    case "nomis": {
      const isAuth = await checkAuthNomis(data);
      if(!isAuth){
        innerLog("nomis", `Auth ${username} error !`);
        return
      }
      const timeClaim = await getTimeToClaim(data);
      if (timeClaim) {
        const minuteHasFarm = getTimeDifference(new Date(timeClaim).getTime());
        setTime(
          username,
          "nomis",
          minuteHasFarm > 0 ? Date.now() + minuteHasFarm * 60 * 1000 : 0
        );
      } else {
        setTime(username, "nomis", 0);
      }
      break;
    }
    default: {
      console.log("NO HANDLDER");
    }
  }
}
//#endregion

//#region checkClaimedAvaiable
async function checkClaimedAvaiable() {
  return new Promise((res) => {
    const cr = Date.now();
    const r = [];

    for (const i of time.keys()) {
      const claimedTime = time.get(i);
      if (claimedTime <= cr) {
        r.push(i);
      }
    }

    r.length && innerLog("claim now", r.toString());
    res(r);
  });
}
//#endregion
