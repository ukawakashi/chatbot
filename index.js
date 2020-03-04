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
                console.log(message);
                if (!message.hasOwnProperty('delivery')) {

                    let senderId = message.sender.id;

                    if (message.message && message.message.text) {
                        let text = message.message.text;

                        text = text.toLowerCase().replace(/\s+/g, '');
                        // Handle user message
                    } else if (message.postback && message.postback.payload) {
                        handlePostback(senderId, message.postback);
                    }
                }
            }
        });
        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    }
    else {
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
        case "CAFE_PRICE":
            getCafePrice().then(res => {
                message = { text: res };
                callSendAPI(senderId, message);
            }).catch(err => console.log(err));
            break;
        case "PEPPER_PRICE":
            getPepperPrice().then(res => {
                message = { text: res };
                callSendAPI(senderId, message);
            }).catch(err => console.log(err));
            break;
        default:
    }
}

function handleGreetingPostback(recipientId) {

    let url = "https://graph.facebook.com/" + recipientId;
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
            greeting = "Chào " + firstName+ " " + lastName + "! Bạn có thể ra lệnh cho tôi bằng các nút bên trong hộp thoại của menu bên dưới 👇";
        }
        let mess = {
            text: greeting
        };
        callSendAPI(recipientId, mess);
    });
}

async function getCafePrice() {
    try {
        let fResult = '';

        const browser = await puppeteer.launch({args: ['--no-sandbox']});
        const page = await browser.newPage();
        await page.goto('https://tintaynguyen.com/gia-ca-phe-doanh-nghiep/', {waitUntil: 'domcontentloaded'});

        fResult = await page.evaluate(() => {
            let mess = document.getElementsByClassName('the-article-title')[0].innerText;
            mess += '\n';

            let table = document.getElementsByClassName('quotes-table')[0];
            let rowLength = table.rows.length;

            for (let i = 1; i < rowLength - 2; i++){
                let messRow = '';
                //gets cells of current row
                let cells = table.rows.item(i).cells;

                //gets amount of cells of current row
                let cellLength = cells.length;

                //loops through each cell in current row
                for(let j = 0; j < cellLength; j++){
                    // get your cell info here
                    let val = cells.item(j).innerText.replace('ROBUSTA', '');

                    if(val[val.length - 1] === '0') {
                        val += '₫';
                    }
                    if (j === cellLength - 1) {
                        messRow += val + '\n';
                    }
                    else {
                        messRow += val + ' ';
                    }
                }
                mess += messRow;
            }
            return mess;
        });
        await browser.close();
        return Promise.resolve(fResult);
    }
    catch (e) {
        return Promise.reject(e);
    }
}

async function getPepperPrice() {
    try {
        let fResult = '';

        const browser = await puppeteer.launch({args: ['--no-sandbox']});
        const page = await browser.newPage();
        await page.goto('https://tintaynguyen.com/gia-tieu/', {waitUntil: 'domcontentloaded'});

        fResult = await page.evaluate(() => {
            let mess = document.getElementsByClassName('the-article-title')[0].innerText;
            mess += '\n';

            let table = document.getElementsByClassName('quotes-table')[0];
            let rowLength = table.rows.length;

            for (let i = 1; i < rowLength; i++){
                let messRow = '';
                //gets cells of current row
                let cells = table.rows.item(i).cells;

                //gets amount of cells of current row
                let cellLength = cells.length;

                //loops through each cell in current row
                for(let j = 0; j < cellLength; j++){
                    // get your cell info here
                    let val = cells.item(j).innerText;

                    if(val[val.length - 1] === '0') {
                        val += '₫';
                    }
                    if (j === cellLength - 1) {
                        messRow += val + '\n';
                    }
                    else {
                        messRow += val + ' ';
                    }
                }
                mess += messRow;
            }
            return mess;
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