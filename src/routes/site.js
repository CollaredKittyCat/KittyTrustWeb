'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// Whitelisted query-string messages (?status=… / ?error=…).
const NOTICES = {
  added: 'Review published.',
  updated: 'Review updated.',
  removed: 'Review removed.',
  loggedout: 'Signed out. See you next time.',
};
const PROBLEMS = {
  missing_identifier: 'Enter the identifier of the review you want to remove.',
  unknown_identifier: 'No review matched that identifier.',
  not_found: 'That review no longer exists.',
};

router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where =
        'WHERE display_name ILIKE $1 OR username ILIKE $1 ' +
        'OR service ILIKE $1 OR identifier ILIKE $1';
    }

    const [reviews, stats] = await Promise.all([
      query(`SELECT * FROM reviews ${where} ORDER BY updated_at DESC, id DESC`, params),
      query(
        `SELECT count(*)::int AS total,
                coalesce(round(avg(rating)::numeric, 1), 0)::float AS avg
           FROM reviews`
      ),
    ]);

    res.render('home', {
      title: 'Home',
      reviews: reviews.rows,
      stats: stats.rows[0],
      q,
      notice: NOTICES[req.query.status] || null,
      problem: PROBLEMS[req.query.error] || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
