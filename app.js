require('dotenv').load()
const express = require('express')
const bodyParser = require('body-parser')
const { RTMClient, WebClient } = require('@slack/client')
const ccxt = require('ccxt')
var mailgun = require('mailgun-js')({apiKey: process.env.MAILGUN_KEY, domain: process.env.MAILGUN_DOMAIN })

const VALID_SIGNAL = new RegExp(/signal[\d]{2,}:[a-z]{2,6}\/[a-z]{2,6}/)
const PAIR = new RegExp(/[a-z]{3,5}\/[a-z]{3,5}/)
const RISK_LEVELS = ['high', 'medium', 'low']
const inDevelopment = process.env.NODE_ENV === 'development'

let app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => { res.send('\n 👋 🌍 \n') })

function getShitPoppin() {
  const rtm = new RTMClient(process.env.SLACK_TOKEN)
  rtm.start()

  console.log('*** Realtime connection to Slack started ***')

  let binance = new ccxt.binance ({
    apiKey: process.env.BINANCE_API,
    secret: process.env.BINANCE_SECRET,
  })

  rtm.on('message', async message => {

    let {text} = message

    if (message.type === 'message' && message.channel === process.env.RODERICK_CHANNEL_ID && typeof text === 'string') {

      text = text.toLowerCase().replace(/ /g, '').replace(/[!@#$%^&*]/g, '')

      const isResult = text.includes('result')
      const isUpdate = text.includes('update')

      // make sure it's a roderick signal and not just Eric chiming in with thoughts/opinions
      if (text && VALID_SIGNAL.test(text) && text.includes('buy:') && !isResult && !isUpdate) {
        console.log('getting here')

        // we can use riskLevel later to determine how much to buy. lower risk == higher amount
        // it will be low, medium, or high
        const riskLevel = RISK_LEVELS.find(level => text.includes(level))
        if (!riskLevel) {
          return
        }

        // one off pairing change for NANO bc they changed their name after listing
        if (text.includes('nano/btc')) {
          text.replace('nano/btc', 'xrb/btc')
        }

        // grab the pairing from the string
        let pairing = text.match(PAIR)[0].trim()

        // Coin we want to buy
        const buy = pairing.split('/')[0]

        // Coin we want to sell
        const sell = pairing.split('/')[1]

        // check for inclusion of a risk level even though we're not using it right now.
        // this is so we don't trigger a purchase when he gives the results of a signal.
        if (text.includes('short') && !text.includes('long')) {

          console.log('going short here')
          // hook up to kraken!

        } else if (sell === 'btc'){

          console.log('*** GOING LONG ***')

          const RISK_AMOUNT = 0.05 // amount of bitcoin to risk on any given trade. we can get more advanced later
          const SLIPPAGE_TOLERANCE = 0.005 // % above last ask we're willing to pay in case another bot beats us

          const recommendedBuyPrice = getBuyPrice(text, pairing)
          // slippage tolerance currently not in use - take max buy price from provided range
          // const maxBuyPrice = recommendedBuyPrice * (1 + SLIPPAGE_TOLERANCE)
          const buyAmount = RISK_AMOUNT / parseFloat(recommendedBuyPrice)

          console.log('recd buy price: ', recommendedBuyPrice)

          if (inDevelopment) {
            try {
              const purchase = await binance.createLimitBuyOrder(pairing.toUpperCase(), buyAmount, recommendedBuyPrice)
              const emailText = `We just purchased ${purchase.amount} ${buy} at a price of ${purchase.price} for a total cost of ${purchase.cost} ${sell}. Looking for 2.5-3% return.`
              sendEmail('Automated Purchase Initiated', emailText)
              console.log('PURCHASE: ', purchase)
            } catch(err) {
              console.log(err)
            }
          } else {
            // sendEmail('Automated Purchase Initiated', 'test email')
          }
        }
      } else {
        // sendEmail('Update from Eric Choe (non-signal)', text)
      }
    }
  })
}

function sendEmail(subject, text) {

  var data = {
    from: 'Will Wallace <wallac.will@gmail.com>',
    to: 'wallac.will@gmail.com',
    cc: 'mt2344@gmail.com, cullenawallace@gmail.com',
    subject,
    text
  }

  mailgun.messages().send(data, function (error, body) {
    if (error) {
      return console.log('Error sending email: ', error)
    }

    console.log('Email successfully sent', body)
  })
}

app.listen(process.env.PORT, (err) => {
  if (err) throw err

  if (process.env.SLACK_TOKEN) {
    getShitPoppin()
  }
})

function getBuyPrice(text, pairing) {
  const line = text.match(/buy:\d+([\.,]\d{1,})?-\d+([\.,]\d{1,})?/)
  const buyPrice = text.split('-')[1]
  return parseFloat(buyPrice)
}

// not currently in use
const listChannels = async function() {
  const web = new WebClient(process.env.SLACK_TOKEN)
  const res = await web.channels.list()
  const channels = res.channels.map(ch => `${ch.name}: ${ch.id}`)

  console.log('Here are the channels and their respective IDs: ', channels)
}

// listChannels()
