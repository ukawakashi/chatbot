// Imports dependencies and set up http server
require('dotenv').config();

const
    express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    puppeteer = require('puppeteer'),
    app = express().use(bodyParser.json()); // creates express http server
    app.use(bodyParser.urlencoded({
        extended: false
    }));

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening on port ' + process.env.PORT));

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

                if(message.message && message.message.text) {
                    let text = message.message.text;

                    text = text.toLowerCase().replace(/\s+/g, '');
                    // Handle user message
                }
                else if(message.postback && message.postback.payload) {
                    handlePostback(senderId, message.postback);
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

function handlePostback(senderId, messagePostback) {
    const payload = messagePostback.payload;
    let message;
    switch (payload) {
        case "GET STARTED":
            handleGreetingPostback(senderId);
            break;
        case "ABOUT":
            message = {
                text: "Đây là boss của tôi :)) " + "https://www.facebook.com/tranchinh.pham.3"
            };

            callSendAPI(senderId, message);
            break;
        case "CAFE_PRICE":
            callSendAPI(senderId, {text: "Chào bạn\nGiá cà phê hôm nay:"});
            let text = '';

            getCafePrice().then(res => {
                for (const item of res) {
                    text += item.province + ": " + item.price + "₫\n";
                }
                message = { text: text };
                callSendAPI(senderId, message);
            }).catch(err => console.log(err));
            break;
        default:
    }
}

function handleGreetingPostback(recipientId) {

    let url = "https://graph.facebook.com/" + userId;
    request({
        url: url,
        qs: {
            fields: 'first_name,last_name',
            access_token: process.env.TOKEN,
        },
        method: 'GET',
    }, function (err, res, body) {
        let greeting = '';
        if(err) {
            console.log("error getting username: " + err);
        } else {
            let data = JSON.parse(body);
            const firstName = data.first_name;
            const lastName = data.last_name;
            greeting = "Chào " + firstName+ " " + lastName + "! Bạn cần thông tin gì nào ^_^";
        }

        const greetingPayload = {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: greeting,
                    buttons:[{
                        type: "postback",
                        title: "Xem giá cà phê",
                        payload: "CAFE_PRICE"
                    }, {
                        type: "postback",
                        title: "About",
                        payload: "ABOUT"
                    }]
                }
            }
        };
        callSendAPI(recipientId, greetingPayload);
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
function callSendAPI(senderId, message) {

    let request_body = {
        recipient: {
            id: senderId
        },
        message: message
    };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: process.env.TOKEN,
        },
        method: 'POST',
        json: request_body
    }, (err, res, body) => {
        console.log("Message sent response body: ", body);
        if(err) {
            console.log("Unable to send message: ", err);
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