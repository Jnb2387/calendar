const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const fetch = require("node-fetch");
const moment = require("moment");
const tz = require("moment-timezone")
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listEvents);
});
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
let calendar 
function authorize(credentials, callback) {
  const {
    client_secret,
    client_id,
    redirect_uris
  } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
  calendar = google.calendar({
    version: 'v3',
    auth:oAuth2Client
  });
}
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}
const current_date = moment().tz('America/Denver').format();
const one_month = moment().tz('America/Denver').add(5, 'days').format();
/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
const url = `https://thestudiocorp.officernd.com/i/organizations/thestudiocorp/user/bookings/occurrences?start=${current_date}&end=${one_month}&resourceId=5c192278166b1f0010f69abe`
let newevents = [];
let events_to_send = []
const getData = async url => {
  try {
    const response = await fetch(url);
    const json = await response.json();
    newevents = json;
    console.log('Number of OfficeRnD Bookings:', newevents.length)
    // var last_events = fs.readFileSync(`txt/baseline.json`)
    // fs.writeFileSync(`txt/baseline.json`, JSON.stringify(json))
  } catch (error) {
    console.log(error);
  }
};


async function listEvents(auth) {
  // const calendar = google.calendar({
  //   version: 'v3',
  //   auth
  // });
  await getData(url);
  //GET ALL EXISTING EVENTS IN GOOGLE ***** MAYBE MAKE THIS SEARCH FOR ONE MONTH ******
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 15,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
      console.log('Number of Google Events: ', events.length);
      // isEquivalent(events, newevents)
      events.map((event, i) => {
        console.log(i, event.summary,'ID:',  event.id,'Description:',event.description)
        for (var j = 0; j < newevents.length; j++) {
          if (newevents[j].canceled == true) {
            console.log('Canceled Event  @:', moment(newevents[j].start.dateTime).tz('America/Denver').format('MMMM Do YYYY, h:mm:ss a'))
            // newevents.splice([j], 1)
            deleteEvent(event.id)
          }
          // } else {
            if (newevents[j].bookingId == event.id && moment(newevents[j].start.dateTime).tz('America/Denver').format() == event.start.dateTime && moment(newevents[j].end.dateTime).tz('America/Denver').format() == event.end.dateTime) {
                console.log("Booking Already Exists: ", event.id, moment(newevents[j].start.dateTime).tz('America/Denver').format('MMMM Do YYYY, h:mm:ss a'), 'Same AS ', moment(event.start.dateTime).tz('America/Denver').format('MMMM Do YYYY, h:mm:ss a'))
                newevents.splice([j], 1)
            }
            // events_to_send.push({
            //   'summary': 'Busy',
            //   'id':newevents[j].bookingId,
            //   'location': '4950 Washington St. Denver, CO 80216, Studio A',
            //   'description': newevents[j].bookingId,
            //   'start': {
            //     'dateTime': moment(newevents[j].start.dateTime).tz('America/Denver').format(),
            //     'timeZone': 'America/Denver'
            //   },
            //   'end': {
            //     'dateTime': moment(newevents[j].end.dateTime).tz('America/Denver').format(),
            //     'timeZone': 'America/Denver'
            //   }
            // });
          // }
        }
      });
      // newevents.map(function (value, i) {
        
     
      // });

    var request;
    for (var j = 0; j < events_to_send.length; j++) {
      console.log('Sending New Booking:', events_to_send[j].id, moment(events_to_send[j].start.dateTime).tz('America/Denver').format('MMMM Do YYYY, h:mm:ss a'))
      request = function (resource) { // Function that returns a request.
        return calendar.events.insert({
          'calendarId': 'primary',
          'resource': resource
        });
      }(events_to_send[j]);  // Bind to the current event.
    }
  });


}
    function deleteEvent(eventId) {
      var params = {
        calendarId: 'primary',
        eventId: eventId,
      };
      calendar.events.delete(params, function (err) {
        if (err) {
          console.log('The API returned an error: ' + err);
          return;
        }
        console.log('Event deleted.', eventId);
      });
    }
//FIND UNHANDLED PROMISES
// process.on('unhandledRejection', (reason, p) => {
//   console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//   // application specific logging, throwing an error, or other logic here
// })




// var event = {
//   'summary': 'Room Booked',
//   'location': '4950 Washington St. Denver, CO 80216',
//   'description': 'Studio A is booked',
//   'start': {
//     'dateTime': starttimes[i],
//     'timeZone': 'America/Denver',
//   },
//   'end': {
//     'dateTime': '2019-01-18T17:00:00-18:00',
//     'timeZone': 'America/Denver',
//   },
//   'recurrence': [
//     //'RRULE:FREQ=DAILY;COUNT=2'
//   ],
//   'attendees': [{
//     'email': 'jnb2387@gmail.com'
//   }, ],
//   'reminders': {
//     'useDefault': false,
//     'overrides': [{
//         'method': 'email',
//         'minutes': 24 * 60
//       },
//       {
//         'method': 'popup',
//         'minutes': 10
//       },
//     ],
//   },
// };