'use strict';

const path = require('path');
const express = require('express');

const { init } = require('./db');
const { isLoggedIn } = require('./auth');
const siteRoutes = require('./routes/site');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('trust proxy', 1); // Railway sits behind a proxy (needed for secure cookies)
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

/* ------------------------------------------------------------ view helpers */

app.locals.siteName = process.env.SITE_NAME || 'Freelance Reviews';
app.locals.year = new Date().getFullYear();
app.locals.stars = (rating) => {
  const n = Math.min(5, Math.max(0, Number(rating) || 0));
  return (
    `<span class="stars" role="img" aria-label="${n} out of 5 stars">` +
    `${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`
  );
};
app.locals.fmtDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

app.use((req, res, next) => {
  res.locals.isLoggedIn = isLoggedIn(req);
  next();
});

app.use(siteRoutes);
app.use(dashboardRoutes);

/* ------------------------------------------------------------ error pages */

app.use((req, res) => {
  res
    .status(404)
    .render('error', { title: 'Not found', code: 404, message: 'That page does not exist.' });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  res
    .status(500)
    .render('error', {
      title: 'Something broke',
      code: 500,
      message: 'Something went wrong on our end. Try again in a moment.',
    });
});

/* ------------------------------------------------------------------ start */

const PORT = Number(process.env.PORT) || 3000;

init()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[${process.env.SITE_NAME || 'Freelance Reviews'}] listening on http://0.0.0.0:${PORT}`);
      if (!process.env.STAFF_PASSWORD) {
        console.warn(
          '[warn] STAFF_PASSWORD is not set — the dashboard password defaults to "changeme". Set STAFF_PASSWORD (and SESSION_SECRET) in Railway variables.'
        );
      }
    });
  })
  .catch((err) => {
    console.error('[fatal] could not start:', err.message);
    process.exit(1);
  });
