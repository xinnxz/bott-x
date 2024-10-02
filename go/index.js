const url = 'https://api.goplatform.io/api/v1/users/taps';
const walletAddress = '';
const tapPoint = 10;

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

async function tap() {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tap_amount: tapPoint,
        tap_remaining: 1925,
        wallet_address: walletAddress,
      }),
    });

    const data = await response.json();
    console.log('________TAP_SUCCESS______:', data?.taps?.tap_amount);
  } catch (error) {
    console.error('_________ERROR________', error);
  }
}

async function main() {
  if (!walletAddress) {
    console.log('Wallet address is not empty !');
    return;
  }
  do {
    await tap();
    await delay();
  } while (true);
}

main();
