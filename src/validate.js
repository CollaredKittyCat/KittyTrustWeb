'use strict';

const MAX = {
  identifier: 40,
  display_name: 80,
  username: 80,
  discord_id: 25,
  user_link: 500,
  banner_url: 1000,
  service: 80,
  experience: 4000,
};

function singleLine(value, max) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function paragraph(value, max) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

function checkUrl(value, field, errors, { label, max }) {
  const raw = singleLine(value, max);
  if (!raw) {
    errors[field] = `${label} is required.`;
    return '';
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    errors[field] = `${label} must be a full link (https://…).`;
    return raw;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    errors[field] = `${label} must start with http:// or https://.`;
  }
  return raw;
}

/**
 * Validates + normalizes the add/edit review form.
 * Returns { values, errors }; when errors is non-empty the form should be
 * re-rendered with the submitted values.
 */
function validateReview(body) {
  const errors = {};

  let identifier = singleLine(body.identifier, MAX.identifier).toLowerCase();
  if (!identifier) {
    errors.identifier = 'Identifier is required — it is what you use to remove the review later.';
  } else if (!/^[a-z0-9][a-z0-9_-]*$/.test(identifier)) {
    errors.identifier = 'Identifier may only contain letters, numbers, dashes and underscores.';
  } else if (identifier.length < 2) {
    errors.identifier = 'Identifier must be at least 2 characters.';
  }

  const display_name = singleLine(body.display_name, MAX.display_name);
  if (!display_name) errors.display_name = 'Display name is required.';

  let username = singleLine(body.username, MAX.username).replace(/^@+/, '');
  if (!username) errors.username = 'Username is required.';

  // Accept a raw snowflake or anything containing one (e.g. a pasted profile link).
  const discord_id = singleLine(body.discord_id, MAX.discord_id + 100).replace(/\D/g, '');
  if (!discord_id) {
    errors.discord_id = 'Discord user ID is required (the numeric ID, e.g. 123456789012345678).';
  } else if (discord_id.length < 5 || discord_id.length > 25) {
    errors.discord_id = 'Discord user ID should be the numeric ID (5–25 digits).';
  }

  const user_link = checkUrl(body.user_link, 'user_link', errors, {
    label: 'User link',
    max: MAX.user_link,
  });
  const banner_url = checkUrl(body.banner_url, 'banner_url', errors, {
    label: 'Banner link',
    max: MAX.banner_url,
  });

  const service = singleLine(body.service, MAX.service);
  if (!service) errors.service = 'Service is required (e.g. "Logo Design").';

  const experience = paragraph(body.experience, MAX.experience);
  if (!experience) errors.experience = 'Experience is required — describe how it went.';
  else if (experience.length < 10) errors.experience = 'Experience is too short — write at least a sentence.';

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = 'Pick a star rating between 1 and 5.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: {
      identifier,
      display_name,
      username,
      discord_id,
      user_link,
      banner_url,
      service,
      experience,
      rating: Number.isInteger(rating) ? rating : 1,
    },
  };
}

module.exports = { validateReview, MAX };
