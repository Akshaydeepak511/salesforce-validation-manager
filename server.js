require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const jsforce = require('jsforce');

const app = express();

app.use(cors({
  origin:
    'https://salesforce-validation-manager-frontend-deh4f8yty.vercel.app',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: 'salesforce-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false
  }
}));

const PORT = 5000;

const oauth2 = new jsforce.OAuth2({
  loginUrl: process.env.LOGIN_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});

app.get('/', (req, res) => {
  res.send('Backend Running');
});

app.get('/auth/salesforce', (req, res) => {

  res.redirect(
    oauth2.getAuthorizationUrl({
      prompt: 'login'
    })
  );

});

app.get('/auth/salesforce/callback', async (req, res) => {

  const conn = new jsforce.Connection({ oauth2 });

  const code = req.query.code;

  try {

    await conn.authorize(code);

    req.session.accessToken = conn.accessToken;
    req.session.instanceUrl = conn.instanceUrl;

    res.redirect(
      'https://salesforce-validation-manager-frontend-deh4f8yty.vercel.app'
    );

  } catch (error) {

    console.log(JSON.stringify(error, null, 2));

    res.status(500).send('Salesforce Authentication Failed');
  }
});

app.get('/user-info', async (req, res) => {

  if (
    !req.session.accessToken ||
    !req.session.instanceUrl
  ) {
    return res.status(401).json({
      message: 'User not authenticated'
    });
  }

  const conn = new jsforce.Connection({
    instanceUrl: req.session.instanceUrl,
    accessToken: req.session.accessToken
  });

  try {

    const userInfo = await conn.identity();

    res.json({
      username: userInfo.username,
      display_name: userInfo.display_name
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message
    });
  }
});

app.get('/validation-rules', async (req, res) => {

  if (
    !req.session.accessToken ||
    !req.session.instanceUrl
  ) {
    return res.status(401).json({
      message: 'User not authenticated'
    });
  }

  const conn = new jsforce.Connection({
    instanceUrl: req.session.instanceUrl,
    accessToken: req.session.accessToken
  });

  try {

    const result = await conn.tooling.query(
      "SELECT Id, ValidationName, Active, EntityDefinition.QualifiedApiName FROM ValidationRule"
    );

    res.json(result.records);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message,
      data: error.data
    });
  }
});

app.post('/toggle-validation-rule', async (req, res) => {

  if (
    !req.session.accessToken ||
    !req.session.instanceUrl
  ) {
    return res.status(401).json({
      message: 'User not authenticated'
    });
  }

  const conn = new jsforce.Connection({
    instanceUrl: req.session.instanceUrl,
    accessToken: req.session.accessToken
  });

  const {
    fullName,
    active
  } = req.body;

  try {

    const metadata = await conn.metadata.read(
      'ValidationRule',
      fullName
    );

    metadata.active = active;

    const result = await conn.metadata.update(
      'ValidationRule',
      metadata
    );

    res.json({
      success: true,
      result: result
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message,
      error: error
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});