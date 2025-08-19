const path = require('path');

/**
 * Maps a path from one base directory to another, preserving the subdirectory structure.
 * @param {string} originalPath - The original full path (e.g., under datasetDir).
 * @param {string} fromBase - The base directory to remove (e.g., '/app/dataset').
 * @param {string} toBase - The base directory to add (e.g., '/app/apr-logs').
 * @returns {string} - The mapped path under the new base.
 */
function mapBasePath(originalPath, fromBase, toBase) {
  const relative = path.relative(fromBase, originalPath);
  return path.join(toBase, relative);
}

// Example usage:
const datasetDir = '/app/dataset';
const aprlogsDir = '/app/apr-logs';

const datasetPath = '/app/dataset/fewCommit/boulder/issue/ratelimits-_Exempt_renewals_from_NewOrdersPerAccount_and_CertificatesPerDomain_limits';
const aprlogsPath = mapBasePath(datasetPath, datasetDir, aprlogsDir);
// aprlogsPath will be '/app/apr-logs/fewCommit/boulder/issue/ratelimits-_Exempt_renewals_from_NewOrdersPerAccount_and_CertificatesPerDomain_limits'

module.exports = { mapBasePath };
