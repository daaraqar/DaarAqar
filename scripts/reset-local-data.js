const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '.data');

// 1. Reset aqarpulse_db.json
const dbPath = path.join(dataDir, 'aqarpulse_db.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  // Keep only admin accounts
  db.users = [
    {
      id: "usr-admin-01",
      name: "إدارة دار العقار",
      email: "admin@aqarpulse.eg",
      phone: "+201001112233",
      role: "admin",
      isVerified: true,
      whatsappEnabled: true,
      passwordHash: "d267483479506c9aa1a84c3a8a6a8bffd94e800861f845d51691ee5b714bec40a224b3c24d3fb1c62e4fb00c64489ea0dbc75543c5054bafccf3e268fe19baea",
      passwordSalt: "2b5f983bd691a6762b9b2fe7d3c08814",
      createdAt: "2026-01-01T10:00:00Z"
    },
    {
      id: "8478f33b-2154-4930-97a9-323a18b90511",
      name: "المشرف العام (MKELWAYZY)",
      email: "mkelwayzy@gmail.com",
      phone: "+201001112244",
      role: "admin",
      isVerified: true,
      whatsappEnabled: true,
      createdAt: "2026-01-01T10:00:00Z"
    }
  ];

  // Reset transactional collections
  db.properties = [];
  db.inquiries = [];
  db.favorites = [];
  db.savedSearches = [];
  db.moderationLogs = [];
  db.auditEvents = [];
  db.reports = [];
  db.officialNotices = [];
  db.cmsMedia = [];
  db.cmsRevisions = [];

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('Reset aqarpulse_db.json: properties = [], inquiries = [], favorites = [], admins preserved.');
}

// 2. Reset smart features transactional files
const smartFiles = [
  'smart_features_inspections.json',
  'smart_features_requests.json',
  'smart_features_reservations.json'
];

smartFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
  console.log(`Reset ${file} to []`);
});

// 3. Reset auth tokens
const authTokensPath = path.join(dataDir, 'auth_tokens.json');
if (fs.existsSync(authTokensPath)) {
  fs.writeFileSync(authTokensPath, JSON.stringify({}, null, 2), 'utf8');
  console.log('Reset auth_tokens.json');
}

console.log('All local data successfully reset to clean slate!');
