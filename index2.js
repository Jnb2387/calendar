const fs = require('fs');
const {
    google
} = require('googleapis');
var googleAuth = require('google-auth-library');
var _ = require('lodash');
const fetch = require("node-fetch");
const moment = require("moment");
const tz = require("moment-timezone");
const path = require("path");

// Load client secrets from a local file.
const googleSecrets = JSON.parse(fs.readFileSync(path.resolve(__dirname, './credentials.json'))).installed
var TOKEN_PATH = path.resolve(__dirname, './token.json');

var oauth2Client = new googleAuth.OAuth2Client(
    googleSecrets.client_id,
    googleSecrets.client_secret,
    googleSecrets.redirect_uris[0]
);

const token = fs.readFileSync(TOKEN_PATH);
oauth2Client.setCredentials(JSON.parse(token));

const current_date = moment().tz('America/Denver').format();
const one_month = moment().tz('America/Denver').add(33, 'days').format();
var calendarId='4mtf416s77rqed7gf81jukfa1g@group.calendar.google.com';

var calendar = google.calendar('v3');
const url = `https://thestudiocorp.officernd.com/i/organizations/thestudiocorp/user/bookings/occurrences?start=${current_date}&end=${one_month}&resourceId=5c192278166b1f0010f69abe`
// const url = `https://app.officernd.com/i/organizations/jeffco-spatial/user/bookings/occurrences?start=${current_date}&end=${one_month}`
let googleEvents;
let officeEvents;

const SimpleNodeLogger = require('simple-node-logger'),
    opts = {
        logFilePath: path.resolve(__dirname, './mylogfile.log'),
        timestampFormat:'YYYY-MM-DD HH:mm:ss'
    },
log = SimpleNodeLogger.createSimpleLogger( opts );

//GET THE GOOGLE EVENTS
async function getGoogleEvents() {

    await getOfficerndData(url) //NOT SURE BUT WAIT UNTIL THE OFFICE EVENTS FUNCTION FINISHES
    calendar.events.list({
        auth: oauth2Client,
        calendarId: calendarId,
        timeMin: current_date, //(new Date()).toISOString(),
        timeMax: one_month,
        maxResults: 50,
        singleEvents: true,
        showDeleted: true,
        orderBy: 'startTime',
    }, function (err, res) {
        if (err) return log.info('The API returned an error: ' + err);
        googleEvents = res.data.items;
        // console.log('Number of Google Events:', googleEvents.length, '# of Cancelled',googleEvents.filter(function(item){return item.status === 'cancelled'}).length)
        if (googleEvents.length) {
            // googleEvents.map((googleEvent, i) => {console.log('Google', i, googleEvent.summary, 'ID:', googleEvent.id, '@', convertTime(googleEvent.start.dateTime,'MMMM Do YYYY, h:mm:ss a'), 'Status:', googleEvent.status) });
            compareBookings()
        } else {
            const ofevents = officeEvents.map(({
                bookingId: id,
                start,
                end,
                status
            }) => ({
                id,
                start: convertTime(start.dateTime),
                end: convertTime(end.dateTime),
                status
            }));
            // console.log('No upcoming Google Events found.');
            for (var j = 0; j < ofevents.length; j++) {
                insertGoogleEvent(ofevents[j]);
            }
        }
    })
}

function compareBookings() {
    // LOOP THROUGH THE officeEVENTS ARRAY OF EVENTS AND MAKE A NEW ARRAY OF JUST THE bookingId, start, end, AND status(cancelled OR confirmed)
    const ofevents = officeEvents.map(({
        bookingId: id,
        start,
        end,
        status
    }) => ({
        id,
        start: convertTime(start.dateTime),
        end: convertTime(end.dateTime),
        status
    }));
    // LOOP THROUGH THE googleEVENTS ARRAY OF EVENTS AND MAKE A NEW ARRAY OF JUST THE Id, start, end, AND status(cancelled OR confirmed)
    const gcevents = googleEvents.map(({
        id,
        start,
        end,
        status
    }) => ({
        id,
        start: convertTime(start.dateTime),
        end: convertTime(end.dateTime),
        status
    }));
    var unique = _.differenceWith(ofevents, gcevents, _.isEqual);
    for (var j = 0; j < unique.length; j++) {
        insertGoogleEvent(unique[j]);
    }

    // return console.log('# of New Bookings',unique.length)
}


