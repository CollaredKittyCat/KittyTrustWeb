'use strict';

const express = require('express');
const { query } = require('../db');
const { validateReview } = require('../validate');
const {
  requireStaff,
  passwordsMatch,
  setSessionCookie,
  clearSessionCookie,
} = require('../auth');

const router = express.Router();

const NOTICES = { loggedout: 'Signed out. See you next time.' };
const PROBLEMS = {
  missing_identifier: 'Enter the identifier of the review you want to remove.',
  unknown_identifier: 'No review matched that identifier.',
  not_found: 'That review no longer exists.',
};

/* ------------------------------------------------------------------ login */

router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Staff login',
    notice: NOTICES[req.query.status] || null,
    error: null,
  });
});

router.post('/login', (req, res) => {
  if (!passwordsMatch(req.body.password || '')) {
    return res.status(401).render('login', {
      title: 'Staff login',
      notice: null,
      error: 'Wrong password, try again.',
    });
  }
  setSessionCookie(res, req);
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res, req);
  res.redirect('/login?status=loggedout');
});

/* --------------------------------------------------------------- dashboard */

router.use('/dashboard', requireStaff);

router.get('/dashboard', async (req, res, next) => {
  try {
    const [reviews, stats] = await Promise.all([
      query('SELECT * FROM reviews ORDER BY updated_at DESC, id DESC'),
      query(
        `SELECT count(*)::int AS total,
                coalesce(round(avg(rating)::numeric, 1), 0)::float AS avg
           FROM reviews`
      ),
    ]);
    res.render('dashboard', {
      title: 'Staff dashboard',
      reviews: reviews.rows,
      stats: stats.rows[0],
      notice: NOTICES[req.query.status] || null,
      problem: PROBLEMS[req.query.error] || null,
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ forms */

function renderForm(res, { mode, review, errors, status = 400 }) {
  res.status(status).render('review-form', {
    title: mode === 'edit' ? 'Edit review' : 'New review',
    mode,
    action: mode === 'edit' ? `/dashboard/reviews/${review.id}` : '/dashboard/reviews',
    review,
    errors,
  });
}

router.get('/dashboard/new', (req, res) => {
  renderForm(res, {
    mode: 'new',
    review: {
      id: null,
      identifier: '',
      display_name: '',
      username: '',
      discord_id: '',
      user_link: '',
      banner_url: '',
      service: '',
      experience: '',
      rating: 5,
    },
    errors: {},
    status: 200,
  });
});

/* ----------------------------------------------------------------- remove */

// Registered before the :id routes so "remove" is never treated as a row id.
router.post('/dashboard/reviews/remove', async (req, res, next) => {
  const identifier =
    typeof req.body.identifier === 'string' ? req.body.identifier.trim().slice(0, 60) : '';
  if (!identifier) return res.redirect('/dashboard?error=missing_identifier');
  try {
    // Accepts the identifier (any case) or the numeric row id.
    const result = await query(
      'DELETE FROM reviews WHERE lower(identifier) = lower($1) OR id::text = $1',
      [identifier]
    );
    res.redirect(
      result.rowCount > 0 ? '/dashboard?status=removed' : '/dashboard?error=unknown_identifier'
    );
  } catch (err) {
    next(err);
  }
});

router.post('/dashboard/reviews', async (req, res, next) => {
  const { ok, errors, values } = validateReview(req.body);
  if (!ok) {
    return renderForm(res, { mode: 'new', review: { id: null, ...values }, errors });
  }
  try {
    await query(
      `INSERT INTO reviews
         (identifier, display_name, username, discord_id, user_link,
          banner_url, service, experience, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        values.identifier,
        values.display_name,
        values.username,
        values.discord_id,
        values.user_link,
        values.banner_url,
        values.service,
        values.experience,
        values.rating,
      ]
    );
    res.redirect('/dashboard?status=added');
  } catch (err) {
    if (err.code === '23505') {
      return renderForm(res, {
        mode: 'new',
        review: { id: null, ...values },
        errors: { ...errors, identifier: 'That identifier is already in use — pick another one.' },
      });
    }
    next(err);
  }
});

function validId(req, res) {
  if (!/^\d+$/.test(String(req.params.id))) {
    res.redirect('/dashboard?error=not_found');
    return false;
  }
  return true;
}

router.get('/dashboard/reviews/:id/edit', async (req, res, next) => {
  if (!validId(req, res)) return;
  try {
    const { rows } = await query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.redirect('/dashboard?error=not_found');
    renderForm(res, { mode: 'edit', review: rows[0], errors: {}, status: 200 });
  } catch (err) {
    next(err);
  }
});

router.post('/dashboard/reviews/:id', async (req, res, next) => {
  if (!validId(req, res)) return;
  const { ok, errors, values } = validateReview(req.body);
  if (!ok) {
    return renderForm(res, {
      mode: 'edit',
      review: { id: req.params.id, ...values },
      errors,
    });
  }
  try {
    const result = await query(
      `UPDATE reviews
          SET identifier   = $1,
              display_name = $2,
              username     = $3,
              discord_id   = $4,
              user_link    = $5,
              banner_url   = $6,
              service      = $7,
              experience   = $8,
              rating       = $9,
              updated_at   = now()
        WHERE id = $10`,
      [
        values.identifier,
        values.display_name,
        values.username,
        values.discord_id,
        values.user_link,
        values.banner_url,
        values.service,
        values.experience,
        values.rating,
        req.params.id,
      ]
    );
    if (result.rowCount === 0) return res.redirect('/dashboard?error=not_found');
    res.redirect('/dashboard?status=updated');
  } catch (err) {
    if (err.code === '23505') {
      return renderForm(res, {
        mode: 'edit',
        review: { id: req.params.id, ...values },
        errors: { ...errors, identifier: 'That identifier is already in use — pick another one.' },
      });
    }
    next(err);
  }
});

module.exports = router;
