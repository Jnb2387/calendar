const fs = require('fs');
const readline = require('readline');
const {
    google
} = require('googleapis');
var googleAuth = require('google-auth-library');
var _ =require('lodash')
const fetch = require("node-fetch");
const moment = require("moment");
const tz = require("moment-timezone");
const current_date = moment().tz('America/Denver').format();
const one_month = moment().tz('America/Denver').add(7, 'days').format();

const url = `https://thestudiocorp.officernd.com/i/organizations/thestudiocorp/user/bookings/occurrences?start=${current_date}&end=${one_month}&resourceId=5c192278166b1f0010f69abe`
// const url = `https://app.officernd.com/i/organizations/jeffco-spatial/user/bookings/occurrences?start=${current_date}&end=${one_month}`

// Load client secrets from a local file.
const googleSecrets = JSON.parse(fs.readFileSync('credentials.json')).installed
var TOKEN_PATH = 'token.json';

var oauth2Client = new googleAuth.OAuth2Client(
    googleSecrets.client_id,
    googleSecrets.client_secret,
    googleSecrets.redirect_uris[0]
);

const token = fs.readFileSync(TOKEN_PATH);
oauth2Client.setCredentials(JSON.parse(token));


var calendar = google.calendar('v3');
let googleEvents;
let officeEvents;
var newBookings;
var googleIds = [];
//GET THE GOOGLE EVENTS
async function getGoogleEvents() {
    await getOfficerndData(url)
    //GET ALL EXISTING EVENTS IN GOOGLE ***** MAYBE MAKE THIS SEARCH FOR ONE MONTH ******
    calendar.events.list({
        auth: oauth2Client,
        calendarId: 'sm3ok33ielv55ea2e367fbuin0@group.calendar.google.com',
        timeMin: (new Date()).toISOString(),
        maxResults: 50,
        singleEvents: true,
        // showDeleted:true,
        orderBy: 'startTime',
    }, function (err, res) {
        if (err) return console.log('The API returned an error: ' + err);
        googleEvents = res.data.items;
        console.log('Number of Google Events: ', googleEvents.length);
        if (googleEvents.length) {
            googleEvents.map((googleEvent, i) => {
                console.log('Google', i, googleEvent.summary, 'ID:', googleEvent.id, 'Desc:', googleEvent.description, '@', convertTime(googleEvent.start.dateTime,'MMMM Do YYYY, h:mm:ss a'), 'Status:', googleEvent.status)
            });
            compareBookings()
        } else {
            const ofevents = officeEvents.map(({bookingId: id, start, end, canceled}) => ({
                id,
                start:convertTime(start.dateTime),
                end:convertTime(end.dateTime),
            }));
            console.log('No upcoming Google Events found.');
            for (var j = 0; j < ofevents.length; j++) {
                insertGoogleEvent(ofevents[j]);
            }
        }
    })
}

function compareBookings(){
    const ofevents = officeEvents.filter(function(item){
        // console.log(item)
        return item.canceled !== true
    }).map(({bookingId: id, start, end, canceled}) => ({
        id,
        start:convertTime(start.dateTime),
        end:convertTime(end.dateTime),
    }));
    const gcevents = googleEvents.map(({id, start, end, status}) => ({
        id,
        start:convertTime(start.dateTime),
        end:convertTime(end.dateTime),
    }));
    var unique = _.differenceWith(ofevents,gcevents, _.isEqual);
    for (var j = 0; j < unique.length; j++) {
        insertGoogleEvent(unique[j]);
    }

    return console.log('# of New Bookings',unique.length)
}


//GET THE OFFICE BOOKINGS
async function getOfficerndData(url) {
    const response = await fetch(url);
    officeEvents = await response.json();
    console.log('Number of OfficeRnD Bookings:', officeEvents.length);
    
    officeEvents.map((event, i) => {
        console.log('Office', i, event.summary, 'ID:', event.bookingId, 'Description:', convertTime(event.start.dateTime,'MMMM Do YYYY, h:mm:ss a'), 'Canceled:', event.canceled)
        // if(event.canceled){cancelGoogleEvents(event.bookingId,event.canceled)}
    })

};
getGoogleEvents()






function insertGoogleEvent(resource) { // Function that returns a request.
    var event_to_send = {
        'summary': 'Busy',
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
        }
    }
    calendar.events.insert({
        auth: oauth2Client,
        calendarId: 'sm3ok33ielv55ea2e367fbuin0@group.calendar.google.com',
        resource: event_to_send
    }, function (err) {
        if (err) return cancelGoogleEvents(event_to_send.id)//console.log(err.message, event_to_send.id)
        console.log('Event Inserted', event_to_send.id, '@', convertTime(event_to_send.start.dateTime,'MMMM Do YYYY, h:mm:ss a'))
    });
};




function deleteEvent(eventId) {
    var params = {
        auth: oauth2Client,
        calendarId: 'sm3ok33ielv55ea2e367fbuin0@group.calendar.google.com',
        eventId: eventId,
    };
    calendar.events.delete(params, function (err) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        console.log('Event deleted:', eventId);
    });
}
// deleteEvent('onllvebmavsk73ftt9vvn84gm4')

//CANCEL EVENT FUNCTION
function cancelGoogleEvents(eventId, status) {
    if(status){
        var patch={'status':'cancelled'}
    }else{
        var patch={'status':'confirmed'}
    }

    calendar.events.patch({
        auth: oauth2Client,
        calendarId: 'sm3ok33ielv55ea2e367fbuin0@group.calendar.google.com',
        eventId: eventId,
        resource: patch
    }, function (err) {
        if (err) return console.log('patch error', err.message)
        console.log('Booking Updated to Cancelled', eventId)
    })
};



var convertTime = function (convert, options) {
    return moment(convert).tz('America/Denver').format(options)
}