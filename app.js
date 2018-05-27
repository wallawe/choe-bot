const { RTMClient, WebClient } = require('@slack/client')
const ccxt = require('ccxt')

const TOKEN = 'xoxp-310635658535-368680301281-370449133009-7f733849197596c5636d28047e2f73f4'
const GENERAL_CHANNEL_ID = 'C93H12QMQ'
const RODERICK_CHANNEL_ID = 'C94CQRQSJ'
const TEST_CHANNEL_ID = 'C7YAV76C8'
const TEST_TOKEN = 'xoxp-272105539559-272105539879-370332106784-96b5492427d26c35cdd07f55e5893358'

const BINANCE_API = 'y25BplRP0DMxqeiiUcpd8DZXnTNKHujbtLw19RmtqyQIqyox3krSbH9Jo7ZPkLvf'
const BINANCE_SECRET = 'HsNm2DaPFe3Wr0MQCogvvSupCc4moSvmxfRmGnRYN4ORSOdCHUMXBwBi4EvvjyPg'

const VALID_SIGNAL = new RegExp(/Signal [\d]{2,}: [A-Z]{2,6}\/[A-Z]{2,6}/)
const PAIR = new RegExp(/[A-Z]{3,5}\/[A-Z]{3,5}/)
const RISK_LEVELS = ['high', 'medium', 'low']


const rtm = new RTMClient(TOKEN)

rtm.start()

console.log('*** Realtime connection to Slack started ***')

let binance = new ccxt.binance ({
    apiKey: BINANCE_API,
    secret: BINANCE_SECRET,
});

rtm.on('message', async message => {

  const {text} = message

  if (message.type === 'message' && message.channel === RODERICK_CHANNEL_ID ) {
    console.log(text)

    // we can use riskLevel later to determine how much to buy. lower risk == higher amount
    // it will be low, medium, or high
    const riskLevel = RISK_LEVELS.find(level => text.toLowerCase().includes(level))

    // make sure it's a roderick signal and not just Eric chiming in with thoughts/opinions
    if (text && VALID_SIGNAL.test(text) && !!riskLevel) {

      // grab the pairing from the string
      const pairing = text.match(PAIR)[0].trim()

      // Coin we want to buy
      const buy = pairing.split('/')[0]
      // Coin we want to sell
      const sell = pairing.split('/')[1]

      // check for inclusion of a risk level even though we're not using it right now.
      // this is so we don't trigger a purchase when he gives the results of a signal.
      if (text.includes('LONG')) {

        console.log('going long here')

        const RISK_AMOUNT = 0.25 // amount of bitcoin to risk on any given trade. we can get more advanced later
        const SLIPPAGE_TOLERANCE = 0.003 // % above last ask we're willing to pay in case another bot beats us

        const tokenInfo = await binance.fetchTicker(pairing)
        const askingPrice = tokenInfo.ask
        const maxBuyPrice = askingPrice * (1 + SLIPPAGE_TOLERANCE)
        const buyAmount = RISK_AMOUNT / parseFloat(askingPrice)

        console.log('buy amount: ', buyAmount)
        console.log('max price: ', maxBuyPrice)
        const purchase = await binance.createLimitBuyOrder(pairing, buyAmount, maxBuyPrice)
        console.log('result of attempted purchase: ', purchase)

      } else if (text.includes('SHORT')) {

        console.log('going short here')

      }
    }
  }
})

// not currently in use
const listChannels = async function() {
  const web = new WebClient(TOKEN)
  const res = await web.channels.list()
  const channels = res.channels.map(ch => `${ch.name}: ${ch.id}`)

  console.log('Here are the channels and their respective IDs: ', channels)
}

// listChannels()
