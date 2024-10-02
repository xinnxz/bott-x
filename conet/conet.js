const axios = require('axios');
const fs = require('fs').promises;
const colors = require('colors');

class MiningManager {
  log(msg, color) {
    console.log(`[Đang tìm cứt chim] ${msg[color]}`);
  }

  async readDataFile(filePath) {
    const data = (await fs.readFile(filePath, 'utf8')) || [];
    const dataParse = JSON.parse(data);
    const dataMapping = dataParse.map((e) => {
        return {
            message: JSON.stringify({ walletAddress: e?.walletAddress.trim() }),
            signMessage: e?.signMessage.trim(),
          };
    });
    return dataMapping
  }

  async makeRequest(account, index, maxRetries = 9999, retryDelay = 1000) {
    const url = 'https://api.conet.network/api/startMining';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(url, account, {
          headers: {
            'Content-Type': 'application/json',
          },
          responseType: 'text',
        });

        const dataLines = response.data.split('\n');
        const results = [];
        for (const line of dataLines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);
              results.push(
                `Tài khoản ${index + 1} đã tìm thấy cứt - Tốc độ đào cứt: ${json.rate}/s | Online ${
                  json.online
                }`,
              );
            } catch (error) {
              results.push(
                `Tài khoản ${index + 1} - Lỗi khi phân tích cú pháp JSON: ${
                  error.message
                }`,
              );
            }
          }
        }

        return results;
      } catch (error) {
        if (attempt < maxRetries) {
          this.log(
            `Tài khoản ${index + 1} - Lỗi khi gửi yêu cầu (lần ${attempt}): ${
              error.message
            }. Thử lại sau ${retryDelay / 1000} giây...`,
            'yellow',
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          return [
            `Tài khoản ${
              index + 1
            } - Lỗi khi gửi yêu cầu sau ${maxRetries} lần thử: ${
              error.message
            }`,
          ];
        }
      }
    }
  }

  async main() {
    try {
      const accounts = await this.readDataFile('data.json');

      while (true) {
        this.log(
          `Khởi tạo minning cho ${colors.yellow(accounts.length)} tài khoản...`,
          'green',
        );
        const promises = accounts.map(async (account, index) => {
          try {
            const results = await this.makeRequest(account, index);
            results.forEach((result) => this.log(result, 'yellow'));
          } catch (error) {
            this.log(`Lỗi tài khoản ${index + 1}: ${error.message}`, 'red');
          }
        });
        await Promise.all(promises);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      this.log(`Error: ${error.message}`, 'red');
    }
  }
}

const manager = new MiningManager();
manager.main();
