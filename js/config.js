// lookoutlogs.com settings. This is the only file that needs editing on release days.
window.LOOKOUT = {
  // Google Apps Script web app URL for The Line and the updates list (see website/apps-script/).
  // While empty, the forms say the line isn't connected yet.
  endpoint: 'https://script.google.com/macros/s/AKfycbxeGbPWP_p8EniHQcz3TFcDIep6f2Rbnd-0Q_gqgXK5F_DlCNbIrAsDHi4ckH9rkmCBCA/exec',

  // Flip to true on Nov 9 when the trailer is live. Switches on the Listen links.
  trailerLive: false,
  listen: { apple: '', spotify: '', rss: '' },

  // How many stops have aired. Lights the route map and the Logs index. 0 until Nov 23.
  aired: 0,

  // The route, north to south. `log` is the entry page, published on release day and never before.
  stops: [
    { n: 1,  name: 'Mount Baker',      lat: 48.777, lon: -121.813, log: 'logs/01-mount-baker.html', date: 'November 23' },
    { n: 2,  name: 'Glacier Peak',     lat: 48.112, lon: -121.113 },
    { n: 3,  name: 'Mount Rainier',    lat: 46.853, lon: -121.760 },
    { n: 4,  name: 'Mount St. Helens', lat: 46.191, lon: -122.195 },
    { n: 5,  name: 'Mount Adams',      lat: 46.202, lon: -121.490 },
    { n: 6,  name: 'Mount Hood',       lat: 45.373, lon: -121.696 },
    { n: 7,  name: 'Mount Jefferson',  lat: 44.674, lon: -121.800 },
    { n: 8,  name: 'The Three Sisters', lat: 44.150, lon: -121.770 },
    { n: 9,  name: 'Mount Bachelor',   lat: 43.979, lon: -121.688 },
    { n: 10, name: 'Crater Lake',      lat: 42.945, lon: -122.110 }
  ]
};
