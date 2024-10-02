const axios = require('axios');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { DateTime, Duration } = require('luxon');
const readline = require('readline');

let totalUsdt = [];

class BananaBot {
  constructor() {
    this.base_url = 'https://interface.carv.io/banana';
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://banana.carv.io',
      Referer: 'https://banana.carv.io/',
      'Sec-CH-UA': '"Not A;Brand";v="99", "Android";v="12"',
      'Sec-CH-UA-Mobile': '?1',
      'Sec-CH-UA-Platform': '"Android"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 12; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36',
      'X-App-ID': 'carv',
    };
  }

  log(msg) {
    console.log(`[*] ${msg}`);
  }

  async login(queryId) {
    const loginPayload = {
      tgInfo: queryId,
      InviteCode: '',
    };

    try {
      const response = await axios.post(
        `${this.base_url}/login`,
        loginPayload,
        { headers: this.headers },
      );
      await this.sleep(1000);

      const responseData = response.data;
      if (responseData.data && responseData.data.token) {
        return responseData.data.token;
      } else {
        this.log('Không tìm thấy token.');
        return null;
      }
    } catch (error) {
      this.log('Lỗi trong quá trình đăng nhập: ' + error.message);
      return null;
    }
  }

  async processAccount(queryId) {
    const token = await this.login(queryId);
    if (token) {
      this.headers['Authorization'] = token;
      this.headers['Cache-Control'] = 'no-cache';
      this.headers['Pragma'] = 'no-cache';

      try {
        const response = await axios.get(`${this.base_url}/get_banana_list`, {
          headers: this.headers,
        });
        const bananas = response.data.data.banana_list;
        const listMyBanana = bananas?.filter((e) => e.count);
        const totalBalance = listMyBanana
          .reduce((a, b) => a + b?.count * b?.sell_exchange_usdt, 0)
          .toFixed(2);
        totalUsdt.push(totalBalance);
        console.log(`Balance: ${colors.yellow(totalBalance)} USDT !`);
        return;
      } catch (error) {
        this.log('Lỗi rồi: ' + error.message);
      }
    }
    return null;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  extractUserData(queryId) {
    const urlParams = new URLSearchParams(queryId);
    const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
    return {
      auth_date: urlParams.get('auth_date'),
      hash: urlParams.get('hash'),
      query_id: urlParams.get('query_id'),
      user: user,
    };
  }

  async Countdown(seconds) {
    for (let i = Math.floor(seconds); i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        `===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log('');
  }

  async main() {
    const dataFile = path.join(__dirname, 'data.txt');
    const userData = fs
      .readFileSync(dataFile, 'utf8')
      .replace(/\r/g, '')
      .split('\n')
      .filter(Boolean);

    for (let i = 0; i < userData.length; i++) {
      const queryId = userData[i];
      const data = this.extractUserData(queryId);
      const userDetail = data.user;

      if (queryId) {
        console.log(
          `\n----------------- Tài khoản ${i + 1} | ${
            userDetail.first_name
          } -----------------`,
        );
        await this.processAccount(queryId);
      }
      await this.sleep(1000);
    }
    console.log();
    console.log(
      `Total Balance: ${colors.cyan(
        totalUsdt.reduce((a, b) => a + Number(b), 0).toFixed(4),
      )} USDT`,
    );
  }
}

const bot = new BananaBot();
bot.main();
