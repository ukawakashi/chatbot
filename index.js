'use strict';

// Imports dependencies and set up http server
require('dotenv').config();

const
    express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    puppeteer = require('puppeteer'),
    app = express().use(bodyParser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening on port' + process.env.PORT));

// Creates the endpoint for our webhook
app.post('/webhook', (req, res) => {

    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            let messaging = entry.messaging;

            for(let message of messaging) {
                let senderId = message.sender.id;
                if(message.message) {
                    // If user send text
                    let text = message.message.text;
                    if(text === 'gia ca phe') {
                        sendMessage(senderId, "Chào bạn\nGiá cà phê hôm nay:");

                        let reply = getCafePrice();
                        reply.forEach((item) => {
                            sendMessage(senderId, item.province + ": " + item.price + "₫");
                        });
                    }
                    console.log(text);
                }
            }
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

async function getCafePrice() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('https://giacaphe.com/gia-ca-phe-noi-dia');

    const results = await page.evaluate(() => {
        let provinces = document.getElementById('gia_trong_nuoc').querySelectorAll('.gnd_market');
        let price = document.getElementById('gia_trong_nuoc').querySelectorAll('.tdLast');
        let listProvinces = [];
        let listPrice = [];
        let result = [];
        provinces.forEach((item) => {
            listProvinces.push(item.innerText);
        });
        price.forEach((province) => {
            listPrice.push(province.innerText);
        });

        for(let i = 1; i < listPrice.length - 2; i++) {
            result.push({
                province: listProvinces[i],
                price: listPrice[i]
            });
        }

        return result;
    });

    await browser.close();

    return results;
}

// Send message to REST API to reply user message
function sendMessage(senderId, message) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: process.env.TOKEN,
        },
        method: 'POST',
        json: {
            recipient: {
                id: senderId
            },
            message: {
                text: message
            },
        }
    });
}

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = process.env.MY_VERIFY_TOKEN;

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});