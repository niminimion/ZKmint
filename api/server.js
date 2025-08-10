const app = require('../server');

module.exports = (req, res) => {
  // Vercel Node.js serverless function handler
  app(req, res);
};

// Force Node.js runtime on Vercel (avoid Edge runtime limitations)
module.exports.config = { runtime: 'nodejs' };


