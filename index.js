// Imports dependencies and set up http server
require('dotenv').config();

const
    express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    puppeteer = require('puppeteer'),
    app = express().use(bodyParser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening on port ' + process.env.PORT));

// Creates the endpoint for our webhook
app.post('/webhook', (req, res) => {

    let body = req.body;

    console.log(body);
    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            let messaging = entry.messaging;

            for(let message of messaging) {
                let senderId = message.sender.id;
                switch (body) {
                    case 'get_started':
                        sendGetStarted(senderId);
                        break;

                    default:
                        if(message.message) {
                            // If user send text
                            let text = message.message.text.toLowerCase();
                            text = text.replace(/\s+/g, '');
                            if(text === 'giacaphe' || text === 'giácàphê') {
                                sendMessage(senderId, "Chào bạn\nGiá cà phê hôm nay:");
                                let message = '';
                                getCafePrice().then(res => {
                                    for (const item of res) {
                                        message += item.province + ": " + item.price + "₫\n";
                                    }
                                    sendMessage(senderId, message);
                                }).catch(err => console.log(err));
                            }
                        }
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

function sendGetStarted(recipientId) {
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Welcome to the Bot Hotel, I can help with any of the three requests below.",
                    buttons:[{
                        type: "postback",
                        title: "Check in",
                        payload: "check_in"
                    }, {
                        type: "postback",
                        title: "Room Service",
                        payload: "room_service"
                    }, {
                        type: "phone_number",
                        title: "Call Reception",
                        payload: "+16505551234"
                    }]
                }
            }
        }
    };

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: process.env.TOKEN,
        },
        method: 'POST',
        json: messageData
    });
}

async function getCafePrice() {
    try {
        let fResult = [];

        const browser = await puppeteer.launch({args: ['--no-sandbox']});
        const page = await browser.newPage();
        await page.goto('https://giacaphe.com/gia-ca-phe-noi-dia', {waitUntil: 'domcontentloaded'});

        fResult = await page.evaluate(() => {
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

            for (let i = 1; i < listPrice.length - 2; i++) {
                result.push({
                    province: listProvinces[i],
                    price: listPrice[i]
                });
            }

            return result;
        });
        await browser.close();
        return Promise.resolve(fResult);
    }
    catch (e) {
        return Promise.reject(e);
    }
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