//GET THE OFFICE BOOKINGS
async function getOfficerndData(url) {
    const response = await fetch(url, {
            headers: {
               Cookie:'connect.sid=s%3AXhWbJfVE7_HKWJvZG0151KZXl86j3OKl.VyriWYJjIGE1DeJK4sIEGE%2BSjFD7MJcvAU4UNB9OI4c; path=/; domain=.thestudiocorp.officernd.com; Secure; HttpOnly; Expires=Sat, 16 Mar 2029 17:01:34 GMT;',
               Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVjNTJiZTQ4ZmI2MzM3MDAxMTEyZTc3YyIsImlhdCI6MTU0ODkyNjUzNiwiZXhwIjoxNTgwNDYyNTM2fQ.YD_WQJZ7tIGgtXtf3YcS-sQ8TJMshbOKUbZvq8Lxpsg'
             }
          });
    officeEvents = await response.json();
    // console.log('Total # of OfficeRnD Bookings:', officeEvents.length, '# of Cancelled', officeEvents.filter(function (item) {
    //     return item.canceled === true
    // }).length);

    officeEvents.map((event, i) => {
        if (event.canceled === true) {
            event.status = 'cancelled'
        }
        else {
            event.status = 'confirmed'
        }
        // console.log('Office', i, event.summary, 'ID:', event.bookingId, '@', convertTime(event.start.dateTime,'MMMM Do YYYY, h:mm:ss a'), 'Status:', event.status)
    });

};
getGoogleEvents()

function insertGoogleEvent(resource) { // Function that returns a request.
    var event_to_send = {
        'summary': 'Studio A Booked',
        'id': resource.id,
        'location': '4950 Washington St. Denver, CO 80216, Studio A',
        'description': resource.id,
        'start': {
            'dateTime': moment(resource.start).tz('America/Denver').format(),
            'timeZone': 'America/Denver'
        },
        'end': {
            'dateTime': moment(resource.end).tz('America/Denver').format(),
            'timeZone': 'America/Denver'
        },
        'attendees': [{
            'email': 'bradleyhouse23@gmail.com'
        }, ],
        'status': resource.status
    }
    calendar.events.insert({
        auth: oauth2Client,
        calendarId: calendarId,
        resource: event_to_send,
        sendUpdates: 'all'
    }, function (err) {
        if (err) {
            patchGoogleEvents(event_to_send.id, event_to_send.status, event_to_send.start, event_to_send.end)
        }else{

            //console.log(err.message, event_to_send.id)
           log.info(`Event Inserted ${event_to_send.id}, start ${convertTime(event_to_send.start.dateTime,'MMMM Do YYYY, h:mm:ss a')}, end ${convertTime(event_to_send.end.dateTime,'MMMM Do YYYY, h:mm:ss a')} status, ${event_to_send.status}`)
            
        }

    })
};

//Patch EVENT FUNCTION
function patchGoogleEvents(eventId, status,start,end) {
    if(eventId ==='5c1be334f623420011c56dd7'){return }
    calendar.events.patch({
        auth: oauth2Client,
        calendarId: calendarId,
        eventId: eventId,
        resource: {
            'start': start,
            'end':end,
            'status': status
        }
    }, function (err) {
        if (err) return log.info('patch error', err.message)
        log.info(`Booking: ${eventId}, start ${convertTime(start.dateTime,'MMMM Do YYYY, h:mm:ss a')}, end ${convertTime(end.dateTime,'MMMM Do YYYY, h:mm:ss a')}, status ${status},`)

})
}

var convertTime = function (convert, options) {
    return moment(convert).tz('America/Denver').format(options)
}
